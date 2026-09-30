'use strict';

const LOG_LINE = /\bA0514C\/([^/\s]+)\/QuecInspector:\s*(QNI1\|.*)$/;
const FRAME = /^QNI1\|([a-z0-9]+)\|(\d+)\|(\d+)\/(\d+)\|(.+)$/;

class FrameAssembler {
  constructor() {
    this.pending = new Map();
    this.completed = new Set();
  }

  addLine(line, device) {
    const log = LOG_LINE.exec(line);
    if (!log) return null;
    const frame = FRAME.exec(log[2]);
    if (!frame) return null;

    const [, sessionId, eventId, partText, totalText, chunk] = frame;
    const part = Number(partText);
    const total = Number(totalText);
    if (!Number.isSafeInteger(part) || !Number.isSafeInteger(total) || total < 1 || total > 20000 || part < 1 || part > total) {
      return null;
    }

    const bundleName = log[1];
    const key = `${device}|${bundleName}|${sessionId}|${eventId}`;
    if (this.completed.has(key)) return null;
    let entry = this.pending.get(key);
    if (!entry) {
      entry = { chunks: new Array(total), received: 0, createdAt: Date.now() };
      this.pending.set(key, entry);
    }
    if (entry.chunks.length !== total) {
      this.pending.delete(key);
      return null;
    }
    if (entry.chunks[part - 1] === undefined) {
      entry.chunks[part - 1] = chunk;
      entry.received += 1;
    }
    if (entry.received !== total) {
      this.prune();
      return null;
    }

    this.pending.delete(key);
    try {
      const payload = JSON.parse(decodeURIComponent(entry.chunks.join('')));
      if (!payload || !['request', 'response', 'error'].includes(payload.phase) ||
          !Number.isSafeInteger(payload.id) || typeof payload.method !== 'string' ||
          typeof payload.url !== 'string') {
        return null;
      }
      this.completed.add(key);
      if (this.completed.size > 5000) this.completed.delete(this.completed.values().next().value);
      return { ...payload, bundleName, device, sessionId, key: `${device}|${bundleName}|${sessionId}|${payload.id}` };
    } catch (_) {
      return null;
    }
  }

  prune() {
    if (this.pending.size < 100) return;
    const cutoff = Date.now() - 30000;
    for (const [key, entry] of this.pending) {
      if (entry.createdAt < cutoff) this.pending.delete(key);
    }
    while (this.pending.size > 200) this.pending.delete(this.pending.keys().next().value);
  }
}

module.exports = { FrameAssembler };
