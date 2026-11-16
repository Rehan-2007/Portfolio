import { Vector3 } from 'three'
import { STATIONS } from '../../config/stations'
import { VOXEL_WORLD } from '../../config/voxelWorld'
import { LANDMARK_GEOMETRY, LANDMARK_PAD_MARGIN } from '../../config/landmarkGeometry'
import { getLandmarkBounds } from '../../lib/landmarkBounds'

export function StationBeacons() {
  return (
    <group name="Future landmark sites">
      {STATIONS.map((station) => {
        const bounds = getLandmarkBounds(station.id)
        const center = bounds.getCenter(new Vector3())
        const size = bounds.getSize(new Vector3())
        const hasSource = LANDMARK_GEOMETRY[station.id].sourceBounds !== null
        const width = size.x + (hasSource ? LANDMARK_PAD_MARGIN * 2 : 0)
        const depth = size.z + (hasSource ? LANDMARK_PAD_MARGIN * 2 : 0)
        return (
          <group key={station.id} position={[center.x, station.pos[1], center.z]}>
            <mesh position={[0, 3.5, 0]} castShadow={false} receiveShadow={false}>
              <boxGeometry args={[width, 7, depth]} />
              <meshStandardMaterial color={VOXEL_WORLD.palette.stone} roughness={0.9} metalness={0.05} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
