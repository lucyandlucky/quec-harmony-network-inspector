import path from 'node:path'
import { app, BrowserWindow, clipboard, ipcMain } from 'electron'
import { findHdc, listDevices, HdcCollector } from './collector'
import type { ConnectionStatus, InspectorEvent } from './types'

let window: BrowserWindow | null = null
let collector: HdcCollector | null = null

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function send(channel: string, payload: ConnectionStatus | InspectorEvent): void {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

function createWindow(): void {
  window = new BrowserWindow({
    title: 'Quec Network Inspector',
    width: 1320,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f6f8f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  const devUrl = process.env.QNI_RENDERER_URL
  if (devUrl?.startsWith('http://127.0.0.1:')) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'))
  }
  if (process.env.QNI_DEVTOOLS === '1') window.webContents.openDevTools()
}

void app.whenReady().then(() => {
  app.setName('Quec Network Inspector')
  createWindow()
  ipcMain.handle('devices:list', async () => {
    try {
      return { devices: await listDevices(findHdc()), error: '' }
    } catch (error) {
      return { devices: [], error: messageOf(error) }
    }
  })
  ipcMain.handle('collector:connect', (_event, serial: unknown) => {
    if (typeof serial !== 'string' || !serial.trim()) return { error: '请选择设备' }
    try {
      if (collector) collector.stop()
      collector = new HdcCollector(findHdc())
      collector.on('status', (status: ConnectionStatus) => send('collector:status', status))
      collector.on('event', (event: InspectorEvent) => send('collector:event', event))
      collector.start(serial)
      return { error: '' }
    } catch (error) {
      return { error: messageOf(error) }
    }
  })
  ipcMain.handle('collector:disconnect', () => {
    if (collector) collector.stop()
  })
  ipcMain.handle('clipboard:write', (_event, value: unknown) => {
    if (typeof value === 'string') clipboard.writeText(value)
  })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => { if (collector) collector.stop() })
