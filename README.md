# LocalChat

Fully local, offline-first chat powered by [Ollama](https://ollama.com). No cloud APIs, API keys, telemetry, or remote assets at runtime.

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express (bound to `127.0.0.1`)
- **Database:** SQLite at `./data/localchat.db`
- **Documents:** Local files in `./data/documents`
- **LLM + embeddings:** Ollama at `http://127.0.0.1:11434`

## Prerequisites (Windows)

1. [Node.js 20+](https://nodejs.org/)
2. [Ollama for Windows](https://ollama.com/download)
3. Pull the chat and embedding models:

```powershell
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

## Setup (PowerShell)

```powershell
git clone https://github.com/ramdeals0/localchat.git
cd localchat
npm install
Copy-Item .env.example .env
npm run build -w shared
npm run test
npm run dev
```

Open http://127.0.0.1:5173 in your browser.

## Production build

```powershell
npm run build
npm run start
```

Then open http://127.0.0.1:3001.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API port |
| `HOST` | `127.0.0.1` | Bind address (local only) |
| `DATABASE_PATH` | `./data/localchat.db` | SQLite file path |
| `DOCUMENTS_PATH` | `./data/documents` | Stored original uploads |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Default chat model |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Local embedding model |
| `RAG_ENABLED` | `true` | Enable document retrieval |
| `RAG_TOP_K` | `5` | Retrieved chunks per query |
| `RAG_MIN_SIMILARITY` | `0.35` | Minimum cosine similarity |
| `RAG_CHUNK_SIZE` | `800` | Chunk size in characters |
| `RAG_CHUNK_OVERLAP` | `150` | Chunk overlap in characters |

## Phase 1 features

- Create, rename, delete, and switch conversations
- Per-conversation system prompt editor
- Model selector (from Ollama `/api/tags`)
- Streaming replies via Server-Sent Events
- Stop generation, regenerate, export, clear chat
- Ollama connection/status indicator
- Sanitized Markdown rendering

## Phase 2: Offline RAG

Local document intelligence stays entirely on your machine:

```text
Local documents → extract → chunk → embed → search → grounded chat → citations
```

### Import documents

1. Open **Knowledge Base** in the sidebar.
2. Drag and drop or choose files (`.txt`, `.md`, `.pdf`, `.docx`, `.csv`, `.json`).
3. Watch processing status: `queued` → `processing` → `ready` or `failed`.
4. Re-index or delete documents from the table.

Upload limits:

- Max file size: 25 MB
- Max files per import: 10

Original files are stored under `./data/documents`. Chunks and embeddings live in SQLite only.

### Chat with documents

1. Enable **Use documents** in chat.
2. Choose **All ready documents** or **Selected documents only**.
3. Ask a question. LocalChat embeds your message, retrieves matching chunks, injects bounded context into Ollama, and streams the answer.
4. Open clickable citations beneath assistant replies to preview the exact retrieved chunk, similarity score, and highlighted terms.

If no chunk passes `RAG_MIN_SIMILARITY`, LocalChat answers normally and shows “No relevant local sources found”.

### Local privacy guarantees

- No hosted embedding APIs, vector databases, CDNs, or remote storage
- No document content, embeddings, prompts, or metadata leave the computer
- Server binds to `127.0.0.1` only
- Document previews render as sanitized Markdown, never raw HTML

## Offline verification

After dependencies and models are installed:

```powershell
ollama list
npm run dev
```

Disconnect from the internet, then confirm:

- Knowledge Base imports and indexes a local `.txt` or `.md` file
- Chat with **Use documents** enabled returns grounded answers
- Citations open the local source preview panel
- Deleting a document removes it from future retrieval

LocalChat only talks to `127.0.0.1`. No outbound network calls are required at runtime.

## Optional: Docker

```powershell
docker compose up --build
```

Ollama must still run locally on the host at `http://127.0.0.1:11434`.

## Project layout

```
/client          React frontend
/server          Express API, SQLite, RAG pipeline
/shared          Shared TypeScript types
/data            SQLite database and document storage
/.cursor         Local-only architecture rules
```

## Design system

Open the local component gallery at:

`http://127.0.0.1:5173/#/design-system`

It showcases semantic tokens, buttons, badges, message states, source cards, skeletons, and empty states.

## Phase 3: Power Features and Desktop Packaging

### Prompt Library (Phase 3A)

LocalChat stores reusable prompt templates in SQLite (`prompt_templates`). Nothing is synced to the cloud.

**Features**

- Create, edit, duplicate, archive, and pin templates from the sidebar **Prompt Library**
- Built-in editable seeds: Explain clearly, Summarize text, Code review, Rewrite professionally, Analyze local documents
- `{{variable_name}}` placeholders in system and user prompts (names must match `[a-zA-Z][a-zA-Z0-9_]{0,49}`)
- Variable preview in the editor; **Use Template** dialog collects values before launch
- `/prompt` slash command in the chat composer
- **Save as prompt template** on user and assistant message actions
- Non-blocking success/error toasts

**Creating a variable prompt**

1. Open **Prompt Library** → **New Prompt**.
2. Fill in title, category, tags, optional system prompt, and user prompt template.
3. Use `{{topic}}`, `{{text}}`, etc. in your templates — detected variables appear in the preview.
4. Optionally set default model, temperature, RAG default, pin, or archive state.
5. Save. The server parses variables from content and rejects malformed or inconsistent tokens.

**Using a template**

1. Click **Use** on a template (or pick one via `/prompt` in chat).
2. Fill in every required variable in the dialog.
3. LocalChat interpolates both prompts, creates a **new conversation** titled after the template, applies default model/RAG settings, and inserts the interpolated user message as the first turn.
4. Usage count and `last_used_at` update atomically. Incomplete variables are rejected before Ollama is called.

**API**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/prompts` | List templates (filters: `search`, `category`, `tag`, `includeArchived`) |
| `POST` | `/api/prompts` | Create template |
| `GET` | `/api/prompts/:id` | Get one template |
| `PUT` | `/api/prompts/:id` | Update template |
| `DELETE` | `/api/prompts/:id` | Delete template |
| `POST` | `/api/prompts/:id/duplicate` | Duplicate template |
| `POST` | `/api/prompts/:id/use` | Interpolate, create conversation, return route state |
| `POST` | `/api/prompts/:id/render` | Preview interpolation without creating a chat |
| `POST` | `/api/prompts/from-message` | Save a chat message as a template |

**Local storage and privacy**

- All prompt titles, tags, templates, and usage metadata live in `./data/localchat.db` only.
- No prompt content is sent anywhere except to your local Ollama instance when you launch a chat.
- Backups include prompts in workspace ZIP exports.

**Running tests**

```powershell
npm run build -w shared
npm run test -w server
npm run test -w client
# or everything:
npm run test
```

Prompt-specific tests cover variable parsing, interpolation, repository CRUD, atomic template launch, API validation, and integration flows (create, use, archive filter, duplicate).

### Local Search (FTS5)

Phase 3B adds fast, fully local full-text search across conversations, messages, and prompt templates using SQLite FTS5 external-content indexes maintained by database triggers.

**Keyboard shortcuts**

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Command palette (quick actions + debounced local search) |
| `Ctrl/Cmd+Shift+F` | Open dedicated Search page |

**Behavior**

- Search runs only against `./data/localchat.db` on your machine.
- Queries are normalized so user text is treated as plain search terms, not trusted FTS syntax.
- Results include ranked snippets with structured highlight spans (no raw HTML rendering).
- Filters: type, role, model, date range (`from` / `to` ISO dates), citations (`hasCitations`).
- Message results open the conversation, scroll the target into view, and briefly highlight it (respecting `prefers-reduced-motion`).
- Prompt results open the template editor.

**API**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search?q=...` | Search with optional `types`, `role`, `model`, `from`, `to`, `hasCitations`, `limit`, `offset` |
| `POST` | `/api/search/rebuild` | Rebuild all FTS indexes from SQLite source tables |

**Privacy**

- Search queries and message content are not logged in production.
- No remote search provider, telemetry, or hosted index is used.

**Rebuild indexes**

If search results look stale after a restore or migration:

```powershell
# via API while the app is running
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3001/api/search/rebuild
```

Or use **Backup & Import → Rebuild search indexes** in the context panel (confirmation required).

**Troubleshooting**

- **No results:** Confirm data exists locally, try broader keywords, then rebuild indexes.
- **Search unavailable (503):** Your SQLite build may lack FTS5; use the bundled Node `better-sqlite3` build or rebuild indexes after upgrading.
- **Stale results after import:** Run rebuild — triggers re-sync on normal CRUD, but bulk imports call rebuild automatically.

### Export and Import

- Single conversation export: Markdown and JSON (existing)
- ZIP workspace backups with `manifest.json` and SHA-256 checksums
- Validation-first preview before import
- Duplicate strategies: import-new, skip-duplicates, merge-prompts
- Optional passphrase encryption (never stored locally)
- Backup panel in the context sidebar

### Tauri 2 Desktop

See `desktop/README-WINDOWS.md` for packaging commands. Desktop builds:

- Start a loopback sidecar on launch and stop it on exit
- Store SQLite, documents, exports, and logs under `%APPDATA%\\LocalChat`
- Provide tray controls, launch diagnostics, and native open/save dialogs

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Command palette |
| `Ctrl/Cmd+Shift+F` | Open Search page |
| `Ctrl/Cmd+N` | New chat |
| `Ctrl/Cmd+/` | Focus composer |
| `Ctrl/Cmd+B` | Toggle sidebar |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API + Vite dev server |
| `npm run build` | Build shared, server, and client |
| `npm run test` | Run server and client tests |
| `npm run start` | Run production server |
| `npm run desktop:dev` | Run Tauri desktop in dev mode |
| `npm run desktop:build` | Build Windows desktop installer |

## Troubleshooting

**Ollama offline:** Start the Ollama app or run `ollama serve`.

**Chat model missing:** `ollama pull qwen2.5:7b`

**Embedding model missing:** `ollama pull nomic-embed-text`

**Document stuck in failed:** Open the error in Knowledge Base, fix the file, then click **Re-index**.

**Unreadable PDF/DOCX:** Confirm the file opens locally and contains extractable text.

**No relevant sources found:** Lower `RAG_MIN_SIMILARITY` in `.env` or import more closely related documents.

**Port in use:** Change `PORT` in `.env`.

**Database locked:** Close other LocalChat instances using the same `./data/localchat.db`.
