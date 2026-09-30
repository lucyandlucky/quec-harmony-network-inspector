import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionStatus, InspectorBridge, InspectorEvent } from './types'

const bridge: InspectorBridge = {
  listDevices: () => ipcRenderer.invoke('devices:list'),
  connect: (serial) => ipcRenderer.invoke('collector:connect', serial),
  disconnect: () => ipcRenderer.invoke('collector:disconnect'),
  copy: (value) => ipcRenderer.invoke('clipboard:write', value),
  onEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: InspectorEvent): void => callback(payload)
    ipcRenderer.on('collector:event', listener)
    return () => ipcRenderer.removeListener('collector:event', listener)
  },
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: ConnectionStatus): void => callback(payload)
    ipcRenderer.on('collector:status', listener)
    return () => ipcRenderer.removeListener('collector:status', listener)
  }
}

contextBridge.exposeInMainWorld('inspector', bridge)
