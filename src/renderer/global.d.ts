import type { InspectorBridge } from '../types'

declare global {
  interface Window {
    inspector: InspectorBridge
  }
}

export {}
