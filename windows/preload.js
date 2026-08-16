// Preload: exposes a single whitelisted IPC bridge to the renderer.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kumone', {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),
  onMediaKey: (callback) => {
    ipcRenderer.on('media-key', (_event, key) => callback(key));
  },
});
