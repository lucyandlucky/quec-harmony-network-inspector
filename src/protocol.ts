import type { InspectorEvent } from './types'

const LOG_LINE = /\bA0514C\/(?:([^/\s:]+)\/)?QuecInspector:\s*(QNI1\|.*)$/i
const FRAME = /^QNI1\|([a-z0-9]+)\|(\d+)\|(\d+)\/(\d+)\|(.+)$/

interface PendingFrame {
  chunks: (string | undefined)[]
  received: number
  createdAt: number
}

function isInspectorPayload(value: unknown): value is Omit<InspectorEvent, 'bundleName' | 'device' | 'sessionId' | 'key'> & { bundleName?: string } {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Partial<InspectorEvent>
  return (payload.phase === 'request' || payload.phase === 'response' || payload.phase === 'error') &&
    Number.isSafeInteger(payload.id) && typeof payload.method === 'string' && typeof payload.url === 'string'
}

export class FrameAssembler {
  private readonly pending = new Map<string, PendingFrame>()
  private readonly completed = new Set<string>()

  addLine(line: string, device: string): InspectorEvent | null {
    const log = LOG_LINE.exec(line)
    if (!log) return null
    const frame = FRAME.exec(log[2])
    if (!frame) return null

    const [, sessionId, eventId, partText, totalText, chunk] = frame
    const part = Number(partText)
    const total = Number(totalText)
    if (!Number.isSafeInteger(part) || !Number.isSafeInteger(total) || total < 1 || total > 20000 || part < 1 || part > total) {
      return null
    }

    const frameKey = `${device}|${sessionId}|${eventId}`
    if (this.completed.has(frameKey)) return null
    let entry = this.pending.get(frameKey)
    if (!entry) {
      entry = { chunks: new Array<string | undefined>(total), received: 0, createdAt: Date.now() }
      this.pending.set(frameKey, entry)
    }
    if (entry.chunks.length !== total) {
      this.pending.delete(frameKey)
      return null
    }
    if (entry.chunks[part - 1] === undefined) {
      entry.chunks[part - 1] = chunk
      entry.received += 1
    }
    if (entry.received !== total) {
      this.prune()
      return null
    }

    this.pending.delete(frameKey)
    try {
      const payload: unknown = JSON.parse(decodeURIComponent(entry.chunks.join('')))
      if (!isInspectorPayload(payload)) return null
      const bundleName = typeof payload.bundleName === 'string' && payload.bundleName.trim()
        ? payload.bundleName : log[1] || '未知应用'
      this.completed.add(frameKey)
      if (this.completed.size > 5000) this.completed.delete(this.completed.values().next().value!)
      return { ...payload, bundleName, device, sessionId, key: `${device}|${bundleName}|${sessionId}|${payload.id}` }
    } catch {
      return null
    }
  }

  private prune(): void {
    if (this.pending.size < 100) return
    const cutoff = Date.now() - 30000
    for (const [key, entry] of this.pending) {
      if (entry.createdAt < cutoff) this.pending.delete(key)
    }
    while (this.pending.size > 200) this.pending.delete(this.pending.keys().next().value!)
  }
}
