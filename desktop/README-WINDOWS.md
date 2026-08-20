# LocalChat Windows Desktop Packaging

LocalChat desktop uses **Tauri 2** to wrap the existing React frontend and Node/Express backend as a localhost-only sidecar.

## Prerequisites

- Node.js 20+
- Rust stable toolchain (`rustup`)
- Visual Studio Build Tools (MSVC) on Windows
- WebView2 runtime (usually preinstalled on Windows 11)
- Ollama running locally at `http://127.0.0.1:11434`

## Development (web + sidecar manually)

```powershell
cd C:\forgepro\localchat
npm install
Copy-Item .env.example .env
npm run build -w shared
npm run dev
```

## Desktop development

```powershell
cd C:\forgepro\localchat
npm install
npm run build -w shared
npm run build -w server
cd desktop
npm install
npm run build:sidecar
npm run dev
```

Tauri will:

1. Pick a free loopback port
2. Start the LocalChat sidecar bound to `127.0.0.1`
3. Wait for `/api/health`
4. Open the desktop window

## Production build (Windows installer)

```powershell
cd C:\forgepro\localchat
npm install
npm run build -w shared
npm run build -w server
npm run build -w client
cd desktop
npm install
npm run build:sidecar
npm run build
```

Installer artifacts are written under:

```text
desktop/src-tauri/target/release/bundle/
```

## App data locations

Desktop builds store SQLite, documents, exports, and logs under the per-user application data directory:

```text
%APPDATA%\LocalChat\
  localchat.db
  documents\
  exports\
  logs\
```

## Security notes

- Backend binds only to `127.0.0.1`
- No cloud APIs, telemetry, or remote auth
- Import/export passphrases are never persisted
- Tauri IPC is limited to launch diagnostics and native open/save dialogs

## Troubleshooting

- **Ollama offline**: start Ollama and pull chat/embedding models before launching desktop chat.
- **Sidecar health timeout**: check `logs/desktop.log` under `%APPDATA%\LocalChat`.
- **WebView blank**: confirm the sidecar port is reachable at `http://127.0.0.1:<port>/api/health`.
