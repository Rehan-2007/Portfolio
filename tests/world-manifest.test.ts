import assert from 'node:assert/strict'
import test from 'node:test'
import { SPAWN, STATIONS } from '../src/config/stations'
import { VOXEL_QUALITY, VOXEL_WORLD } from '../src/config/voxelWorld'
import { flight } from '../src/lib/flight'
import { baseChunkCoordinates, generateVoxelChunk } from '../src/experience/world/generateVoxelWorld'
import { FIXED_WORLD_LOD, fixedWorldManifest } from '../src/experience/world/fixedWorldManifest'

const qualities = ['low', 'medium', 'high'] as const
const key = (cx: number, cz: number) => `${cx}:${cz}`

test('fixed manifests contain all 196 coordinates exactly once and are immutable', () => {
  const expected = new Set(baseChunkCoordinates().map(([cx, cz]) => key(cx, cz)))
  for (const quality of qualities) {
    const manifest = fixedWorldManifest(quality)
    assert.equal(manifest.length, 196)
    assert.deepEqual(new Set(manifest.map((item) => key(item.cx, item.cz))), expected)
    assert.ok(Object.isFrozen(manifest))
    for (const item of manifest) {
      assert.ok(Object.isFrozen(item))
      assert.ok(item.cellSize > 0 && VOXEL_WORLD.chunkSize % item.cellSize === 0)
    }
    assert.strictEqual(manifest, fixedWorldManifest(quality))
  }
})

test('flight across the map never changes final LODs or manifest identity', () => {
  const original = { x: flight.x, z: flight.z }
  try {
    for (const quality of qualities) {
      const manifest = fixedWorldManifest(quality)
      const serialized = JSON.stringify(manifest)
      for (const [x, z] of [[0, 0], [-5200, -5200], [5200, 5200], [1800, -2200]]) {
        flight.x = x
        flight.z = z
        assert.strictEqual(fixedWorldManifest(quality), manifest)
        assert.equal(JSON.stringify(fixedWorldManifest(quality)), serialized)
      }
    }
  } finally { Object.assign(flight, original) }
})

test('site/spawn detail uses fixed fine and immediate-neighbor budgets', () => {
  const size = VOXEL_WORLD.chunkSize
  const anchors = [{ x: SPAWN.x, z: SPAWN.z }, ...STATIONS.map((site) => ({ x: site.pos[0], z: site.pos[2] }))]
  const cores = new Set(anchors.map((anchor) => key(Math.floor(anchor.x / size), Math.floor(anchor.z / size))))
  for (const quality of qualities) {
    const lod = FIXED_WORLD_LOD[quality]
    const manifest = fixedWorldManifest(quality)
    const fine = manifest.filter((item) => item.cellSize === lod.fineCell)
    const halo = manifest.filter((item) => item.cellSize === lod.haloCell)
    assert.equal(fine.length, lod.fineLimit)
    assert.ok(halo.length > 0 && halo.length <= lod.haloLimit)
    assert.equal(manifest.filter((item) => item.detail).length, fine.length + halo.length)
    assert.ok(cores.size <= lod.fineLimit, 'canonical destinations must fit the fixed fine budget')
    for (const core of cores) assert.ok(fine.some((item) => key(item.cx, item.cz) === core), core)
    for (const item of manifest) {
      if (item.detail) assert.ok(anchors.some((anchor) => Math.abs(item.cx - Math.floor(anchor.x / size)) <= 1 && Math.abs(item.cz - Math.floor(anchor.z / size)) <= 1))
      else assert.equal(item.cellSize, VOXEL_QUALITY[quality].farCell)
    }
    const estimate = manifest.reduce((count, item) => count + item.estimatedInstances, 0)
    assert.ok(estimate < 300_000, `${quality} estimated instances: ${estimate}`)
    if (quality === 'low') assert.ok(estimate < 120_000)
  }
})

test('every final chunk is valid typed-buffer geometry within the world instance budget', () => {
  for (const quality of qualities) {
    const keys = new Set<string>()
    let instances = 0
    for (const item of fixedWorldManifest(quality)) {
      const chunk = generateVoxelChunk(item.cx, item.cz, item.cellSize, quality, item.detail)
      assert.ok(chunk)
      assert.equal(chunk.cx, item.cx)
      assert.equal(chunk.cz, item.cz)
      assert.equal(chunk.cellSize, item.cellSize)
      assert.ok(!keys.has(chunk.key))
      keys.add(chunk.key)
      assert.ok(Array.isArray(chunk.batches))
      assert.equal(chunk.count, chunk.batches.reduce((count, batch) => count + batch.count, 0))
      for (const batch of chunk.batches) {
        assert.ok(batch.transforms instanceof Float32Array)
        assert.ok(batch.colors instanceof Float32Array)
        assert.equal(batch.transforms.length, batch.count * 6)
        assert.equal(batch.colors.length, batch.count * 3)
        for (const value of batch.transforms) assert.ok(Number.isFinite(value))
        for (const value of batch.colors) assert.ok(Number.isFinite(value))
      }
      instances += chunk.count
    }
    assert.equal(keys.size, 196)
    assert.ok(instances < 300_000, `${quality} actual instances: ${instances}`)
    if (quality === 'low') assert.ok(instances < 120_000)
  }
})
