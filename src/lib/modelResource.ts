import { LoadingManager } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { modelRequestPolicy } from './modelAssets'

const resources = new Map<string, Promise<GLTF>>()
const MAX_WAIT_MS = 30000

/** Optional decoder code is loaded only for an explicitly configured compressed asset. */
export function getModelResource(path: string, dracoPath: string | null, revision: number): Promise<GLTF> {
  const key = `${path}:${dracoPath ?? ''}:${revision}`
  const cached = resources.get(key)
  if (cached) return cached
  const promise = (async () => {
    const manager = new LoadingManager()
    const failed = new Set<string>()
    manager.onError = (url) => failed.add(url)
    manager.setURLModifier((url) => modelRequestPolicy(url, path.slice(0, path.lastIndexOf('/') + 1)))
    const loader = new GLTFLoader(manager)
    let disposeDecoder: (() => void) | null = null
    if (dracoPath) {
      if (!dracoPath.startsWith('/models/')) throw new Error('Draco decoder must use a configured local /models/ path.')
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js')
      const decoder = new DRACOLoader(manager).setDecoderPath(dracoPath)
      loader.setDRACOLoader(decoder)
      disposeDecoder = () => decoder.dispose()
    }
    let timeout: number | undefined
    try {
      const timedOut = new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(new Error('Model loading timed out. Check files, buffers and textures, then retry.')), MAX_WAIT_MS) })
      const gltf = await Promise.race([loader.loadAsync(path), timedOut])
      if (failed.size) throw new Error(`Missing model dependency: ${[...failed].join(', ')}`)
      return gltf
    } finally {
      window.clearTimeout(timeout)
      disposeDecoder?.()
    }
  })()
  resources.set(key, promise)
  void promise.catch(() => undefined)
  for (const oldKey of resources.keys()) if (oldKey.startsWith(`${path}:${dracoPath ?? ''}:`) && oldKey !== key) resources.delete(oldKey)
  return promise
}
