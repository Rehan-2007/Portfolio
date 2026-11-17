import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ESSENTIAL_MODELS, readinessPrerequisites } from '../src/lib/sceneReadiness'
import type { ModelStatus } from '../src/stores/useModelAssets'
import { useScenePreparation } from '../src/stores/useScenePreparation'

const allReady = () => Object.fromEntries(ESSENTIAL_MODELS.map((id) => [id, { phase: 'ready', revision: 0 } satisfies ModelStatus]))

test('complete reveal requires renderer, entire terrain and every essential current asset', () => {
  const input = { rendererReady: true, terrainComplete: true, statuses: allReady(), revisions: {} }
  assert.equal(ESSENTIAL_MODELS.length, 5)
  assert.equal(readinessPrerequisites(input).ready, true)
  assert.equal(readinessPrerequisites({ ...input, terrainComplete: false }).ready, false)
  assert.equal(readinessPrerequisites({ ...input, rendererReady: false }).ready, false)
  for (const id of ESSENTIAL_MODELS) {
    const statuses = { ...allReady(), [id]: { phase: 'loading' } satisfies ModelStatus }
    assert.equal(readinessPrerequisites({ ...input, statuses }).ready, false)
  }
})

test('failed resources surface error and stale model revision cannot pass', () => {
  const statuses = { ...allReady(), archive: { phase: 'error', message: 'missing texture' } satisfies ModelStatus }
  assert.match(readinessPrerequisites({ rendererReady: true, terrainComplete: true, statuses, revisions: {} }).error!, /missing texture/)
  assert.equal(readinessPrerequisites({ rendererReady: true, terrainComplete: true, statuses: allReady(), revisions: { archive: 1 } }).ready, false)
})

test('quality preparation is explicit and stale warmup cannot reveal a replacement', () => {
  const store = useScenePreparation.getState()
  store.begin('low')
  const epoch = useScenePreparation.getState().epoch
  store.begin('high')
  store.complete(epoch)
  assert.equal(useScenePreparation.getState().ready, false)
  store.complete(useScenePreparation.getState().epoch)
  assert.equal(useScenePreparation.getState().ready, true)
  store.contextLost()
  assert.equal(useScenePreparation.getState().ready, false)
})

test('terrain no longer follows flight position or mounts quality-keyed subtrees', () => {
  const hook = readFileSync('src/experience/world/useVoxelChunks.ts', 'utf8')
  assert.doesNotMatch(hook, /flight\.x|flight\.z|moveTimer|desiredChunks\(/)
  const composition = readFileSync('src/experience/WorldEnvironment.tsx', 'utf8')
  assert.doesNotMatch(composition, /VoxelTerrain key=\{quality\}/)
  const ready = readFileSync('src/experience/SceneReadiness.tsx', 'utf8')
  assert.match(ready, /gl\.initTexture/)
  assert.match(ready, /gl\.compileAsync/)
  assert.match(ready, /gl\.render/)
})
