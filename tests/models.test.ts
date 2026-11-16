import assert from 'node:assert/strict'
import test from 'node:test'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { existsSync } from 'node:fs'
import { AnimationMixer, Texture } from 'three'
import type { Mesh, MeshStandardMaterial } from 'three'
import { prepareModel, modelRequestPolicy } from '../src/lib/modelAssets'
import { MODEL_CONFIG, validateModelConfig } from '../src/config/models'

// Test-only triangle + translation animation. Not a portfolio/landmark asset.
function fixture(embed: boolean) {
  const buffer = new ArrayBuffer(76)
  new Float32Array(buffer, 0, 9).set([0, 0, 0, 2, 0, 0, 0, 3, 0])
  new Uint16Array(buffer, 36, 3).set([0, 1, 2])
  new Float32Array(buffer, 44, 2).set([0, 1])
  new Float32Array(buffer, 52, 6).set([0, 0, 0, 0, 0, 2])
  const json = {
    asset: { version: '2.0', generator: 'ANTI-AI synthetic regression fixture' }, scene: 0,
    scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'test-piece' }],
    buffers: [{ byteLength: 76, ...(embed ? { uri: `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}` } : {}) }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }, { buffer: 0, byteOffset: 44, byteLength: 8 }, { buffer: 0, byteOffset: 52, byteLength: 24 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [2, 3, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    materials: [{ name: 'fixture-material', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.6, 0.7, 1] } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    animations: [{ name: 'fixture-motion', samplers: [{ input: 2, output: 3 }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] }],
  }
  const text = JSON.stringify(json)
  if (embed) return text
  const bytes = new TextEncoder().encode(text)
  const jsonLength = Math.ceil(bytes.length / 4) * 4
  const output = new ArrayBuffer(12 + 8 + jsonLength + 8 + buffer.byteLength)
  const view = new DataView(output)
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, output.byteLength, true)
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(output, 20, jsonLength).fill(32); new Uint8Array(output, 20, bytes.length).set(bytes)
  view.setUint32(20 + jsonLength, buffer.byteLength, true); view.setUint32(24 + jsonLength, 0x004e4942, true)
  new Uint8Array(output, 28 + jsonLength).set(new Uint8Array(buffer))
  return output
}

if (typeof ProgressEvent === 'undefined') {
  Object.assign(globalThis, { ProgressEvent: class extends Event { lengthComputable = false; loaded = 0; total = 0 } })
}

test('production slots contain no invented asset paths', () => {
  for (const config of Object.values(MODEL_CONFIG)) {
    if (config.assetPath) assert.ok(existsSync(`public${config.assetPath}`), config.assetPath)
    assert.equal(validateModelConfig(config), null)
  }
})

test('actual GLB and GLTF parsers read geometry, dimensions, materials and animation', async () => {
  for (const embed of [false, true]) {
    const gltf = await new GLTFLoader().parseAsync(fixture(embed), '')
    const prepared = prepareModel(gltf)
    assert.equal(prepared.inspection.meshes, 1)
    assert.equal(prepared.inspection.triangles, 1)
    assert.deepEqual(prepared.inspection.dimensions, [2, 3, 0])
    assert.deepEqual(prepared.inspection.animations, ['fixture-motion'])
    const mixer = new AnimationMixer(prepared.scene)
    mixer.clipAction(gltf.animations[0]).play()
    mixer.update(0.5)
    assert.ok(Math.abs(prepared.scene.getObjectByName('test-piece')!.position.z - 1) < 1e-6)
    mixer.stopAllAction(); mixer.uncacheRoot(prepared.scene)
    prepared.dispose()
  }
})

test('import policy removes instance shadows/AO without mutating source assets', async () => {
  const gltf = await new GLTFLoader().parseAsync(fixture(false), '')
  const source = gltf.scene.getObjectByName('test-piece') as Mesh
  source.castShadow = source.receiveShadow = true
  const material = source.material as MeshStandardMaterial
  material.aoMap = new Texture()
  const prepared = prepareModel(gltf)
  const copy = prepared.scene.getObjectByName('test-piece') as Mesh
  assert.equal(copy.castShadow, false)
  assert.equal(copy.receiveShadow, false)
  assert.equal((copy.material as MeshStandardMaterial).aoMap, null)
  assert.equal(source.castShadow, true)
  assert.ok(material.aoMap)
  assert.notEqual(copy.material, source.material)
  assert.equal(copy.geometry, source.geometry)
  prepared.dispose(); material.aoMap.dispose()
})

test('invalid model data fails, and remote dependency escapes are rejected', async () => {
  await assert.rejects(new GLTFLoader().parseAsync('{broken json', ''))
  assert.throws(() => modelRequestPolicy('https://untrusted.invalid/texture.png', '/models/laptop/'))
  assert.throws(() => modelRequestPolicy('../../outside.png', '/models/laptop/'))
  assert.equal(modelRequestPolicy('texture.png', '/models/laptop/'), 'http://localhost/models/laptop/texture.png')
  const config = { ...MODEL_CONFIG.about, assetPath: '/missing.glb' }
  assert.ok(validateModelConfig(config))
})
