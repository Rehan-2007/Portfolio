import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

function applyEnvironment(scene: THREE.Scene, texture: THREE.Texture, intensity: number) {
  scene.environment = texture
  scene.environmentIntensity = intensity
}

/** A small procedural reflection environment, independent of uploaded material textures. */
export function ReflectionEnvironment() {
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const width = 512
    const height = 256
    const data = new Float32Array(width * height * 4)
    const sunDirection = new THREE.Vector3(-0.48, 0.37, -0.79).normalize()
    const direction = new THREE.Vector3()
    for (let y = 0; y < height; y++) {
      const latitude = Math.PI * (y / (height - 1))
      const h = Math.cos(latitude)
      for (let x = 0; x < width; x++) {
        const longitude = x / width * Math.PI * 2
        direction.set(-Math.sin(longitude) * Math.sin(latitude), h, Math.cos(longitude) * Math.sin(latitude))
        const upper = Math.max(0, h)
        const horizon = Math.exp(-Math.abs(h) * 6)
        const glow = Math.pow(Math.max(0, direction.dot(sunDirection)), 36)
        const p = (y * width + x) * 4
        data[p] = 0.14 + upper * 0.05 + horizon * 0.34 + glow * 2.0
        data[p + 1] = 0.19 + upper * 0.13 + horizon * 0.2 + glow * 1.65
        data[p + 2] = 0.23 + upper * 0.29 + horizon * 0.13 + glow * 1.1
        data[p + 3] = 1
      }
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
    texture.mapping = THREE.EquirectangularReflectionMapping
    texture.colorSpace = THREE.LinearSRGBColorSpace
    texture.needsUpdate = true
    const generator = new THREE.PMREMGenerator(gl)
    const environment = generator.fromEquirectangular(texture)
    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    applyEnvironment(scene, environment.texture, 0.65)
    return () => {
      if (previous) applyEnvironment(scene, previous, previousIntensity)
      else Object.assign(scene, { environment: null, environmentIntensity: previousIntensity })
      environment.dispose()
      texture.dispose()
      generator.dispose()
    }
  }, [gl, scene])
  return null
}
