import type { InspectorEvent } from './types'

type CurlRequest = Pick<InspectorEvent, 'method' | 'url'> & Partial<Pick<InspectorEvent, 'requestHeaders' | 'requestBody' | 'requestBodyType'>>

export function quote(value: unknown): string {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`
}

export function buildCurl(request: CurlRequest | null | undefined): { command: string; error: string } {
  if (!request?.url) return { command: '', error: '请求地址不可用' }
  if (request.requestBodyType === 'hex' || request.requestBodyType === 'form-data') {
    return { command: '', error: '该请求包含二进制或 multipart 数据，无法生成可准确重放的 cURL' }
  }

  const lines = [`curl -X ${quote(request.method || 'GET')} ${quote(request.url)}`]
  for (const [name, rawValue] of Object.entries(request.requestHeaders || {})) {
    if (rawValue === null || rawValue === undefined) continue
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const value of values) lines.push(`-H ${quote(`${name}: ${value}`)}`)
  }
  if (request.requestBody !== undefined && request.requestBody !== null) {
    lines.push(`--data-raw ${quote(request.requestBody)}`)
  }
  return { command: lines.join(' \\\n  '), error: '' }
}
