'use strict';

const path = require('node:path');
const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const { findHdc, listDevices, HdcCollector } = require('./collector.cjs');

let window;
let collector;

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}

function createWindow() {
  window = new BrowserWindow({
    title: 'Quec Network Inspector',
    width: 1320,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f6f8f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.QNI_DEVTOOLS === '1') window.webContents.openDevTools();
}

app.whenReady().then(() => {
  app.setName('Quec Network Inspector');
  createWindow();
  ipcMain.handle('devices:list', async () => {
    try {
      return { devices: await listDevices(findHdc()), error: '' };
    } catch (error) {
      return { devices: [], error: error.message };
    }
  });
  ipcMain.handle('collector:connect', (_event, serial) => {
    if (typeof serial !== 'string' || !serial.trim()) return { error: '请选择设备' };
    try {
      if (collector) collector.stop();
      collector = new HdcCollector(findHdc());
      collector.on('status', (status) => send('collector:status', status));
      collector.on('event', (event) => send('collector:event', event));
      collector.start(serial);
      return { error: '' };
    } catch (error) {
      return { error: error.message };
    }
  });
  ipcMain.handle('collector:disconnect', () => {
    if (collector) collector.stop();
  });
  ipcMain.handle('clipboard:write', (_event, value) => {
    if (typeof value === 'string') clipboard.writeText(value);
  });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (collector) collector.stop(); });
