import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  applyCubeMove, CATEGORY_FACES, createScramble, createSolvedCube, FACE_LAYERS,
  IDENTITY_ORIENTATION, inverseHistory, inverseMove, isInLayer, parseCubeletName,
  resolveFace, rotateGrid, transformByOrientation,
} from '../src/lib/cubeMoves'
import type { CubeMove, FaceKey } from '../src/lib/cubeMoves'
import { createCubeRig } from '../src/components/models/CubeController'
import { useCubeControls } from '../src/stores/useCubeControls'
import { useModelAssets } from '../src/stores/useModelAssets'

const faces = Object.keys(FACE_LAYERS) as FaceKey[]

test('category normals, cubelet parsing, and nine-piece layers are exact', () => {
  const solved = createSolvedCube()
  assert.equal(solved.length, 26)
  assert.equal(new Set(solved.map((piece) => piece.id)).size, 26)
  assert.equal(resolveFace('programming'), 'U')
  assert.equal(resolveFace('ai'), 'F')
  assert.equal(resolveFace('iot'), 'R')
  assert.equal(resolveFace('tech'), 'B')
  assert.equal(resolveFace('hobbies'), 'L')
  assert.equal(resolveFace('personal'), 'D')
  assert.equal(resolveFace('toString'), null)
  assert.equal(resolveFace('unknown'), null)
  assert.deepEqual(parseCubeletName('cubelet_-1_0_1'), [-1, 0, 1])
  assert.equal(parseCubeletName('cubelet_0_0_0'), null)
  assert.equal(parseCubeletName('cubelet_2_0_0'), null)
  for (const face of faces) assert.equal(solved.filter((piece) => isInLayer(piece, face)).length, 9)
  assert.deepEqual(FACE_LAYERS.U.normal, [0, 1, 0])
  assert.deepEqual(FACE_LAYERS.B.normal, [0, 0, -1])
  assert.deepEqual(FACE_LAYERS.L.normal, [-1, 0, 0])
})

test('genuine clockwise quarter turns, inverses and four turns restore positions AND orientation', () => {
  assert.deepEqual(rotateGrid([1, 0, 0], 'z', 1), [0, 1, 0])
  assert.deepEqual(rotateGrid([1, 0, 0], 'y', 1), [0, 0, -1])
  const solved = createSolvedCube()
  const front = applyCubeMove(solved, { face: 'F', direction: 1 })
  assert.deepEqual(front.find((piece) => piece.id === 'cubelet_1_1_1')!.position, [1, -1, 1])
  assert.notDeepEqual(front.find((piece) => piece.id === 'cubelet_0_0_1')!.orientation, IDENTITY_ORIENTATION)
  for (const face of faces) for (const direction of [1, -1] as const) {
    const move: CubeMove = { face, direction }
    assert.deepEqual(applyCubeMove(applyCubeMove(solved, move), inverseMove(move)), solved)
    let state = solved
    for (let i = 0; i < 4; i++) state = applyCubeMove(state, move)
    assert.deepEqual(state, solved)
  }
})

test('deterministic 12-turn scramble and exact inverse history restore every sticker orientation', () => {
  const moves = createScramble()
  assert.equal(moves.length, 12)
  assert.deepEqual(moves, createScramble())
  assert.ok(moves.every((move, index) => index === 0 || move.face !== moves[index - 1].face))
  const solved = createSolvedCube()
  let state = solved
  for (const move of moves) state = applyCubeMove(state, move)
  assert.notDeepEqual(state, solved)
  for (let repetition = 0; repetition < 10; repetition++) for (const move of moves) state = applyCubeMove(state, move)
  assert.equal(new Set(state.map((piece) => piece.position.join(','))).size, 26)
  for (const piece of state) {
    assert.ok(piece.position.every(Number.isInteger))
    assert.deepEqual(transformByOrientation(solved.find((home) => home.id === piece.id)!.position, piece.orientation), piece.position)
  }
  const full = Array.from({ length: 11 }, () => moves).flat()
  for (const move of inverseHistory(full)) state = applyCubeMove(state, move)
  assert.deepEqual(state, solved)
  assert.throws(() => rotateGrid([1, 0, 0], 'x', 0.5))
})

test('store serializes queued turns and solves committed, active AND pending history honestly', () => {
  const controls = useCubeControls.getState()
  controls.reset()
  try {
    assert.equal(controls.enqueueTurn('unknown'), false)
    assert.equal(controls.rotate('programming'), true)
    const first = controls.beginNextTurn()!
    assert.equal(controls.beginNextTurn(), null)
    controls.completeTurn(first.id + 100)
    assert.equal(useCubeControls.getState().history.length, 0)
    controls.completeTurn(first.id)
    assert.equal(controls.scramble(), true)
    const active = controls.beginNextTurn()!
    assert.ok(active)
    assert.equal(controls.solve(), true)
    assert.equal(controls.solve(), false)
    assert.equal(controls.enqueueTurn('F'), false)
    assert.equal(controls.scramble(), false)
    let state = applyCubeMove(createSolvedCube(), first.move)
    state = applyCubeMove(state, active.move)
    controls.completeTurn(active.id)
    let turn
    let completed = 2
    while ((turn = controls.beginNextTurn())) {
      state = applyCubeMove(state, turn.move)
      controls.completeTurn(turn.id)
      completed++
    }
    assert.equal(completed, 26)
    assert.deepEqual(state, createSolvedCube())
    assert.equal(useCubeControls.getState().history.length, 0)
    assert.equal(useCubeControls.getState().solving, false)
    assert.equal(controls.solve(), false)
    for (const [category, face] of Object.entries(CATEGORY_FACES)) {
      assert.equal(controls.selectFace(face), true)
      assert.equal(useModelAssets.getState().selectedFace, category)
    }
    assert.equal(controls.selectFace(null), true)
    assert.equal(useModelAssets.getState().selectedFace, null)
    controls.fail('unavailable source')
    assert.equal(controls.enqueueTurn('F'), false)
  } finally { controls.reset(); useModelAssets.getState().selectFace(null) }
})

if (typeof ProgressEvent === 'undefined') {
  Object.assign(globalThis, { ProgressEvent: class extends Event { lengthComputable = false; loaded = 0; total = 0 } })
}

test('actual source GLB animates imported Group cubelets, keeps origin/materials, and snaps inverse history', async () => {
  const bytes = await readFile(resolve('public/models/rubiks-cube/rubiks-cube.glb'))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  // A transformed GLTF wrapper exercises nested hierarchy flattening/restoration.
  const wrapper = new THREE.Group()
  wrapper.position.set(0.4, -0.2, 0.3)
  const scene = new THREE.Group()
  const outer = new THREE.Group()
  outer.position.set(20, 8, -11); outer.scale.setScalar(2)
  outer.rotation.set(0.2, 0.8, -0.1)
  outer.add(scene); scene.add(wrapper); wrapper.add(gltf.scene)
  scene.updateWorldMatrix(true, true)
  const objects: THREE.Object3D[] = []
  const meshes: THREE.Mesh[] = []
  scene.traverse((object) => {
    if (parseCubeletName(object.name)) objects.push(object)
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
  })
  assert.equal(objects.length, 26)
  assert.ok(objects.some((object) => object instanceof THREE.Group))
  const originals = objects.map((object) => ({ parent: object.parent, local: object.matrix.clone(), world: object.matrixWorld.clone() }))
  const originalMaterials = meshes.map((mesh) => mesh.material)
  const geometries = meshes.map((mesh) => mesh.geometry)
  const rig = createCubeRig(scene)
  try {
    scene.updateWorldMatrix(true, true)
    objects.forEach((object, index) => assert.ok(object.matrixWorld.elements.every((value, element) => Math.abs(value - originals[index].world.elements[element]) < 1e-12)))
    meshes.forEach((mesh, index) => {
      assert.notEqual(mesh.material, originalMaterials[index])
      assert.equal(mesh.geometry, geometries[index])
      assert.equal(mesh.castShadow, false)
      assert.equal(mesh.receiveShadow, false)
    })
    const physicalHome = objects.map((object) => ({ position: object.position.clone(), quaternion: object.quaternion.clone() }))
    const f = { face: 'F', direction: 1 } as const
    rig.begin(f)
    assert.equal(rig.advance(0.16, false), false)
    assert.equal(rig.turning, true)
    scene.updateWorldMatrix(true, true)
    const animated = objects.find((object) => object.name === 'cubelet_1_1_1')!
    assert.ok(animated.matrixWorld.elements.some((value, element) => Math.abs(value - originals[objects.indexOf(animated)].world.elements[element]) > 0.1))
    assert.equal(rig.advance(0.16, false), true)
    assert.equal(rig.turning, false)
    const scramble = createScramble()
    for (const move of scramble) { rig.begin(move); assert.equal(rig.advance(0, true), true) }
    // Rotating the inspection/world wrapper cannot alter which local nine turn.
    outer.rotation.set(-1.2, 0.3, 2)
    rig.selectFace('R')
    for (const move of inverseHistory([f, ...scramble])) { rig.begin(move); rig.advance(0, true) }
    assert.deepEqual([...rig.states].sort((a, b) => a.id.localeCompare(b.id)), createSolvedCube().sort((a, b) => a.id.localeCompare(b.id)))
    objects.forEach((object, index) => {
      assert.ok(object.position.distanceTo(physicalHome[index].position) < 1e-12)
      assert.ok(object.quaternion.angleTo(physicalHome[index].quaternion) < 1e-7)
    })
    rig.selectFace(null)
    meshes.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshStandardMaterial
      const original = originalMaterials[index] as THREE.MeshStandardMaterial
      assert.ok(material.emissive.equals(original.emissive))
      assert.equal(material.emissiveIntensity, original.emissiveIntensity)
    })
    // Disposal mid-turn restores supplied hierarchy/transforms, not a partial move.
    rig.begin({ face: 'U', direction: -1 }); rig.advance(0.1, false)
  } finally { rig.dispose() }
  objects.forEach((object, index) => {
    assert.equal(object.parent, originals[index].parent)
    assert.ok(object.matrix.equals(originals[index].local))
  })
  meshes.forEach((mesh, index) => { assert.equal(mesh.material, originalMaterials[index]); assert.equal(mesh.geometry, geometries[index]) })
  assert.throws(() => createCubeRig(new THREE.Group()), /26 named/)
})
