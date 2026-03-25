const { app, BrowserWindow, WebContentsView, shell, Menu, ipcMain, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');
const discord = require('./discord');

const TARGET_URL = 'https://v2.rhythm-plus.com/';
const TITLEBAR_HEIGHT = 40;

// Clear corrupted Chromium cache/quota databases before app starts
;[
  path.join(app.getPath('userData'), 'Default', 'QuotaManager'),
  path.join(app.getPath('userData'), 'GrShaderCache'),
  path.join(app.getPath('userData'), 'ShaderCache'),
].forEach(p => {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
});

let mainWindow;
let disclaimerWindow;
let updateWindow;
let menuPopupWindow = null;
let settingsWindow = null;
let pendingUpdateInfo = null;
let titlebarView;
let contentView;

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')); } catch { return { compactHud: false }; }
}

function saveSettings(settings) {
  try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2)); } catch (e) {
    console.warn('[RythmPlus] Could not save settings:', e.message);
  }
}

let appSettings = { compactHud: false };

// CSS injected when Compact HUD is enabled
const COMPACT_HUD_CSS = `
.score[data-v-09515fd5] {
    bottom: none !important;
    display: flex;
    flex-direction: column;
    font-family: Dosis,sans-serif;
    font-size: 1.875rem;
    left: 20% !important;
    top: 6rem;
    line-height: 2.25rem;
    opacity: .5;
    position: fixed;
    text-shadow: 0 0 3px rgba(0,0,0,.315)
}
@media (min-width: 1500px) {
  .score[data-v-09515fd5] { left: 25% !important; }
}
@media (min-width: 1800px) {
  .score[data-v-09515fd5] { left: 30% !important; }
}
@media (max-width: 1180px) {
  .score[data-v-09515fd5] { left: 15% !important; }
}
`;

let compactHudCssKey = null;

async function applyCompactHud(enabled) {
  if (!contentView) return;
  if (compactHudCssKey) {
    try { await contentView.webContents.removeInsertedCSS(compactHudCssKey); } catch (_) {}
    compactHudCssKey = null;
  }
  if (enabled) {
    try { compactHudCssKey = await contentView.webContents.insertCSS(COMPACT_HUD_CSS); } catch (_) {}
  }
}

// Tracks game preview windows: titlebarWebContentsId → { win, gameContentView, gameTitlebarView }
const gameWindows = new Map();
let currentSongId = null;
let currentSongTitle = null;
let currentUsername = null;
let currentPhotoURL = null;
let titlePollInterval = null;
let titlebarAckedProfile = false;

function notifyTitlebarProfile(username, photoURL) {
  if (!titlebarView) return;
  titlebarView.webContents.send('profile-update', { username: username || null, photoURL: photoURL || null });
}

function notifyTitlebarDisplayTitle(title) {
  if (!titlebarView) return;
  const escaped = title ? title.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
  titlebarView.webContents.executeJavaScript(`
    (() => {
      const el = document.getElementById('song-title');
      const text = document.getElementById('song-title-text');
      if (!el || !text) return;
      if ('${escaped}') {
        text.textContent = '${escaped}';
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
        text.textContent = '';
      }
    })()
  `).catch(() => {});
}

async function probeUsername() {
  if (!contentView) return null;
  try {
    const result = await contentView.webContents.executeJavaScript(`
      (() => {
        try {
          // Method 1: Pinia store – search for username and photoURL
          const appEl = document.querySelector('#app');
          const vueApp = appEl?.__vue_app__;
          if (vueApp) {
            const sym = Object.getOwnPropertySymbols(vueApp._context?.provides || {})
              .find(s => String(s).includes('pinia'));
            const pinia = sym
              ? vueApp._context.provides[sym]
              : vueApp._context?.provides?.[Symbol.for('pinia')];
            if (pinia?._s) {
              for (const [, store] of pinia._s) {
                try {
                  const json = JSON.stringify(store.$state);
                  const m = json.match(/"userName":"([^"]+)"/) || json.match(/"username":"([^"]+)"/);
                  if (m) {
                    const p = json.match(/"photoURL":"([^"]+)"/);
                    return JSON.stringify({ userName: m[1], photoURL: p ? p[1] : null });
                  }
                } catch(e) {}
              }
            }
          }
          // Method 2: localStorage
          for (const key of Object.keys(localStorage)) {
            try {
              const val = JSON.parse(localStorage.getItem(key));
              const sources = [val, val?.user, val?.profile];
              for (const src of sources) {
                const name = src?.userName || src?.username;
                if (typeof name === 'string') {
                  return JSON.stringify({ userName: name, photoURL: src?.photoURL || val?.photoURL || null });
                }
              }
            } catch(e) {}
          }
          return null;
        } catch(e) { return null; }
      })()
    `);
    if (result) {
      const data = JSON.parse(result);
      if (data?.userName) return data;
    }
    return null;
  } catch(e) { return null; }
}

function startTitlePolling() {
  stopTitlePolling();
  console.log('[RythmPlus] Title-Poll gestartet');
  titlePollInterval = setInterval(async () => {
    if (!contentView) return;
    try {
      const url = contentView.webContents.getURL();
      if (!url || url === 'about:blank') return;
      const pathname = new URL(url).pathname;

      // Probe for username once until found
      if (!currentUsername) {
        const profile = await probeUsername();
        if (profile) {
          currentUsername = profile.userName;
          currentPhotoURL = profile.photoURL;
          titlebarAckedProfile = false;
          console.log('[RythmPlus] Username gefunden:', currentUsername, '| Photo:', currentPhotoURL ? 'yes' : 'no');
        }
      }
      // Keep sending until titlebar has acknowledged
      if (currentUsername && !titlebarAckedProfile) {
        notifyTitlebarProfile(currentUsername, currentPhotoURL);
      }
      if (pathname === '/' || pathname === '') {
        notifyTitlebarSong(null);
        currentSongTitle = null;
        notifyTitlebarDisplayTitle(null);
        discord.setActivity('Main Menu');
      } else if (pathname.startsWith('/editor')) {
        notifyTitlebarSong(null);
        currentSongTitle = null;
        notifyTitlebarDisplayTitle(null);
        discord.setActivity('editing beatmap');
      } else {
        const result = await contentView.webContents.executeJavaScript(`
          (() => {
            const getParam = (url, key) => { try { return new URL(url).searchParams.get(key); } catch(e) { return null; } };
            const ogUrl   = document.querySelector('meta[property="og:url"]')?.content || '';
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content || document.title || '';
            const songId  = getParam(ogUrl, 'songId') || getParam(window.location.href, 'songId') || null;
            return JSON.stringify({ title: ogTitle, songId });
          })()
        `);
        const { title: raw, songId: pageSongId } = JSON.parse(result);

        if (pageSongId && pageSongId !== currentSongId) {
          currentSongId = pageSongId;
          console.log('[RythmPlus] Song ID aus og:url / href:', currentSongId);
        }
        if (!pathname.startsWith('/game') && !pageSongId) {
          currentSongId = null;
        }

        const cleanTitle = raw.replace(' - Rhythm Plus Music Game', '').replace(' - Play', '').trim();

        // Store the song title whenever we have one
        if (cleanTitle && cleanTitle !== 'Rhythm Plus Music Game' && cleanTitle !== 'Rhythm Plus' && cleanTitle !== 'Rhythm+') {
          currentSongTitle = cleanTitle;
        }

        if (pathname.startsWith('/game') && currentSongId) {
          notifyTitlebarSong(currentSongId, currentSongTitle || cleanTitle);
        } else if (!currentSongId) {
          notifyTitlebarSong(null);
        }

        // Show song title in titlebar on /game
        if (pathname.startsWith('/game') && currentSongTitle) {
          notifyTitlebarDisplayTitle(currentSongTitle);
        } else if (!pathname.startsWith('/game')) {
          currentSongTitle = null;
          notifyTitlebarDisplayTitle(null);
        }

        const songId = pathname.startsWith('/game') ? currentSongId : null;
        discord.setActivity(cleanTitle ? `playing ${cleanTitle}` : 'Rhythm+', songId);
      }
    } catch (e) { console.error('[Poll] Fehler:', e.message); }
  }, 2000);
}

function stopTitlePolling() {
  if (titlePollInterval) {
    clearInterval(titlePollInterval);
    titlePollInterval = null;
  }
}

function notifyTitlebarSong(songId, title) {
  if (!titlebarView) return;
  titlebarView.webContents.send('current-song', songId ? { songId, title: title || '' } : null);
}

// Try to read the current song from the page – tries multiple methods
async function probeSongId() {
  if (!contentView) return null;
  try {
    const result = await contentView.webContents.executeJavaScript(`
      (() => {
        try {
          // Method 1: songId already in URL
          const p = new URLSearchParams(window.location.search);
          if (p.has('songId')) return JSON.stringify({ songId: p.get('songId'), title: document.title });

          // Method 2: Pinia store – JSON-stringify every store and regex-search for songId
          const appEl = document.querySelector('#app') || document.querySelector('[id]');
          const vueApp = appEl?.__vue_app__;
          if (vueApp) {
            // find Pinia regardless of Symbol description
            const sym = Object.getOwnPropertySymbols(vueApp._context?.provides || {})
              .find(s => String(s).includes('pinia'));
            const pinia = sym
              ? vueApp._context.provides[sym]
              : vueApp._context?.provides?.[Symbol.for('pinia')];

            if (pinia?._s) {
              for (const [, store] of pinia._s) {
                try {
                  const json = JSON.stringify(store.$state);
                  const idMatch    = json.match(/"songId":"([^"]+)"/);
                  const titleMatch = json.match(/"title":"([^"]*?)"/);
                  if (idMatch) return JSON.stringify({ songId: idMatch[1], title: titleMatch?.[1] || '' });
                } catch (e) {}
              }
            }
          }
          return null;
        } catch (e) { return null; }
      })()
    `);
    if (result) {
      const data = JSON.parse(result);
      if (data?.songId) return data;
    }
  } catch (e) { console.error('[Probe] Fehler:', e.message); }
  return null;
}

function handleNavigation(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has('songId')) {
      // Speichere Song-ID – wird beim Wechsel zu /game weiter verwendet
      currentSongId = urlObj.searchParams.get('songId');
      console.log('[RythmPlus] Song ID aus URL:', currentSongId);
      notifyTitlebarSong(currentSongId);
    } else if (!urlObj.pathname.startsWith('/game')) {
      // Nur löschen wenn weder songId in URL noch auf /game
      currentSongId = null;
      notifyTitlebarSong(null);
    }
  } catch (e) {}
}

const CUSTOM_CSS_PATH = path.join(__dirname, 'style.css');

function injectCustomCSS() {
  try {
    const css = fs.readFileSync(CUSTOM_CSS_PATH, 'utf-8');
    if (css.trim()) {
      contentView.webContents.insertCSS(css).then(() => {
        console.log('[RythmPlus] Custom CSS injected (' + css.length + ' bytes)');
      });
    }
    // Page reloaded — CSS keys are gone; reapply compact HUD if enabled
    compactHudCssKey = null;
    if (appSettings.compactHud) {
      contentView.webContents.insertCSS(COMPACT_HUD_CSS).then(key => { compactHudCssKey = key; });
    }
  } catch (e) {
    console.warn('[RythmPlus] Could not inject custom CSS:', e.message);
  }
}

function layoutViews() {
  if (!mainWindow || !titlebarView || !contentView) return;
  const [width, height] = mainWindow.getContentSize();
  if (mainWindow.isFullScreen()) {
    titlebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    contentView.setBounds({ x: 0, y: 0, width, height });
  } else {
    titlebarView.setBounds({ x: 0, y: 0, width, height: TITLEBAR_HEIGHT });
    contentView.setBounds({ x: 0, y: TITLEBAR_HEIGHT, width, height: height - TITLEBAR_HEIGHT });
  }
}

function createGamePreviewWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
    frame: false,
    backgroundColor: '#0d0d0d',
    show: false,
  });

  const gameTitlebarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'titlebar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.contentView.addChildView(gameTitlebarView);
  gameTitlebarView.webContents.loadFile(path.join(__dirname, 'titlebar.html'));

  const gameContentView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.contentView.addChildView(gameContentView);
  gameContentView.webContents.loadURL(url);

  // Nur /game/* erlauben – bei anderer Navigation Fenster schließen
  function checkAndCloseIfNotGame(navUrl) {
    try {
      const { pathname } = new URL(navUrl);
      if (!pathname.startsWith('/game') && !pathname.startsWith('/result')) {
        win.close();
      }
    } catch (e) {}
  }

  gameContentView.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const { pathname } = new URL(navUrl);
      if (!pathname.startsWith('/game') && !pathname.startsWith('/result')) {
        event.preventDefault();
        win.close();
      }
    } catch (e) {}
  });
  gameContentView.webContents.on('did-navigate', (_, navUrl) => checkAndCloseIfNotGame(navUrl));
  gameContentView.webContents.on('did-navigate-in-page', (_, navUrl) => checkAndCloseIfNotGame(navUrl));
  gameContentView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const titlebarId = gameTitlebarView.webContents.id;
  gameWindows.set(titlebarId, { win, gameContentView, gameTitlebarView });

  function layoutGameWindow() {
    if (!win) return;
    const [width, height] = win.getContentSize();
    if (win.isFullScreen()) {
      gameTitlebarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      gameContentView.setBounds({ x: 0, y: 0, width, height });
    } else {
      gameTitlebarView.setBounds({ x: 0, y: 0, width, height: TITLEBAR_HEIGHT });
      gameContentView.setBounds({ x: 0, y: TITLEBAR_HEIGHT, width, height: height - TITLEBAR_HEIGHT });
    }
  }
  layoutGameWindow();

  win.on('resize', layoutGameWindow);
  win.on('enter-full-screen', layoutGameWindow);
  win.on('leave-full-screen', layoutGameWindow);
  win.on('maximize', () => gameTitlebarView.webContents.send('maximize-change', true));
  win.on('unmaximize', () => gameTitlebarView.webContents.send('maximize-change', false));

  gameTitlebarView.webContents.once('did-finish-load', () => win.show());

  win.on('closed', () => gameWindows.delete(titlebarId));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
    frame: false,
    backgroundColor: '#0d0d0d',
    show: false,
  });

  // Titlebar view (local HTML)
  titlebarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'titlebar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.contentView.addChildView(titlebarView);
  titlebarView.webContents.loadFile(path.join(__dirname, 'titlebar.html'));

  // Content view (rhythm-plus.com)
  // Use a persistent partition so Service Workers and storage work correctly
  contentView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      partition: 'persist:rhythmplus',
    },
  });
  mainWindow.contentView.addChildView(contentView);
  contentView.webContents.loadURL(TARGET_URL);
  startTitlePolling();

  contentView.webContents.on('did-navigate', (_, url) => handleNavigation(url));
  contentView.webContents.on('did-navigate-in-page', (_, url) => handleNavigation(url));

  // Block Enter key on /menu/* pages
  contentView.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Enter') {
      try {
        const url = contentView.webContents.getURL();
        if (url && new URL(url).pathname.startsWith('/menu')) {
          event.preventDefault();
        }
      } catch (_) {}
    }
  });

  contentView.webContents.on('dom-ready', injectCustomCSS);
  contentView.webContents.on('did-navigate', () => setTimeout(injectCustomCSS, 500));
  contentView.webContents.on('did-navigate-in-page', () => setTimeout(injectCustomCSS, 500));

  layoutViews();

  mainWindow.on('resize', layoutViews);
  mainWindow.on('enter-full-screen', layoutViews);
  mainWindow.on('leave-full-screen', layoutViews);

  titlebarView.webContents.once('did-finish-load', () => {
    mainWindow.show();
    // Resend current state after titlebar is ready (handles race condition)
    setTimeout(() => {
      if (currentUsername) notifyTitlebarProfile(currentUsername, currentPhotoURL);
      if (currentSongId) notifyTitlebarSong(currentSongId);
    }, 300);
    if (isFirstLaunch()) {
      setTimeout(() => showDisclaimer(), 600);
    }
  });

  mainWindow.on('maximize', () => titlebarView.webContents.send('maximize-change', true));
  mainWindow.on('unmaximize', () => titlebarView.webContents.send('maximize-change', false));

  contentView.webContents.setWindowOpenHandler(({ url }) => {
    // Google OAuth → als Popup in Electron öffnen
    if (url.startsWith('https://accounts.google.com') || url.startsWith('https://auth.rhythm-plus.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
        },
      };
    }
    // Wenn man im Editor ist und ein /game/-Link geöffnet wird → neues Fenster mit custom Titlebar
    const currentURL = contentView.webContents.getURL();
    const isOnEditor = currentURL.includes('/editor');
    const isGameLink = new URL(url).pathname.startsWith('/game');
    if (isOnEditor && isGameLink) {
      createGamePreviewWindow(url);
      return { action: 'deny' };
    }
    // Alles andere → in der App laden, kein Popup
    contentView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    stopTitlePolling();
    mainWindow = null;
    titlebarView = null;
    contentView = null;
  });
}

ipcMain.on('open-update-window', () => showUpdateWindow());

ipcMain.on('update-download', () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[Updater] Download-Fehler:', err.message);
  });
});

ipcMain.on('update-install', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.on('close-update-window', () => {
  if (updateWindow) updateWindow.close();
});

ipcMain.on('update-open-url', (_, url) => {
  shell.openExternal(url);
});

ipcMain.on('navigate-home', (event) => {
  const gameEntry = [...gameWindows.values()].find(e => e.gameTitlebarView.webContents.id === event.sender.id);
  if (gameEntry) {
    gameEntry.gameContentView.webContents.loadURL(TARGET_URL);
  } else if (contentView) {
    contentView.webContents.loadURL(TARGET_URL);
  }
});

ipcMain.on('close-disclaimer', () => {
  if (disclaimerWindow) disclaimerWindow.close();
});

ipcMain.on('disclaimer-open-url', (_, url) => {
  shell.openExternal(url);
});

ipcMain.on('copy-profile-link', () => {
  if (currentUsername) {
    clipboard.writeText(`https://v2.rhythm-plus.com/u/${currentUsername}`);
  }
});

ipcMain.on('profile-ack', () => {
  titlebarAckedProfile = true;
});

ipcMain.on('copy-song-link', () => {
  if (currentSongId) {
    clipboard.writeText(`https://v2.rhythm-plus.com/?songId=${currentSongId}`);
  }
});

ipcMain.on('navigate-to-song', () => {
  if (currentSongId && contentView) {
    contentView.webContents.loadURL(`https://v2.rhythm-plus.com/?songId=${currentSongId}`);
  }
});

ipcMain.on('window-control', (event, action) => {
  // Find the correct window: game preview or main
  const gameEntry = [...gameWindows.values()].find(e => e.gameTitlebarView.webContents.id === event.sender.id);
  const win = gameEntry ? gameEntry.win : mainWindow;
  if (!win) return;
  switch (action) {
    case 'minimize': win.minimize(); break;
    case 'maximize':
      win.isMaximized() ? win.unmaximize() : win.maximize();
      break;
    case 'close': win.close(); break;
  }
});

// ── Menu popup ────────────────────────────────────────────────────────────────
ipcMain.on('open-menu', (_, x) => {
  if (menuPopupWindow) { menuPopupWindow.close(); return; }
  const [wx, wy] = mainWindow.getPosition();
  menuPopupWindow = new BrowserWindow({
    x: wx + Math.round(x),
    y: wy + TITLEBAR_HEIGHT,
    width: 180,
    height: 54,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'menu-popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  menuPopupWindow.loadFile(path.join(__dirname, 'menu-popup.html'));
  menuPopupWindow.on('blur', () => { if (menuPopupWindow) { menuPopupWindow.close(); } });
  menuPopupWindow.on('closed', () => { menuPopupWindow = null; });
});

// ── Settings window ───────────────────────────────────────────────────────────
ipcMain.on('open-settings', () => {
  if (menuPopupWindow) { menuPopupWindow.close(); menuPopupWindow = null; }
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    parent: mainWindow,
    show: false,
    backgroundColor: '#121212',
    icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });
});

ipcMain.on('close-settings', () => {
  if (settingsWindow) settingsWindow.close();
});

ipcMain.handle('get-settings', () => loadSettings());

ipcMain.on('set-settings', (_, settings) => {
  appSettings = { ...appSettings, ...settings };
  saveSettings(appSettings);
  applyCompactHud(appSettings.compactHud);
});

function isFirstLaunch() {
  const flagPath = path.join(app.getPath('userData'), 'disclaimer-accepted');
  if (fs.existsSync(flagPath)) return false;
  fs.writeFileSync(flagPath, '1', 'utf-8');
  return true;
}

function showDisclaimer() {
  if (!mainWindow) return;
  if (disclaimerWindow) { disclaimerWindow.focus(); return; }
  disclaimerWindow = new BrowserWindow({
    width: 480,
    height: 550,
    parent: mainWindow,
    modal: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    backgroundColor: '#121212',
    icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'disclaimer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  disclaimerWindow.loadFile(path.join(__dirname, 'disclaimer.html'));
  disclaimerWindow.on('closed', () => { disclaimerWindow = null; });
}


function setupAutoUpdater() {
  if (!app.isPackaged) {
    // Dev-Modus: forceDevUpdateConfig aktivieren damit GitHub-Check trotzdem klappt
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update verfügbar:', info.version);
    pendingUpdateInfo = { ...info, currentVersion: app.getVersion() };
    if (titlebarView) {
      titlebarView.webContents.send('update-available');
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (updateWindow) {
      updateWindow.webContents.send('download-progress', progress);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] Update heruntergeladen');
    if (updateWindow) {
      updateWindow.webContents.send('update-downloaded');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Fehler:', err.message);
  });

  // Beim Start nach Updates suchen (mit Verzögerung)
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
}

function showUpdateWindow() {
  if (updateWindow) { updateWindow.focus(); return; }
  if (!mainWindow) return;

  updateWindow = new BrowserWindow({
    width: 420,
    height: 430,
    parent: mainWindow,
    modal: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    backgroundColor: '#121212',
    icon: path.join(__dirname, 'data', 'rythmplus-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'update-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  updateWindow.loadFile(path.join(__dirname, 'update.html'));

  updateWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (pendingUpdateInfo && updateWindow) {
        updateWindow.webContents.send('update-info', pendingUpdateInfo);
      }
    }, 150);
  });

  updateWindow.on('closed', () => { updateWindow = null; });
}

function buildMenu() {
  const template = [
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => contentView?.webContents.loadURL(TARGET_URL),
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => contentView?.webContents.reload(),
        },
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => {
            if (contentView?.webContents.canGoBack()) contentView.webContents.goBack();
          },
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => {
            if (contentView?.webContents.canGoForward()) contentView.webContents.goForward();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (contentView) {
              const level = contentView.webContents.getZoomLevel();
              contentView.webContents.setZoomLevel(level + 0.5);
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (contentView) {
              const level = contentView.webContents.getZoomLevel();
              contentView.webContents.setZoomLevel(level - 0.5);
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => contentView?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => contentView?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'App',
      submenu: [
        {
          label: 'About / Credits',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => showDisclaimer(),
        },
        {
          label: 'Nach Updates suchen',
          accelerator: 'CmdOrCtrl+Shift+Alt+U',
          click: () => {
            autoUpdater.checkForUpdates().then((result) => {
              if (!result || !result.updateInfo) return;
              const latest = result.updateInfo.version;
              const current = app.getVersion();
              if (latest === current) {
                console.log('[Updater] Kein Update — bereits aktuell:', current);
              }
            }).catch((err) => console.error('[Updater] Check-Fehler:', err.message));
          },
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  appSettings = loadSettings();
  buildMenu();
  createWindow();
  discord.connect();
  setupAutoUpdater();

  // When another user joins via "Ask to Join" → navigate to that song
  discord.setJoinCallback((songId) => {
    if (contentView) {
      contentView.webContents.loadURL(`https://v2.rhythm-plus.com/?songId=${songId}`);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;
app.on('before-quit', (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  discord.destroy().finally(() => app.quit());
});
