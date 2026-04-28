# HestiDMS — Desktop Client

Electron + React desktop app for HestiOS Document Management System.
Connects to the HestiOS backend API and syncs documents locally (similar to Google Drive / OneDrive).

## Tech Stack

- **Electron 31** + **electron-vite 2.3** + **React 18** + **TypeScript**
- **axios** — HTTP client for HestiOS API
- **chokidar** — file system watcher for bidirectional sync
- **form-data** — multipart upload
- No native modules (SQLite removed — JSON file persistence instead, avoids V8 build issues)

## Project Structure

```
desktop/
├── electron/
│   ├── main.ts          — BrowserWindow, Tray, IPC handlers, single-instance lock
│   ├── preload.ts       — contextBridge (window.api)
│   └── sync/
│       ├── api.ts       — HestiOS REST API client (login, folders, documents)
│       ├── db.ts        — JSON file persistence (config.json + sync-state.json)
│       └── engine.ts    — sync engine (full sync, file watcher, polling, conflict detection)
├── src/
│   ├── App.tsx          — root component, auth state, auth:expired handler
│   ├── pages/
│   │   ├── LoginPage.tsx   — server URL + email + password login
│   │   └── BrowserPage.tsx — folder tree + file list + sync status
│   └── components/
│       ├── FolderTree.tsx
│       ├── FileList.tsx
│       └── SyncStatus.tsx
├── resources/
│   └── tray-icon.png    — 18x18 template image for macOS menu bar
└── package.json
```

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
cd desktop
npm install
```

> Note: do NOT use `npm install --ignore-scripts` — Electron binary download runs as a postinstall script.

If Electron binary is missing after install:
```bash
node node_modules/electron/install.js
```

## Development

```bash
npm run dev
```

Starts electron-vite in dev mode with hot reload.

## Build

```bash
npm run build
```

Output: `out/main/index.js`, `out/preload/index.js`, `out/renderer/`

## Run (after build)

```bash
npx electron .
```

## Package DMG (macOS)

```bash
npm run package:mac
```

Output: `dist-app/mac-arm64/HestiDMS-*.dmg`

Requires `resources/icon.icns` for the app icon (optional — build works without it).

## Backend API

Connects to HestiOS backend (FastAPI). Required endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login/` | form-encoded `username` + `password` → `access_token` |
| GET | `/api/folders/` | full folder tree with `children` nested |
| GET | `/api/documents/?limit=10000` | all documents |
| GET | `/api/documents/{id}/download/` | download file (arraybuffer) |
| POST | `/api/documents/upload/` | multipart upload |
| POST | `/api/folders/` | create folder |
| DELETE | `/api/documents/{id}/` | delete document |
| DELETE | `/api/folders/{id}/` | delete folder |

> All paths require trailing slash (FastAPI `redirect_slashes=False`).

Authentication: `Authorization: Bearer <token>` header on all requests except login.

## Sync Engine Behavior

- **Full sync** on startup + every 60 seconds
- **5 concurrent downloads** (parallel, not sequential)
- **Conflict detection**: if local file was modified since last sync AND server has a newer version → local copy renamed to `name_conflict_TIMESTAMP.ext`
- **Server delete → local delete**: files removed from server are deleted locally on next sync
- **Local file added** → uploaded to server after 3s debounce
- **Local folder created** → created on server via API
- **Token expiry (401)** → auto-logout, redirect to login screen
- **Reconciliation** on startup: local files not in DB (pre-existing files) → uploaded automatically

## Data Persistence

Stored in macOS `~/Library/Application Support/hesti-dms/`:
- `config.json` — server URL, JWT token, user info, sync folder path
- `sync-state.json` — folder records + document records (id, local_path, version, mtime, sync_status)

## Known Limitations

- No offline access — browsing the DMS panel requires internet (falls back to local DB cache)
- Local folder deletion does NOT delete from server (intentional safety measure)
- WebDAV not implemented — native Finder mounting not available

## Environment

- macOS only (DMG packaging)
- Tested on macOS 14+ ARM64
- `titleBarStyle: hiddenInset` — native macOS traffic lights with custom content area
