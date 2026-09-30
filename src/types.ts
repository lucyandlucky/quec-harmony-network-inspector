export interface InspectorEvent {
  phase: 'request' | 'response' | 'error'
  id: number
  time: number
  startedAt: number
  durationMs?: number
  method: string
  url: string
  requestHeaders?: Record<string, unknown>
  requestBody?: string
  requestBodyType?: string
  status?: number
  responseHeaders?: Record<string, unknown>
  responseBody?: string
  responseBodyType?: string
  error?: string
  bundleName: string
  device: string
  sessionId: string
  key: string
}

export interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'disconnected' | 'error'
  serial?: string
  message?: string
}

export interface InspectorBridge {
  listDevices(): Promise<{ devices: string[]; error: string }>
  connect(serial: string): Promise<{ error: string }>
  disconnect(): Promise<void>
  copy(value: string): Promise<void>
  onEvent(callback: (event: InspectorEvent) => void): () => void
  onStatus(callback: (status: ConnectionStatus) => void): () => void
}
