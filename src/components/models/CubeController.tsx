import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  FACE_LAYERS, IDENTITY_ORIENTATION, isInLayer, moveQuarterTurns, parseCubeletName,
  resolveFace, transformByOrientation, turnCubelet,
} from '../../lib/cubeMoves'
import type { CubeMove, CubeletState, FaceKey } from '../../lib/cubeMoves'
import { useCubeControls } from '../../stores/useCubeControls'
import { useExperienceStore } from '../../stores/useExperienceStore'
import { useModelAssets } from '../../stores/useModelAssets'
import { useEffects } from '../../stores/useEffects'

const TURN_SECONDS = 0.32
interface ImportedPiece {
  object: THREE.Object3D
  state: CubeletState
  parent: THREE.Object3D
  originalPosition: THREE.Vector3
  originalQuaternion: THREE.Quaternion
  originalScale: THREE.Vector3
  homePosition: THREE.Vector3
  homeQuaternion: THREE.Quaternion
  homeScale: THREE.Vector3
}
type EmissiveMaterial = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number; color?: THREE.Color }
interface MaterialCopy {
  material: THREE.Material
  piece: ImportedPiece
  emissive?: THREE.Color
  intensity?: number
}
interface MeshCopy { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }

function orientationQuaternion(piece: ImportedPiece, matrix: THREE.Matrix4, quaternion: THREE.Quaternion) {
  const m = piece.state.orientation
  matrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
  return quaternion.setFromRotationMatrix(matrix).multiply(piece.homeQuaternion).normalize()
}

/** Testable imported-node rig. Does not load assets or create replacement geometry. */
// eslint-disable-next-line react/only-export-components -- Imperative rig is tested without a WebGL renderer.
export function createCubeRig(scene: THREE.Object3D) {
  const nodes: { object: THREE.Object3D; state: CubeletState }[] = []
  scene.traverse((object) => {
    const position = parseCubeletName(object.name)
    if (position) nodes.push({ object, state: { id: object.name, position, orientation: IDENTITY_ORIENTATION } })
  })
  if (nodes.length !== 26 || new Set(nodes.map(({ state }) => state.id)).size !== 26) {
    throw new Error('Rubik controller requires the 26 named, separable imported cubelets.')
  }
  const nodeSet = new Set(nodes.map(({ object }) => object))
  for (const { object } of nodes) {
    for (let parent = object.parent; parent; parent = parent.parent) {
      if (nodeSet.has(parent)) throw new Error('Imported cubelets must not contain other cubelets.')
    }
  }
  scene.updateWorldMatrix(true, true)
  const inverseScene = scene.matrixWorld.clone().invert()
  const pieces: ImportedPiece[] = nodes.map(({ object, state }) => {
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3()
    new THREE.Matrix4().multiplyMatrices(inverseScene, object.matrixWorld).decompose(position, quaternion, scale)
    return {
      object, state, parent: object.parent!,
      originalPosition: object.position.clone(), originalQuaternion: object.quaternion.clone(), originalScale: object.scale.clone(),
      homePosition: position, homeQuaternion: quaternion, homeScale: scale,
    }
  })
  // Origins of the real source center caps differ from edge/corner spacing.
  // Keep all source offsets; the logical integer grid is a separate coordinate system.
  const center = new THREE.Vector3()
  const corners = pieces.filter(({ state }) => state.position.every((value) => value !== 0))
  corners.forEach((piece) => center.add(piece.homePosition))
  center.divideScalar(corners.length)
  const logical = new THREE.Group()
  logical.name = 'Imported cube local layer grid'
  const pivot = new THREE.Group()
  pivot.name = 'Animated imported cube layer pivot'
  scene.add(logical)
  logical.add(pivot)
  pivot.position.copy(center)
  const materialCopies: MaterialCopy[] = []
  const meshCopies: MeshCopy[] = []
  for (const piece of pieces) {
    logical.add(piece.object)
    piece.object.position.copy(piece.homePosition)
    piece.object.quaternion.copy(piece.homeQuaternion)
    piece.object.scale.copy(piece.homeScale)
    piece.object.updateMatrix()
    piece.object.traverse((object) => {
      object.castShadow = false
      object.receiveShadow = false
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      meshCopies.push({ mesh, original: mesh.material })
      const copy = (source: THREE.Material) => {
        const material = source.clone()
        const emissive = material as EmissiveMaterial
        materialCopies.push({ material, piece,
          ...(emissive.emissive?.isColor ? { emissive: emissive.emissive.clone(), intensity: emissive.emissiveIntensity } : {}),
        })
        return material
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material)
    })
  }
  let selected: FaceKey | null = null
  let active: { move: CubeMove; members: ImportedPiece[]; elapsed: number } | null = null
  const axis = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const highlight = () => {
    for (const copy of materialCopies) {
      if (!copy.emissive) continue
      const material = copy.material as EmissiveMaterial
      material.emissive.copy(copy.emissive)
      material.emissiveIntensity = copy.intensity!
      if (selected && isInLayer(copy.piece.state, selected)) {
        // Small, steady emissive accent; source color/texture/PBR channels stay intact.
        const color = material.color ?? new THREE.Color(0.5, 0.5, 0.5)
        material.emissive.r += color.r * 0.055
        material.emissive.g += color.g * 0.055
        material.emissive.b += color.b * 0.055
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 1)
      }
    }
  }
  return {
    center,
    get states(): readonly CubeletState[] { return pieces.map((piece) => piece.state) },
    get turning() { return active !== null },
    selectFace(face: FaceKey | null) { selected = face; highlight() },
    begin(move: CubeMove) {
      if (active) throw new Error('A cube layer turn is already running.')
      const members = pieces.filter((piece) => isInLayer(piece.state, move.face))
      if (members.length !== 9) throw new Error(`Imported ${move.face} layer does not contain nine cubelets.`)
      pivot.quaternion.identity()
      for (const piece of members) {
        // Pivot and local grid share axes. Subtraction preserves exact source origins.
        pivot.add(piece.object)
        piece.object.position.sub(center)
        piece.object.updateMatrix()
      }
      axis.set(0, 0, 0).setComponent(FACE_LAYERS[move.face].index, 1)
      active = { move, members, elapsed: 0 }
    },
    advance(delta: number, reducedMotion: boolean): boolean {
      if (!active) return false
      active.elapsed += Math.max(0, Number.isFinite(delta) ? delta : 0)
      const progress = reducedMotion ? 1 : Math.min(1, active.elapsed / TURN_SECONDS)
      const ease = progress * progress * (3 - 2 * progress)
      pivot.quaternion.setFromAxisAngle(axis, moveQuarterTurns(active.move) * Math.PI / 2 * ease)
      if (progress < 1) return false
      for (const piece of active.members) {
        piece.state = turnCubelet(piece.state, active.move)
        logical.add(piece.object)
        // Rebuild from exact integer orientation and ORIGINAL source transforms.
        // No drift, guessed uniform spacing, or quaternion component rounding.
        const home = piece.homePosition.clone().sub(center)
        const position = transformByOrientation(home.toArray(), piece.state.orientation)
        piece.object.position.fromArray(position).add(center)
        piece.object.quaternion.copy(orientationQuaternion(piece, matrix, quaternion))
        piece.object.scale.copy(piece.homeScale)
        piece.object.updateMatrix()
      }
      pivot.quaternion.identity()
      active = null
      highlight()
      return true
    },
    dispose() {
      active = null
      meshCopies.forEach(({ mesh, original }) => { mesh.material = original })
      materialCopies.forEach(({ material }) => material.dispose())
      for (const piece of pieces) {
        piece.parent.add(piece.object)
        piece.object.position.copy(piece.originalPosition)
        piece.object.quaternion.copy(piece.originalQuaternion)
        piece.object.scale.copy(piece.originalScale)
        piece.object.updateMatrix()
      }
      scene.remove(logical)
      scene.updateWorldMatrix(true, true)
    },
  }
}

/** Place inside the parent's configured position/rotation/scale model wrapper. */
export function CubeController({ scene }: { scene: THREE.Object3D }) {
  const inspection = useRef<THREE.Group>(null)
  const rig = useRef<ReturnType<typeof createCubeRig> | null>(null)
  const selectedFace = useModelAssets((state) => state.selectedFace)
  const cameraPosition = useRef(new THREE.Vector3())
  const centerPosition = useRef(new THREE.Vector3())
  const normal = useRef(new THREE.Vector3())
  const targetRotation = useRef(new THREE.Quaternion())

  useEffect(() => {
    try {
      rig.current = createCubeRig(scene)
      const selected = useModelAssets.getState().selectedFace
      rig.current.selectFace(selected ? resolveFace(selected) : null)
    } catch (error) {
      useCubeControls.getState().fail(error instanceof Error ? error.message : 'Imported cube cannot be controlled.')
    }
    return () => {
      rig.current?.dispose()
      rig.current = null
      useCubeControls.getState().reset()
    }
  }, [scene])
  useEffect(() => {
    rig.current?.selectFace(selectedFace ? resolveFace(selectedFace) : null)
  }, [selectedFace])

  // Default priority: never take over the renderer or spin the idle cube.
  useFrame(({ camera }, delta) => {
    const current = rig.current
    const root = inspection.current
    if (!current || !root) return
    const reducedMotion = useExperienceStore.getState().settings.reducedMotion
    // Reduced-motion queues complete within this frame, bounded for long histories.
    for (let step = 0; step < (reducedMotion ? 512 : 1); step++) {
      const controls = useCubeControls.getState()
      let turn = controls.activeTurn
      try {
        if (!turn) {
          turn = controls.beginNextTurn()
          if (!turn) break
          current.begin(turn.move)
        }
        if (!current.advance(delta, reducedMotion)) break
        useCubeControls.getState().completeTurn(turn.id)
      } catch (error) {
        useCubeControls.getState().fail(error instanceof Error ? error.message : 'Imported cube layer turn failed.')
        break
      }
    }
    const value = useModelAssets.getState().selectedFace
    const face = value ? resolveFace(value) : null
    const target = targetRotation.current.identity()
    if (face && root.parent) {
      camera.getWorldPosition(cameraPosition.current)
      centerPosition.current.copy(current.center)
      scene.localToWorld(centerPosition.current)
      root.parent.worldToLocal(cameraPosition.current)
      root.parent.worldToLocal(centerPosition.current)
      cameraPosition.current.sub(centerPosition.current)
      if (cameraPosition.current.lengthSq() > 1e-10) {
        normal.current.fromArray(FACE_LAYERS[face].normal).applyQuaternion(scene.quaternion).normalize()
        target.setFromUnitVectors(normal.current, cameraPosition.current.normalize())
      }
    }
    if (reducedMotion || root.quaternion.angleTo(target) < 0.001) root.quaternion.copy(target)
    else root.quaternion.slerp(target, 1 - Math.exp(-Math.max(0, delta) * 6))
  })

  const selectClickedFace = (event: ThreeEvent<MouseEvent>) => {
    if (useEffects.getState().enabled) return
    const target = event.nativeEvent.target
    if (target instanceof Element && target.closest('button, a, input, textarea, select, dialog')) return
    if (!event.face || !inspection.current) return
    event.stopPropagation()
    const worldNormal = event.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(event.object.matrixWorld))
    const inverse = inspection.current.matrixWorld.clone().invert()
    const localNormal = worldNormal.transformDirection(inverse)
    const values = [Math.abs(localNormal.x), Math.abs(localNormal.y), Math.abs(localNormal.z)]
    const index = values.indexOf(Math.max(...values))
    const positive = localNormal.getComponent(index) >= 0
    const face = index === 0 ? positive ? 'R' : 'L' : index === 1 ? positive ? 'U' : 'D' : positive ? 'F' : 'B'
    useCubeControls.getState().selectFace(face)
    useExperienceStore.getState().openStation('cube')
  }
  return <group ref={inspection} name="Imported cube face inspection" onClick={selectClickedFace}><primitive object={scene} dispose={null} /></group>
}
