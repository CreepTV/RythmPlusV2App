const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('songUrlPopup', {
  submit: (url) => ipcRenderer.invoke('submit-song-url', url),
  close: () => ipcRenderer.send('close-song-url-popup'),
});
