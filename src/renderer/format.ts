import type { InspectorEvent } from '../types'

export function requestPath(value: string): string {
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search}` || '/'
  } catch {
    return value || '/'
  }
}

export function requestHost(value: string): string {
  try { return new URL(value).host } catch { return '' }
}

export function timeOf(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '-'
}

export function dateTimeOf(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

export function statusOf(item: InspectorEvent): { label: string; className: string } {
  if (item.phase === 'request') return { label: '等待', className: 'pending' }
  if (item.phase === 'error' && !item.status) return { label: '错误', className: 'error' }
  if (typeof item.status === 'number' && Number.isFinite(item.status)) {
    return { label: String(item.status), className: item.status >= 400 || item.phase === 'error' ? 'error' : '' }
  }
  return { label: '错误', className: 'error' }
}

export function durationOf(item: InspectorEvent): string {
  return typeof item.durationMs === 'number' && Number.isFinite(item.durationMs) ? `${item.durationMs} ms` : '-'
}
