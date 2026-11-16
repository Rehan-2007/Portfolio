import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createB2Geometry, sampleB2Surface } from '../lib/b2Geometry'
import { experienceSnapshot } from '../stores/useExperienceStore'
import type { QualityLevel } from '../stores/useExperienceStore'

interface B2SpiritProps { quality: QualityLevel }

export function B2Spirit({ quality }: B2SpiritProps) {
  const geometry = useMemo(() => createB2Geometry(quality), [quality])
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#414e5c', metalness: 0.28, roughness: 0.52 }), [])
  const rims = useMemo(() => new THREE.MeshStandardMaterial({ color: '#364452', metalness: 0.32, roughness: 0.48, side: THREE.DoubleSide }), [])
  const recesses = useMemo(() => new THREE.MeshStandardMaterial({ color: '#15212b', roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide }), [])
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#243b4a', metalness: 0.35, roughness: 0.18, clearcoat: 0.55, side: THREE.DoubleSide }), [])
  const red = useRef<THREE.MeshBasicMaterial>(null)
  const green = useRef<THREE.MeshBasicMaterial>(null)
  const tip = sampleB2Surface(27.6, 0.5)
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry])
  useEffect(() => () => { skin.dispose(); rims.dispose(); recesses.dispose(); glass.dispose() }, [skin, rims, recesses, glass])
  useFrame(({ clock }) => {
    const pulse = experienceSnapshot().settings.reducedMotion ? 1 : 0.72 + Math.sin(clock.elapsedTime * 2.5) * 0.28
    if (red.current) red.current.opacity = pulse
    if (green.current) green.current.opacity = pulse
  })
  return (
    <group name="B-2 Spirit reference-refined flying wing">
      <mesh geometry={geometry.hull} material={skin} castShadow={false} receiveShadow={false} dispose={null} />
      <mesh geometry={geometry.recessRims} material={rims} castShadow={false} receiveShadow={false} dispose={null} />
      <mesh geometry={geometry.recessInteriors} material={recesses} castShadow={false} receiveShadow={false} dispose={null} />
      <mesh geometry={geometry.cockpitFrame} material={rims} castShadow={false} receiveShadow={false} dispose={null} />
      <mesh geometry={geometry.cockpitGlass} material={glass} castShadow={false} receiveShadow={false} dispose={null} />
      <lineSegments geometry={geometry.panels} dispose={null}>
        <lineBasicMaterial color="#88959c" transparent opacity={0.24} />
      </lineSegments>
      <mesh position={[-27.6, tip.top + 0.1, tip.z]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshBasicMaterial ref={red} color="#ed5260" transparent toneMapped={false} />
      </mesh>
      <mesh position={[27.6, tip.top + 0.1, tip.z]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshBasicMaterial ref={green} color="#6cf4c3" transparent toneMapped={false} />
      </mesh>
    </group>
  )
}
