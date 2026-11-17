import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type { ModelInspection } from '../stores/useModelAssets'

/** Clone hierarchy/materials; cached geometry and source image data remain untouched. */
export function prepareModel(gltf: GLTF, anisotropy = 4, pixelTextures = false) {
  const scene = clone(gltf.scene)
  const materials = new Map<THREE.Material, THREE.Material>()
  const textures = new Map<string, THREE.Texture>()
  const warnings: string[] = []
  let importedLights = 0
  const prepareTexture = (source: THREE.Texture, srgb: boolean) => {
    const key = `${source.uuid}:${srgb}`
    const cached = textures.get(key)
    if (cached) return cached
    const copy = source.clone()
    copy.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    copy.anisotropy = Math.max(1, Math.min(anisotropy, 8))
    copy.generateMipmaps = true
    copy.minFilter = pixelTextures ? THREE.NearestMipmapLinearFilter : THREE.LinearMipmapLinearFilter
    copy.magFilter = pixelTextures ? THREE.NearestFilter : THREE.LinearFilter
    copy.needsUpdate = true
    textures.set(key, copy)
    return copy
  }
  scene.traverse((object) => {
    object.castShadow = false
    object.receiveShadow = false
    if ((object as THREE.Light).isLight) { object.visible = false; importedLights++ }
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const clean = (source: THREE.Material) => {
      const existing = materials.get(source)
      if (existing) return existing
      const copy = source.clone()
      const maps = copy as THREE.MeshStandardMaterial
      if ('aoMap' in copy && maps.aoMap) {
        maps.aoMap = null
        if (!warnings.includes('Imported AO maps disabled.')) warnings.push('Imported AO maps disabled.')
      }
      for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap'] as const) {
        const texture = maps[key]
        if (key in copy && texture) maps[key] = prepareTexture(texture, key === 'map' || key === 'emissiveMap')
      }
      if (copy instanceof THREE.MeshPhysicalMaterial) {
        for (const key of ['clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'transmissionMap', 'thicknessMap', 'specularIntensityMap', 'specularColorMap', 'sheenColorMap', 'sheenRoughnessMap'] as const) {
          const texture = copy[key]
          if (texture) copy[key] = prepareTexture(texture, key === 'specularColorMap' || key === 'sheenColorMap')
        }
      }
      if (copy instanceof THREE.MeshStandardMaterial) copy.envMapIntensity = 0.8
      materials.set(source, copy)
      return copy
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clean) : clean(mesh.material)
  })
  if (importedLights) warnings.push(`${importedLights} embedded lights disabled to preserve world lighting.`)
  scene.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(scene)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  if (!bounds.isEmpty()) { bounds.getSize(size); bounds.getCenter(center) }
  let meshes = 0
  let triangles = 0
  const nodes: string[] = []
  const textureIds = new Set<string>()
  scene.traverse((object) => {
    if (object.name) nodes.push(object.name)
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    meshes++
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position?.count ?? 0) / 3
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textureIds.add(value.uuid)
    }
  })
  if (!meshes) warnings.push('The file contains no renderable meshes.')
  if (triangles > 250000) warnings.push('High polygon count: optimise this asset for mobile hardware.')
  if (textureIds.size) warnings.push('Baked lighting in base-color textures cannot be removed by shadow flags.')
  const inspection: ModelInspection = {
    dimensions: size.toArray(), center: center.toArray(), meshes,
    triangles: Math.round(triangles), materials: [...materials.values()].map((item) => item.name || item.type),
    textures: textureIds.size, animations: gltf.animations.map((clip) => clip.name), nodes, warnings,
  }
  return { scene, inspection, dispose: () => { materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose()) } }
}

export function modelRequestPolicy(url: string, baseDirectory: string): string {
  if (/^(data|blob):/.test(url)) return url
  const base = new URL(baseDirectory, typeof location === 'undefined' ? 'http://localhost' : location.origin)
  const resolved = new URL(url, base)
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith('/models/')) throw new Error('Model dependencies must remain inside the local /models/ directory.')
  return resolved.href
}
