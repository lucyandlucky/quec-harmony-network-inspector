import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { FrameAssembler } from './protocol'
import type { ConnectionStatus, InspectorEvent } from './types'

export function findHdc(): string {
  const sdk = process.env.DEVECO_SDK_HOME
  const binary = process.platform === 'win32' ? 'hdc.exe' : 'hdc'
  const candidates = [
    process.env.HDC_PATH,
    sdk && path.join(sdk, 'default', 'openharmony', 'toolchains', binary),
    sdk && path.join(sdk, 'default', 'toolchains', binary),
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',
    ...String(process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, binary))
  ]
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate))
  if (!found) throw new Error('未找到 hdc。请安装 DevEco Studio，或设置 HDC_PATH。')
  return found
}

export function listDevices(hdcPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(hdcPath, ['list', 'targets'], { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr).trim() || error.message))
      const devices = String(stdout).split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0])
        .filter((line) => line && line !== '[Empty]' && !line.startsWith('['))
      resolve(devices)
    })
  })
}

export class HdcCollector extends EventEmitter {
  private readonly hdcPath: string
  private readonly assembler = new FrameAssembler()
  private child: ChildProcess | null = null
  private serial = ''
  private buffer = ''
  private stderr = ''

  constructor(hdcPath: string) {
    super()
    this.hdcPath = hdcPath
  }

  start(serial: string): void {
    this.stop()
    this.serial = serial
    this.buffer = ''
    this.stderr = ''
    const child = spawn(this.hdcPath,
      ['-t', serial, 'shell', 'hilog', '-D', '0x514C', '-T', 'QuecInspector'],
      { stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    child.on('spawn', () => this.emit('status', { state: 'connected', serial } satisfies ConnectionStatus))
    child.on('error', (error) => this.emit('status', { state: 'error', serial, message: error.message } satisfies ConnectionStatus))
    child.on('close', (code) => {
      if (this.child !== child) return
      this.child = null
      this.emit('status', {
        state: 'disconnected', serial,
        message: this.stderr.trim() || (code ? `hdc 已退出 (${code})` : '')
      } satisfies ConnectionStatus)
    })
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (data: string) => this.consume(data, serial))
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (data: string) => { this.stderr = (this.stderr + data).slice(-2000) })
  }

  private consume(data: string, serial: string): void {
    this.buffer += data
    let newline = this.buffer.indexOf('\n')
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '')
      this.buffer = this.buffer.slice(newline + 1)
      const event: InspectorEvent | null = this.assembler.addLine(line, serial)
      if (event) this.emit('event', event)
      newline = this.buffer.indexOf('\n')
    }
    if (this.buffer.length > 1024 * 1024) this.buffer = ''
  }

  stop(): void {
    const child = this.child
    this.child = null
    if (child) child.kill()
    if (this.serial) this.emit('status', { state: 'disconnected', serial: this.serial } satisfies ConnectionStatus)
  }
}
