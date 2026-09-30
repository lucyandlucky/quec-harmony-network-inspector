'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inspector', {
  listDevices: () => ipcRenderer.invoke('devices:list'),
  connect: (serial) => ipcRenderer.invoke('collector:connect', serial),
  disconnect: () => ipcRenderer.invoke('collector:disconnect'),
  copy: (value) => ipcRenderer.invoke('clipboard:write', value),
  onEvent: (callback) => ipcRenderer.on('collector:event', (_event, payload) => callback(payload)),
  onStatus: (callback) => ipcRenderer.on('collector:status', (_event, payload) => callback(payload))
});
