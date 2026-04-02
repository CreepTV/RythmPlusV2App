<p align="center">
  <img src="data/rhythmplusApp_logo.png" alt="Rhythm Plus V2" width="140">
</p>

<h1 align="center">Rhythm Plus V2 App</h1>

<p align="center">
  Das <a href="https://v2.rhythm-plus.com/">Rhythm+</a> Music Game als native Desktop-App &mdash; mit Discord Rich Presence, Custom Titlebar und mehr.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.2-a855f7?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-00b4d8?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/electron-34+-e84393?style=flat-square" alt="Electron">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-10b981?style=flat-square" alt="Platform">
</p>

<p align="center">
  <a href="https://github.com/CreepTV/RythmPlusV2App/releases/latest"><strong>Download</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#features"><strong>Features</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#installation"><strong>Installation</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#credits--originalwerk"><strong>Credits</strong></a>
</p>

---

> **Inoffizielles Fan-Projekt** — Diese App steht in keiner offiziellen Verbindung zum Rhythm+ Spiel oder dessen Entwicklern. Alle Rechte am Originalspiel liegen beim jeweiligen Urheber.

---

## Features

| Feature | Beschreibung |
|---|---|
| **Discord Rich Presence** | Zeige deinen Freunden auf Discord was du gerade spielst — mit Song-Titel, direktem Link und "Ask to Join" |
| **Custom Titlebar** | Elegante Titelleiste im Dark Theme mit Song-Anzeige und Profil-Avatar |
| **Keyboard Shortcuts** | Volle Kontrolle per Tastatur: Navigation, Zoom, Fullscreen (F11), DevTools |
| **Google OAuth Login** | Nahtloser Google-Login direkt in der App, keine Umwege |
| **Cross-Platform** | Verfügbar für Windows (Installer), Linux (AppImage) und macOS (DMG) |
| **Open Source** | Vollständig quelloffen unter MIT-Lizenz |

## Download

Lade die neueste Version von der [**Releases-Seite**](https://github.com/CreepTV/RythmPlusV2App/releases/latest) herunter:

| Plattform | Format |
|---|---|
| Windows | NSIS Installer (`.exe`) |
| Linux | AppImage |
| macOS | DMG |

## Installation

### Voraussetzungen

- [Node.js](https://nodejs.org/) (LTS empfohlen)

### Aus dem Quellcode starten

```bash
# Repository klonen
git clone https://github.com/CreepTV/RythmPlusV2App.git
cd RythmPlusV2App

# Abhängigkeiten installieren
npm install

# App starten
npm start
```

### Selbst bauen (Installer)

```bash
npm run build
```

Der fertige Installer liegt anschließend im `dist/` Ordner.

---

<!-- ## Discord Rich Presence einrichten

Discord Rich Presence zeigt in deinem Discord-Profil an, dass du Rhythm+ spielst — inklusive aktuellem Song-Titel und direktem Link.

### 1. Discord-Anwendung erstellen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicke auf **New Application**
3. Gib der App einen Namen, z. B. `Rhythm+`
4. Klicke auf **Create**

### 2. Client ID kopieren

Auf der Seite **General Information** findest du die **Application ID** — das ist deine Client ID. Kopiere sie.

### 3. (Optional) Logo hochladen

Damit das Logo in Discord angezeigt wird:

1. Im Developer Portal auf **Rich Presence** → **Art Assets** gehen
2. Klicke auf **Add Image**
3. Lade `data/rythmplus-logo.png` hoch
4. **Wichtig:** Benenne das Bild exakt `logo` (Kleinbuchstaben)
5. Speichern

### 4. Konfigurationsdatei anlegen

Erstelle im Projektordner eine Datei namens `discord.config.json`:

```json
{
  "clientId": "DEINE_CLIENT_ID_HIER"
}
```

Ersetze `DEINE_CLIENT_ID_HIER` mit der Application ID aus Schritt 2.

### 5. App starten

```bash
npm start
```

Discord muss geöffnet sein. Die Presence wird automatisch gesetzt und aktualisiert sich bei Seitenwechseln. Wenn Discord nicht läuft, versucht die App alle 15 Sekunden erneut zu verbinden — kein Absturz.

> **Hinweis:** Die Datei `discord.config.json` **nicht** in Git committen (enthält deine App-ID). Ohne `discord.config.json` läuft die App ganz normal, nur ohne Rich Presence.

--- -->

## Tastenkürzel

| Kürzel | Aktion |
|---|---|
| `Ctrl+H` | Startseite |
| `Ctrl+R` | Seite neu laden |
| `Alt+←` / `Alt+→` | Zurück / Vorwärts |
| `F11` | Vollbild umschalten |
| `Ctrl++` / `Ctrl+-` | Zoom ein / aus |
| `Ctrl+0` | Zoom zurücksetzen |
| `Ctrl+Shift+I` | DevTools öffnen |
| `Ctrl+Q` | App beenden |

---

## Credits & Originalwerk

**[Rhythm+](https://rhythm-plus.com/)** ist ein browserbasiertes Rhythmus-Spiel, entwickelt von [**henryzt**](https://github.com/henryzt). Diese Desktop-App ist ein **inoffizielles Fan-Projekt** und nicht mit dem Originalwerk verbunden.

| | Link |
|---|---|
| Rhythm+ Website | [rhythm-plus.com](https://rhythm-plus.com/) |
| Rhythm+ V2 | [v2.rhythm-plus.com](https://v2.rhythm-plus.com/) |
| Original GitHub | [henryzt/Rhythm-Plus-Music-Game](https://github.com/henryzt/Rhythm-Plus-Music-Game) |
| Landing Page | [Website](website/) |

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/CreepTV">CreepTV</a> &middot; MIT License
</p>
