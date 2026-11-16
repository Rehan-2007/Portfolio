import assert from 'node:assert/strict'
import test from 'node:test'
import { createB2Geometry, sampleB2Surface } from '../src/lib/b2Geometry'

test('B-2 geometry preserves span/chord, finite normals and reasonable triangle counts', () => {
  for (const quality of ['low', 'medium', 'high'] as const) {
    const parts = createB2Geometry(quality)
    const box = parts.hull.boundingBox!
    assert.ok(Math.abs(box.max.x - box.min.x - 56) < 1e-5)
    assert.ok(Math.abs(box.max.z - box.min.z - 23) < 1e-5)
    let triangles = 0
    for (const [name, geometry] of Object.entries(parts)) {
      for (const number of geometry.attributes.position.array) assert.ok(Number.isFinite(number), name)
      if (geometry.attributes.normal) for (const number of geometry.attributes.normal.array) assert.ok(Number.isFinite(number), `${name}: normal`)
      triangles += (geometry.index?.count ?? 0) / 3
      geometry.dispose()
    }
    assert.ok(triangles > 5000 && triangles < 26000, `${quality}: ${triangles}`)
  }
})

test('upper/lower hull is symmetric and tapers toward the tips', () => {
  for (let x = 0; x <= 28; x += 0.7) for (let u = 0; u <= 1; u += 0.1) {
    const left = sampleB2Surface(-x, u)
    const right = sampleB2Surface(x, u)
    assert.deepEqual(left, right)
    assert.ok(left.top > left.bottom)
  }
  assert.ok(sampleB2Surface(0, 0.4).top > sampleB2Surface(25, 0.4).top * 3)
})
