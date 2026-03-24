const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('disclaimer', {
  close: () => ipcRenderer.send('close-disclaimer'),
  openExternal: (url) => ipcRenderer.send('disclaimer-open-url', url),
});
