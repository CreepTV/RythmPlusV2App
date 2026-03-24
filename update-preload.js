const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
  onInfo:       (cb) => ipcRenderer.on('update-info',      (_, info)     => cb(info)),
  onProgress:   (cb) => ipcRenderer.on('download-progress',(_, progress) => cb(progress)),
  onDownloaded: (cb) => ipcRenderer.on('update-downloaded', ()           => cb()),
  download:     ()   => ipcRenderer.send('update-download'),
  install:      ()   => ipcRenderer.send('update-install'),
  close:        ()   => ipcRenderer.send('close-update-window'),
  openExternal: (url) => ipcRenderer.send('update-open-url', url),
});
