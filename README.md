# LocalChat

Fully local, offline-first chat powered by [Ollama](https://ollama.com). No cloud APIs, API keys, telemetry, or remote assets at runtime.

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express (bound to `127.0.0.1`)
- **Database:** SQLite at `./data/localchat.db`
- **LLM:** Ollama at `http://127.0.0.1:11434`

## Prerequisites (Windows)

1. [Node.js 20+](https://nodejs.org/)
2. [Ollama for Windows](https://ollama.com/download)
3. Pull the default model:

```powershell
ollama pull qwen2.5:7b
```

## Setup (PowerShell)

```powershell
# Clone and enter the repo
git clone https://github.com/ramdeals0/localchat.git
cd localchat

# Install dependencies
npm install

# Configure environment
Copy-Item .env.example .env

# Build shared types (required before server/client build)
npm run build -w shared

# Run tests
npm run test

# Start dev servers (API on :3001, UI on :5173)
npm run dev
```

Open http://127.0.0.1:5173 in your browser.

## Production build

```powershell
npm run build
npm run start
```

Then open http://127.0.0.1:3001 (the server serves the built client).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API port |
| `HOST` | `127.0.0.1` | Bind address (local only) |
| `DATABASE_PATH` | `./data/localchat.db` | SQLite file path |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Default model for new chats |

## Features

- Create, rename, delete, and switch conversations
- Per-conversation system prompt editor
- Model selector (from Ollama `/api/tags`)
- Streaming replies via Server-Sent Events
- Stop generation (`AbortController`)
- Regenerate latest assistant response
- Export conversation to Markdown or JSON
- Clear chat
- Ollama connection/status indicator
- Friendly errors when Ollama or the selected model is missing
- Sanitized Markdown rendering (no raw HTML/JS execution)

## Offline test

After dependencies and models are installed, verify offline operation:

```powershell
# 1. Ensure Ollama is running and the model is present
ollama list

# 2. Start LocalChat
npm run dev

# 3. Disconnect from the internet (Wi‑Fi off or airplane mode)

# 4. Confirm these still work:
#    - Open http://127.0.0.1:5173
#    - Status shows "Ollama ready"
#    - Send a message and receive a streamed reply
#    - Create/rename/delete conversations
#    - Export Markdown/JSON downloads locally
```

LocalChat only talks to `127.0.0.1` (your machine). No outbound network calls are required at runtime.

## Optional: Docker

Docker is supported for convenience but the normal workflow is npm on Windows.

```powershell
docker compose up --build
```

This starts the Node server. You still need Ollama running on the host at `http://127.0.0.1:11434` (or adjust `OLLAMA_BASE_URL`).

## Project layout

```
/client     React frontend
/server     Express API + SQLite + Ollama proxy
/shared     Shared TypeScript types
/data       Local SQLite database
/.cursor    Local-only architecture rules
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API + Vite dev server |
| `npm run build` | Build shared, server, and client |
| `npm run test` | Run server unit tests |
| `npm run start` | Run production server |

## Troubleshooting

**Ollama offline:** Start the Ollama app or run `ollama serve`.

**Model missing:** Run `ollama pull qwen2.5:7b` (or your selected model).

**Port in use:** Change `PORT` in `.env`.

**Database locked:** Close other LocalChat instances using the same `./data/localchat.db`.
