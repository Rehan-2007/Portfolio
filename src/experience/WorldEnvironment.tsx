import type { QualityLevel } from '../stores/useExperienceStore'
import { VoxelAtmosphere } from './world/VoxelAtmosphere'
import { VoxelTerrain } from './world/VoxelTerrain'
import { StationBeacons } from './world/StationBeacons'
import { WorldLighting } from './world/WorldLighting'
import { LandmarkModels } from '../components/models/ModelSlot'

interface WorldEnvironmentProps {
  quality: QualityLevel
}

export function WorldEnvironment({ quality }: WorldEnvironmentProps) {
  return (
    <group name="ANTI-AI voxel adventure world">
      <VoxelAtmosphere quality={quality} />
      <WorldLighting quality={quality} />
      <VoxelTerrain quality={quality} />
      <StationBeacons />
      <LandmarkModels />
    </group>
  )
}
