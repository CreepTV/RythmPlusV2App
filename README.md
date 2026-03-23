# Rhythm+ V2 Desktop App

Electron wrapper für [v2.rhythm-plus.com](https://v2.rhythm-plus.com/).

## Installation

```bash
npm install
```

## Starten

```bash
npm start
```

## Build (Installer)

```bash
npm run build
```

---

## Discord Rich Presence einrichten

Discord Rich Presence zeigt in deinem Discord-Profil an, dass du Rhythm+ spielst – inklusive aktuellem Seitentitel.

### 1. Discord-Anwendung erstellen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicke auf **New Application**
3. Gib der App einen Namen, z. B. `Rhythm+`
4. Klicke auf **Create**

### 2. Client ID kopieren

Auf der Seite **General Information** findest du die **Application ID** – das ist deine Client ID.
Kopiere sie.

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

Discord muss geöffnet sein. Die Presence wird automatisch gesetzt und aktualisiert sich bei Seitenwechseln.
Wenn Discord nicht läuft, versucht die App alle 15 Sekunden erneut zu verbinden – kein Absturz.

---

### Hinweise

- Die Datei `discord.config.json` **nicht** in Git committen (enthält deine App-ID)
- Ohne `discord.config.json` läuft die App ganz normal, nur ohne Rich Presence
