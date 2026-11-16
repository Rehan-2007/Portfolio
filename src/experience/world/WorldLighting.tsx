import type { QualityLevel } from '../../stores/useExperienceStore'

interface WorldLightingProps { quality: QualityLevel }

/** Color and directional surface shading supply depth; no light casts a shadow. */
export function WorldLighting(_props: WorldLightingProps) {
  return (
    <>
      <ambientLight intensity={0.62} color="#f3e7e4" />
      <hemisphereLight args={['#b6d0ef', '#958873', 1.05]} />
      <directionalLight position={[-3600, 2200, -5700]} color="#ffe3b9" intensity={2.15} castShadow={false} />
      <directionalLight position={[1900, 1500, 900]} color="#acc5e9" intensity={0.75} castShadow={false} />
    </>
  )
}
