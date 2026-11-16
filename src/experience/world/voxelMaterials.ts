import * as THREE from 'three'
import { terrainHash } from '../../lib/voxelTerrain'

/** Original neutral tile detail; multiplies biome colors without copying references. */
export function createVoxelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')!
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const shade = 225 + Math.floor(terrainHash(x, y, 928) * 30)
    context.fillStyle = `rgb(${shade},${shade},${shade})`
    context.fillRect(x, y, 1, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createBlockGeometry(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const colors = new Float32Array(geometry.attributes.normal.count * 3)
  for (let i = 0; i < geometry.attributes.normal.count; i++) {
    const y = geometry.attributes.normal.getY(i)
    const shade = y > 0 ? 1 : y < 0 ? 0.87 : 0.96
    colors.set([shade, shade, shade], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}
