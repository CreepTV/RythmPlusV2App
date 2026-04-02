const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  maximize: () => ipcRenderer.send('window-control', 'maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
  onMaximizeChange: (cb) => ipcRenderer.on('maximize-change', (_, isMaximized) => cb(isMaximized)),
  onCurrentSong: (cb) => ipcRenderer.on('current-song', (_, song) => cb(song)),
  onDisplayTitle: (cb) => ipcRenderer.on('display-title', (_, title) => cb(title)),
  navigateHome: () => ipcRenderer.send('navigate-home'),
  copySongLink: () => ipcRenderer.send('copy-song-link'),
  copyProfileLink: () => ipcRenderer.send('copy-profile-link'),
  onProfileUpdate: (cb) => ipcRenderer.on('profile-update', (_, data) => {
    cb(data);
    if (data?.username) ipcRenderer.send('profile-ack');
  }),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', () => cb()),
  openUpdateWindow: () => ipcRenderer.send('open-update-window'),
  openMenu: (x) => ipcRenderer.send('open-menu', x),
  openSongUrlPopup: (x) => ipcRenderer.send('open-song-url-popup', x),
});
