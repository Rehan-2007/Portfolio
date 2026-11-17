import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PerspectiveCamera, Vector3 } from 'three'
import { MODEL_CONFIG } from '../src/config/models'
import { STATIONS } from '../src/config/stations'
import { LANDMARK_GEOMETRY, getLandmarkPadRadius } from '../src/config/landmarkGeometry'
import { getLandmarkBounds } from '../src/lib/landmarkBounds'
import { landmarkCameraPose } from '../src/lib/landmarkCamera'
import { sampleTerrain } from '../src/lib/voxelTerrain'

test('archive is exactly 2x and wrap exactly 3x their prior uniform scales', () => {
  assert.equal(MODEL_CONFIG.archive.scale, 1.75 * 2)
  assert.equal(MODEL_CONFIG.shawarma.scale, 2.5 * 3)
  const a = getLandmarkBounds('archive').getSize(new Vector3())
  const w = getLandmarkBounds('shawarma').getSize(new Vector3())
  for (const [actual, expected] of [[a.x, 329], [a.y, 238], [a.z, 332.5], [w.x, 18.69672], [w.y, 60], [w.z, 19.055745]]) assert.ok(Math.abs(actual - expected) < 1e-5)
  assert.equal(MODEL_CONFIG.about.scale, 20)
  assert.equal(MODEL_CONFIG.cube.scale, 50)
  assert.equal(MODEL_CONFIG.aircraft.scale, 4)
})

test('all destination footprints have separate balanced space and matching site/model centers', () => {
  for (const site of STATIONS) {
    const model = MODEL_CONFIG[site.id]
    assert.equal(model.position[0], site.pos[0])
    assert.equal(model.position[2], site.pos[2])
    for (const other of STATIONS) {
      if (other.id === site.id) continue
      assert.ok(Math.hypot(site.pos[0] - other.pos[0], site.pos[2] - other.pos[2]) > 700)
      assert.ok(!getLandmarkBounds(site.id).intersectsBox(getLandmarkBounds(other.id)))
    }
  }
})

test('resized model footprint and graded pad remain flat without trees or water', () => {
  for (const site of STATIONS) {
    const bounds = getLandmarkBounds(site.id)
    for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
      const sample = sampleTerrain(x, z)
      assert.equal(sample.height, site.pos[1], site.id)
      assert.equal(sample.water, false)
      assert.equal(sample.forest, false)
    }
    assert.ok(getLandmarkPadRadius(site.id) > Math.hypot(...LANDMARK_GEOMETRY[site.id].sitePadDimensions) / 2)
  }
})

test('landmark inspection frames every measured bound corner in desktop and portrait', () => {
  for (const id of ['about', 'cube', 'archive', 'shawarma'] as const) for (const aspect of [16 / 9, 390 / 844]) {
    const pose = landmarkCameraPose(id, 62, aspect)
    const camera = new PerspectiveCamera(62, aspect, 0.5, 19000)
    camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld()
    const bounds = getLandmarkBounds(id)
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new Vector3(x, y, z).project(camera)
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `${id}: ${aspect}`)
    }
  }
})

test('original archive and wrap GLB bytes remain unchanged', () => {
  const hashes = {
    archive: '5de9ef538090bca44ec4de65005daca4b3b62026dfb7984f8b026c836b1a91d1',
    shawarma: '1d521f2f2594aa1bc556b6dd9c7d537056bc05159fe64ee8adebcc070756821b',
  }
  for (const id of ['archive', 'shawarma'] as const) assert.equal(createHash('sha256').update(readFileSync(`public${MODEL_CONFIG[id].assetPath}`)).digest('hex'), hashes[id])
})
