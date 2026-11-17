import assert from 'node:assert/strict'
import test from 'node:test'
import { VOXEL_WORLD, VOXEL_QUALITY } from '../src/config/voxelWorld'
import { STATIONS, SPAWN, WORLD_BOUND } from '../src/config/stations'
import { sampleTerrain, sampleTerrainHeight, sampleTreeSite, sampleFlightFloor } from '../src/lib/voxelTerrain'
import { stationProximity, teleportAircraft } from '../src/lib/flightNavigation'
import { aircraftFloor } from '../src/lib/aircraftClearance'
import { flight } from '../src/lib/flight'
import { baseChunkCoordinates, desiredChunks, generateVoxelChunk, generateVoxelClouds } from '../src/experience/world/generateVoxelWorld'

test('expanded world exceeds 11k units with flight area inside terrain extent', () => {
  assert.equal(VOXEL_WORLD.halfExtent * 2, 11760)
  assert.ok(WORLD_BOUND > 4500 && WORLD_BOUND < VOXEL_WORLD.halfExtent)
  assert.equal(baseChunkCoordinates().length, 196)
})

test('spawn, station centers and inward approach paths remain safe', () => {
  assert.equal(sampleTerrainHeight(SPAWN.x, SPAWN.z), 0)
  assert.ok(sampleFlightFloor(SPAWN.x, SPAWN.z, 0, SPAWN.y) < SPAWN.y)
  for (const site of STATIONS) {
    assert.equal(sampleTerrainHeight(site.pos[0], site.pos[2]), site.pos[1])
    teleportAircraft(site.id)
    assert.ok(flight.y >= aircraftFloor(flight.x, flight.z, flight.heading, flight.y), site.id)
    assert.ok(stationProximity(site.id, flight.x, flight.y, flight.z), `${site.id}: reachable arrival`)
  }
})

test('canonical terrain is deterministic, varied and vertically bounded', () => {
  const heights = new Set<number>()
  const biomes = new Set<string>()
  for (let z = -5600; z <= 5600; z += 140) for (let x = -5600; x <= 5600; x += 140) {
    const a = sampleTerrain(x, z)
    assert.deepEqual(a, sampleTerrain(x, z))
    assert.ok(Number.isFinite(a.height))
    assert.ok(a.height <= VOXEL_WORLD.maxTerrainHeight)
    heights.add(a.height); biomes.add(a.biome)
  }
  assert.ok(heights.size >= 25)
  assert.ok(biomes.has('alpine') && biomes.has('water') && biomes.has('forest') && biomes.has('shore'))
})

test('chunks are reproducible typed batches with bounded near/mid residency', () => {
  for (const quality of ['low', 'medium', 'high'] as const) {
    const cell = VOXEL_QUALITY[quality].nearCell
    const a = generateVoxelChunk(0, 0, cell, quality, true)
    const b = generateVoxelChunk(0, 0, cell, quality, true)
    assert.deepEqual(a, b)
    assert.ok(a.count < 12000)
    assert.ok(desiredChunks(0, 0, quality).length <= 25)
    for (const batch of a.batches) {
      assert.equal(batch.transforms.length, batch.count * 6)
      assert.equal(batch.colors.length, batch.count * 3)
      for (const value of batch.transforms) assert.ok(Number.isFinite(value))
    }
    assert.ok(generateVoxelClouds(quality).count > 0)
  }
})

test('tree locations and dimensions are stable independently of graphics quality', () => {
  let trees = 0
  for (let z = -35; z < 35; z++) for (let x = -35; x < 35; x++) {
    const tree = sampleTreeSite(x, z)
    if (!tree) continue
    trees++
    assert.deepEqual(tree, sampleTreeSite(x, z))
    assert.ok(tree.height <= 64)
  }
  assert.ok(trees > 300)
})
