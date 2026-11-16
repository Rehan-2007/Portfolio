import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperienceStore } from '../../stores/useExperienceStore'
import { OWNER } from '../../config/portfolio'
import { useEffects } from '../../stores/useEffects'

/** Runtime-generated OS splash on the measured original display; never a reference-image billboard. */
export function LaptopScreen() {
  const active = useExperienceStore((state) => state.activeStation === 'about')
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 600
    const context = canvas.getContext('2d')!
    context.fillStyle = '#0c141b'
    context.fillRect(0, 0, 1024, 600)
    context.strokeStyle = '#254050'
    for (let x = 0; x < 1024; x += 64) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 600); context.stroke() }
    context.fillStyle = '#e32636'
    context.fillRect(54, 70, 10, 60)
    context.font = 'bold 42px monospace'
    context.fillStyle = '#f2f0e9'
    context.fillText('ANTI-AI // HUMAN', 88, 115)
    context.font = '28px monospace'
    context.fillStyle = '#95c2d5'
    context.fillText('INTELLIGENCE OPERATING SYSTEM', 88, 162)
    context.fillStyle = '#f2f0e9'
    context.font = 'bold 48px sans-serif'
    context.fillText(OWNER.name, 64, 292)
    context.font = '24px monospace'
    context.fillStyle = '#b2c6d0'
    context.fillText('CSE  /  ARTIFICIAL INTELLIGENCE & ML', 64, 345)
    context.fillStyle = '#e3a4aa'
    context.fillText('[ F / CLICK ]  OPEN PORTFOLIO', 64, 462)
    context.font = '18px monospace'
    context.fillStyle = '#83939d'
    context.fillText('ABOUT  EDUCATION  SKILLS  MY SETUP  PROJECTS  CONTACT', 64, 550)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(({ clock }) => {
    if (material.current) material.current.opacity = active ? 1 : 0.7 + Math.sin(clock.elapsedTime * 0.6) * 0.05
  })
  return (
    <mesh position={[-0.008, 6.159, 5.021]} rotation={[0, Math.PI, 0]} onClick={(event) => { if (useEffects.getState().enabled) return; const target = event.nativeEvent.target; if (target instanceof Element && target.closest('button, a, input, textarea, select, dialog')) return; event.stopPropagation(); useExperienceStore.getState().openStation('about') }}>
      <planeGeometry args={[15.62, 9.01]} />
      <meshBasicMaterial ref={material} map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
