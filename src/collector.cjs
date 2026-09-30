'use strict';

const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { FrameAssembler } = require('./protocol.cjs');

function findHdc() {
  const sdk = process.env.DEVECO_SDK_HOME;
  const candidates = [
    process.env.HDC_PATH,
    sdk && path.join(sdk, 'default', 'openharmony', 'toolchains', 'hdc'),
    sdk && path.join(sdk, 'default', 'toolchains', 'hdc'),
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',
    ...String(process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, 'hdc'))
  ];
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) throw new Error('未找到 hdc。请安装 DevEco Studio，或设置 HDC_PATH。');
  return found;
}

function listDevices(hdcPath) {
  return new Promise((resolve, reject) => {
    execFile(hdcPath, ['list', 'targets'], { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr).trim() || error.message));
      const devices = String(stdout).split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0])
        .filter((line) => line && line !== '[Empty]' && !line.startsWith('['));
      resolve(devices);
    });
  });
}

class HdcCollector extends EventEmitter {
  constructor(hdcPath) {
    super();
    this.hdcPath = hdcPath;
    this.assembler = new FrameAssembler();
    this.child = null;
    this.serial = '';
    this.buffer = '';
    this.stderr = '';
  }

  start(serial) {
    this.stop();
    this.serial = serial;
    this.buffer = '';
    this.stderr = '';
    const child = spawn(this.hdcPath,
      ['-t', serial, 'shell', 'hilog', '-D', '0x514C', '-T', 'QuecInspector'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    this.child = child;
    child.on('spawn', () => this.emit('status', { state: 'connected', serial }));
    child.on('error', (error) => this.emit('status', { state: 'error', serial, message: error.message }));
    child.on('close', (code) => {
      if (this.child !== child) return;
      this.child = null;
      this.emit('status', {
        state: 'disconnected', serial,
        message: this.stderr.trim() || (code ? `hdc 已退出 (${code})` : '')
      });
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => this.consume(data, serial));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data) => { this.stderr = (this.stderr + data).slice(-2000); });
  }

  consume(data, serial) {
    this.buffer += data;
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      const event = this.assembler.addLine(line, serial);
      if (event) this.emit('event', event);
      newline = this.buffer.indexOf('\n');
    }
    if (this.buffer.length > 1024 * 1024) this.buffer = '';
  }

  stop() {
    const child = this.child;
    this.child = null;
    if (child) child.kill();
    if (this.serial) this.emit('status', { state: 'disconnected', serial: this.serial });
  }
}

module.exports = { findHdc, listDevices, HdcCollector };
