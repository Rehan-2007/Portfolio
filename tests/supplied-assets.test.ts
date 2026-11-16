import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { MODEL_CONFIG } from '../src/config/models'

function readAsset(path: string) {
  const data = readFileSync(`public${path}`)
  assert.equal(data.readUInt32LE(0), 0x46546c67)
  assert.equal(data.readUInt32LE(4), 2)
  assert.equal(data.readUInt32LE(8), data.length)
  const size = data.readUInt32LE(12)
  return JSON.parse(data.subarray(20, 20 + size).toString('utf8'))
}

test('all five supplied converted assets exist as actual GLBs', () => {
  for (const id of ['aircraft', 'about', 'cube', 'shawarma', 'archive'] as const) {
    assert.ok(MODEL_CONFIG[id].assetPath)
    const json = readAsset(MODEL_CONFIG[id].assetPath!)
    assert.ok(json.meshes.length > 0)
    assert.ok(!json.cameras?.length)
    assert.ok(!json.extensions?.KHR_lights_punctual)
  }
  assert.equal(MODEL_CONFIG.lab.assetPath, null)
})

test('real B-2 preserves all 8154 source triangles and actual PBR channels', () => {
  const json = readAsset(MODEL_CONFIG.aircraft.assetPath!)
  assert.equal(json.meshes.length, 1)
  let triangles = 0
  for (const mesh of json.meshes) for (const part of mesh.primitives) triangles += json.accessors[part.indices].count / 3
  assert.equal(triangles, 8154)
  const material = json.materials[0]
  assert.ok(material.normalTexture)
  assert.ok(material.pbrMetallicRoughness.baseColorTexture)
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture)
  assert.ok(Math.abs(material.pbrMetallicRoughness.roughnessFactor - 0.46) < 1e-6)
  const source = readFileSync('src/experience/FlightSystems.tsx', 'utf8')
  assert.doesNotMatch(source, /<B2Spirit|import.*B2Spirit/)
  assert.match(source, /<ModelSlot id="aircraft"\s*\/>/)
})

test('cube retains 26 named original piece nodes and seven original material colors', () => {
  const json = readAsset(MODEL_CONFIG.cube.assetPath!)
  assert.equal(json.nodes.filter((node: { name?: string }) => node.name?.startsWith('cubelet_')).length, 26)
  assert.equal(json.materials.length, 7)
})

test('private birth date is absent from public configuration and portfolio data', () => {
  for (const path of ['src/config/portfolio.ts', 'src/config/models.ts']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /2007|20 May|2007-05-20/)
  }
})
