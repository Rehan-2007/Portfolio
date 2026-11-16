import { generateVoxelChunk } from './generateVoxelWorld'
import type { ChunkRequest, ChunkResponse } from './voxelTypes'

self.onmessage = (event: MessageEvent<ChunkRequest>) => {
  const request = event.data
  try {
    const chunk = generateVoxelChunk(request.cx, request.cz, request.cellSize, request.quality, request.detail)
    const response: ChunkResponse = { id: request.id, chunk }
    const transfers = chunk.batches.flatMap((batch) => [batch.transforms.buffer, batch.colors.buffer])
    self.postMessage(response, { transfer: transfers })
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) } satisfies ChunkResponse)
  }
}
