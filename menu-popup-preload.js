const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuPopup', {
  openSettings: () => ipcRenderer.send('open-settings'),
});
