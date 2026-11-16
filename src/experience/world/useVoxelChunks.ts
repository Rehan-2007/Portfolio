import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { QualityLevel } from '../../stores/useExperienceStore'
import { generateVoxelChunk } from './generateVoxelWorld'
import { fixedWorldManifest } from './fixedWorldManifest'
import type { ChunkRequest, ChunkResponse, VoxelChunkData } from './voxelTypes'

export interface ChunkSnapshot {
  chunks: VoxelChunkData[]
  generated: number
  total: number
  detailed: number
  cached: number
  generationMs: number
  error: string | null
  /** Quality of the fully published world, not the in-flight request. */
  quality: QualityLevel | null
  preparing: boolean
}

interface WorldProgress {
  generated: number
  total: number
  generationMs: number
  error: string | null
  preparing: boolean
  world: ChunkSnapshot | null
}
interface GenerationJob {
  progress: WorldProgress
  listeners: Set<(progress: WorldProgress) => void>
}

// Jobs survive subscriber cleanup (including StrictMode) and cache only complete worlds.
// There are exactly three QualityLevels, so this cache cannot grow beyond three worlds.
const completedWorlds = new Map<QualityLevel, ChunkSnapshot>()
const jobs = new Map<QualityLevel, GenerationJob>()
const TASK_TIMEOUT_MS = 10_000
const WORLD_TIMEOUT_MS = 120_000

function validChunk(chunk: VoxelChunkData, request: ChunkRequest): boolean {
  return !!chunk && chunk.cx === request.cx && chunk.cz === request.cz && chunk.cellSize === request.cellSize
    && typeof chunk.key === 'string' && Array.isArray(chunk.centre) && chunk.centre.length === 3
    && chunk.centre.every(Number.isFinite) && Number.isFinite(chunk.radius)
    && Array.isArray(chunk.batches) && Number.isInteger(chunk.count) && chunk.count >= 0
    && chunk.batches.every((batch) => !!batch && Number.isInteger(batch.count) && batch.count > 0
      && batch.transforms instanceof Float32Array && batch.colors instanceof Float32Array
      && batch.transforms.length === batch.count * 6 && batch.colors.length === batch.count * 3)
    && chunk.batches.reduce((count, batch) => count + batch.count, 0) === chunk.count
}

function startWorld(quality: QualityLevel): GenerationJob {
  const manifest = fixedWorldManifest(quality)
  const job: GenerationJob = {
    progress: { generated: 0, total: manifest.length, generationMs: 0, error: null, preparing: true, world: null },
    listeners: new Set(),
  }
  jobs.set(quality, job)
  const queue: ChunkRequest[] = manifest.map((item, index) => ({ id: index + 1, cx: item.cx, cz: item.cz, cellSize: item.cellSize, detail: item.detail, quality }))
  const chunks: VoxelChunkData[] = []
  let worker: Worker | null = null
  let outstanding: ChunkRequest | null = null
  let taskTimer: ReturnType<typeof setTimeout> | undefined
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  let worldTimer: ReturnType<typeof setTimeout> | undefined
  let started = 0
  let spent = 0
  let finished = false
  const worldStarted = performance.now()

  const notify = (progress: WorldProgress) => {
    job.progress = progress
    for (const listener of job.listeners) listener(progress)
  }
  const stop = () => {
    finished = true
    clearTimeout(taskTimer)
    clearTimeout(fallbackTimer)
    clearTimeout(worldTimer)
    worker?.terminate()
    worker = null
    outstanding = null
    queue.length = 0
    jobs.delete(quality)
  }
  const fail = (error: string) => {
    if (finished) return
    const generated = chunks.length
    const generationMs = spent + (outstanding ? performance.now() - started : 0)
    stop()
    chunks.length = 0
    notify({ generated, total: manifest.length, generationMs, error, preparing: false, world: null })
    job.listeners.clear()
  }
  const accept = (response: ChunkResponse) => {
    if (finished) return
    const request = outstanding
    if (!request || !response || response.id !== request.id) {
      fail('Voxel worker returned an unexpected task response')
      return
    }
    if (performance.now() - worldStarted >= WORLD_TIMEOUT_MS || performance.now() - started >= TASK_TIMEOUT_MS) {
      fail(`Voxel generation timed out at chunk ${request.cx}:${request.cz}`)
      return
    }
    clearTimeout(taskTimer)
    spent += performance.now() - started
    outstanding = null
    if ('error' in response) {
      fail(`Voxel chunk ${request.cx}:${request.cz} failed: ${response.error}`)
      return
    }
    if (!validChunk(response.chunk, request)) {
      fail(`Voxel chunk ${request.cx}:${request.cz} returned invalid typed buffers`)
      return
    }
    chunks.push(response.chunk)
    if (chunks.length === manifest.length) {
      const world: ChunkSnapshot = { chunks, generated: chunks.length, total: manifest.length, detailed: manifest.filter((item) => item.detail).length, cached: chunks.length, generationMs: spent, error: null, quality, preparing: false }
      completedWorlds.set(quality, world)
      stop()
      notify({ generated: world.generated, total: world.total, generationMs: spent, error: null, preparing: false, world })
      job.listeners.clear()
    } else {
      if (chunks.length % 8 === 0) notify({ generated: chunks.length, total: manifest.length, generationMs: spent, error: null, preparing: true, world: null })
      pump()
    }
  }
  const pump = () => {
    if (finished || outstanding || !queue.length) return
    if (performance.now() - worldStarted >= WORLD_TIMEOUT_MS) {
      fail('Voxel world generation exceeded the 120-second deadline')
      return
    }
    const request = queue.shift()!
    outstanding = request
    started = performance.now()
    taskTimer = setTimeout(() => fail(`Voxel chunk ${request.cx}:${request.cz} exceeded the 10-second task deadline`), TASK_TIMEOUT_MS)
    if (worker) {
      try { worker.postMessage(request) }
      catch (error) { fail(`Voxel worker could not dispatch a chunk: ${String(error)}`) }
    } else {
      // Constructor unavailable: yield between chunks, never generate the whole map synchronously.
      fallbackTimer = setTimeout(() => {
        if (finished) return
        try { accept({ id: request.id, chunk: generateVoxelChunk(request.cx, request.cz, request.cellSize, quality, request.detail) }) }
        catch (error) { fail(`Voxel fallback generation failed: ${String(error)}`) }
      }, 0)
    }
  }

  try { worker = new Worker(new URL('./voxel.worker.ts', import.meta.url), { type: 'module' }) }
  catch { worker = null }
  if (worker) {
    worker.onmessage = (event: MessageEvent<ChunkResponse>) => accept(event.data)
    worker.onerror = (event) => { event.preventDefault(); fail(`Voxel worker failed: ${event.message || 'unknown worker error'}`) }
    worker.onmessageerror = () => fail('Voxel worker could not deserialize a chunk')
  }
  worldTimer = setTimeout(() => fail('Voxel world generation exceeded the 120-second deadline'), WORLD_TIMEOUT_MS)
  pump()
  return job
}

function subscribeWorld(quality: QualityLevel, listener: (progress: WorldProgress) => void): () => void {
  const cached = completedWorlds.get(quality)
  if (cached) {
    listener({ generated: cached.generated, total: cached.total, generationMs: cached.generationMs, error: null, preparing: false, world: cached })
    return () => {}
  }
  const job = jobs.get(quality) ?? startWorld(quality)
  job.listeners.add(listener)
  listener(job.progress)
  return () => { job.listeners.delete(listener) }
}

function initialSnapshot(quality: QualityLevel): ChunkSnapshot {
  return completedWorlds.get(quality) ?? { chunks: [], generated: 0, total: fixedWorldManifest(quality).length, detailed: 0, cached: 0, generationMs: 0, error: null, quality: null, preparing: true }
}

export function useVoxelChunks(quality: QualityLevel): ChunkSnapshot {
  const [snapshot, setSnapshot] = useState<ChunkSnapshot>(() => initialSnapshot(quality))
  const requestRef = useRef(quality)
  useLayoutEffect(() => { requestRef.current = quality }, [quality])
  useEffect(() => {
    let active = true
    const unsubscribe = subscribeWorld(quality, (progress) => {
      if (!active || requestRef.current !== quality) return
      setSnapshot((previous) => {
        if (!active || requestRef.current !== quality) return previous
        if (progress.world) return progress.world
        // Preserve the last complete world throughout preparation or a failed replacement.
        return { ...previous, generated: progress.generated, total: progress.total, generationMs: progress.generationMs, error: progress.error, preparing: progress.preparing }
      })
    })
    return () => { active = false; unsubscribe() }
  }, [quality])
  // A prop change can render before its effect subscribes: never report the old world as ready.
  return snapshot.quality !== quality && !snapshot.error ? { ...snapshot, preparing: true } : snapshot
}
