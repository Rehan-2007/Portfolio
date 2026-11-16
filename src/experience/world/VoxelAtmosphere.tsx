import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityLevel } from '../../stores/useExperienceStore'
import { VOXEL_QUALITY, VOXEL_WORLD } from '../../config/voxelWorld'
import { generateVoxelClouds } from './generateVoxelWorld'
import { VoxelInstances } from './VoxelInstances'

interface VoxelAtmosphereProps { quality: QualityLevel }

function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 direction;
      void main() {
        vec3 ray = normalize(direction);
        float h = ray.y;
        vec3 horizon = vec3(0.79, 0.46, 0.33);
        vec3 midSky = vec3(0.48, 0.48, 0.66);
        vec3 zenith = vec3(0.12, 0.28, 0.52);
        vec3 color = mix(horizon, midSky, smoothstep(-0.03, 0.3, h));
        color = mix(color, zenith, smoothstep(0.3, 0.95, h));
        color = mix(vec3(0.55, 0.43, 0.42), color, smoothstep(-0.7, 0.01, h));
        vec3 sunDir = normalize(vec3(-3600.0, 2200.0, -5700.0));
        float glow = pow(max(dot(ray, sunDir), 0.0), 28.0);
        color += vec3(0.34, 0.13, 0.015) * glow;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

export function VoxelAtmosphere({ quality }: VoxelAtmosphereProps) {
  const skyMaterial = useMemo(() => createSkyMaterial(), [])
  const cloudGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const cloudMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), [])
  const clouds = useMemo(() => generateVoxelClouds(quality), [quality])
  const sky = useMemo(() => new THREE.SphereGeometry(1, 32, 18), [])
  const skyGroup = useRef<THREE.Group>(null)
  const sun = useRef<THREE.Mesh>(null)
  const config = VOXEL_QUALITY[quality]
  useFrame(({ camera }) => {
    skyGroup.current?.position.copy(camera.position)
    sun.current?.quaternion.copy(camera.quaternion)
  })
  useEffect(() => () => { sky.dispose(); skyMaterial.dispose(); cloudGeometry.dispose(); cloudMaterial.dispose() }, [cloudGeometry, cloudMaterial, sky, skyMaterial])

  return (
    <>
      <group ref={skyGroup}>
        <mesh geometry={sky} material={skyMaterial} scale={14000} frustumCulled={false} dispose={null} />
        <mesh ref={sun} position={VOXEL_WORLD.sunPosition} scale={[250, 250, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#fff1ba" toneMapped={false} fog={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, VOXEL_WORLD.oceanLevel - 2, 0]} castShadow={false} receiveShadow={false}>
        <planeGeometry args={[36000, 36000]} />
        <meshStandardMaterial color="#649ea9" roughness={0.42} metalness={0.05} />
      </mesh>
      <VoxelInstances batch={clouds} geometry={cloudGeometry} material={cloudMaterial} />
      <fog attach="fog" args={['#c7a3a2', config.fogNear, config.fogFar]} />
    </>
  )
}
