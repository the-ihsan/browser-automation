# playwright-tools — Agent Context

This document describes the architecture, requirements, and coding rules for AI agents working on this repository.

> **Keep this file updated.** It is the source of truth for agents. When you change architecture, add features, rename channels, or introduce new conventions, update `context.md` in the same PR/commit. Do not leave it stale — outdated context causes wrong assumptions and bad diffs.

## Purpose

**playwright-tools** is a desktop app (Tauri) that runs Playwright browser automation in a Python sidecar. The Python process owns the browser; the React UI sends commands and receives state updates. Python is responsible only for browser control, scraping, and returning data — not UI or app lifecycle.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React UI (src/)                                                │
│  Redux Toolkit state · shadcn/ui components                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Tauri invoke + events
┌───────────────────────────▼─────────────────────────────────────┐
│  Rust host (src-tauri/)                                         │
│  commands/ → sidecar bus → daemon stdin/stdout                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ NDJSON (one JSON object per line)
┌───────────────────────────▼─────────────────────────────────────┐
│  Python daemon (py-sidecar/)                                    │
│  sidecar/ bus · registry · handlers                             │
│  browser/ Playwright lifecycle · scraping (future)              │
└─────────────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Owns | Must NOT own |
|-------|------|--------------|
| **React (`src/`)** | UI, client state, user interactions | Playwright, browser process, scraping logic |
| **Rust (`src-tauri/`)** | Process spawn/kill, NDJSON I/O, thin Tauri bridge, local SQLite (Diesel) | Business logic, Playwright |
| **Python sidecar (`py-sidecar/sidecar/`)** | Message bus, handler registry, transport | UI concerns |
| **Python browser (`py-sidecar/browser/`)** | Playwright lifecycle, page actions, scrape results | Tauri/Rust/React details |

### Data flow

1. UI dispatches a Redux thunk → calls `src/lib/api.ts` → `invoke("comm_request", …)`.
2. Rust `commands/mod.rs` forwards to `sidecar::send_req` → writes NDJSON to daemon stdin.
3. Python `bus.ingest` routes the request → `registry` handler → result written to stdout.
4. Rust reads stdout → completes pending request → returns to UI.
5. Python **events** (e.g. `browser.closed`) travel stdout → Rust `daemon.rs` → Tauri event `daemon://browser` → UI listener dispatches Redux action.

---

## Communication protocol

All sidecar messages are **NDJSON** on stdin/stdout. **stderr is not used for app logic** (drained silently to avoid pipe blocking).

### Message kinds

```json
{ "kind": "event",    "channel": "...", "payload": ... }
{ "kind": "request",  "id": "<pid>-<n>", "channel": "...", "payload": ... }
{ "kind": "response", "id": "<pid>-<n>", "channel": "...", "payload": ... }
{ "kind": "response", "id": "<pid>-<n>", "channel": "...", "error": "..." }
```

### Channel naming

Use dot-separated namespaces: `browser.launch`, `browser.stop`, `scrape.page`, etc.

### Registered Python request channels (browser)

| Channel | Payload | Returns |
|---------|---------|---------|
| `browser.launch` | `{ headless: bool }` | `BrowserRun` |
| `browser.stop` | `{ run_id: string }` | `BrowserRun` |
| `browser.status` | `{ run_id?: string }` | `BrowserRun` |
| `browser.recover` | `{ run_id?: string }` | `BrowserRun` |
| `browser.install.status` | `{}` | `{ ok: boolean, installed: boolean }` |
| `browser.install.run` | `{}` | `{ ok: boolean, installed: boolean, error?: string }` |

### Registered Python request channels (sessions)

| Channel | Payload | Returns |
|---------|---------|---------|
| `session.launch` | `{ session_id, session_dir, headless?, fresh? }` | `SessionRun` (+ `session_id`) |
| `session.stop` | `{ session_id, session_dir, run_id? }` | `SessionRun` |
| `session.check` | `{ session_id, session_dir, check_url }` | `{ ok, logged_in, url, cookie_count, … }` |

### Registered Python request channels (LinkedIn posts)

| Channel | Payload | Returns |
|---------|---------|---------|
| `linkedin.posts.run.start` | `{ run_id, profile_url, sessions[], headless?, post_count?, start_from?, post_matcher?, initial_post_ids?, resume_from_ordinal?, existing_post_ids? }` | `{ ok, run_id }` |

### LinkedIn posts events (Python → Rust → UI)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `linkedin.posts.run.control` | Rust→Python | `{ run_id, action: pause\|resume\|stop }` |
| `linkedin.posts.run.post` | Python→Rust | `{ run_id, post, ordinal, matched, session_id }` — Rust persists to DB |
| `linkedin.posts.run.anchor` | Python→Rust | `{ run_id, initial_top_post_id, initial_post_ids }` |
| `linkedin.posts.run.progress` | Python→Rust | `{ run_id, collected, matched, url }` |
| `linkedin.posts.run.finished` | Python→Rust | `{ run_id, ok, error? }` |
| `linkedin.posts.run.error` | Python→Rust | Session rotation signal |

Cookies persist as Playwright `storage_state.json` under `{app_data_dir}/sessions/{session_id}/`. Load on launch (unless `fresh: true`); save on stop and when the user closes the browser window.

### BrowserRun shape

```typescript
{
  ok: boolean;
  run_id: string;      // UUID per browser session
  running: boolean;
  headless: boolean;
  url: string;
  crashed: boolean;
}
```

Each browser session gets a unique `run_id`. Pass it on stop/status/recover to target a specific instance. UI polls status and listens for `browser.closed` events to stay in sync when the user closes the window externally.

### Tauri events (Python → UI)

| Tauri event | When |
|-------------|------|
| `daemon://browser` | Python emits `browser.*` event (payload includes channel + payload) |
| `daemon://session` | Python emits `session.*` event (e.g. `session.closed` when user closes the window) |
| `daemon://linkedin-posts` | Python emits `linkedin.posts.*` event (scrape progress, posts, finished) |

---

## Directory structure

```
playwright-tools/
├── src/                      # React frontend
│   ├── App.tsx               # Startup gate: checking → setup → main app
│   ├── components/
│   │   ├── CheckingScreen.tsx
│   │   ├── MainApp.tsx       # Dashboard routes (sidebar + tool pages)
│   │   ├── SetupScreen.tsx   # First-run Chromium install
│   │   ├── layout/           # DashboardLayout, AppSidebar
│   │   └── ui/               # shadcn components (prefer CLI: pnpm dlx shadcn@latest add …)
│   ├── lib/
│   │   ├── api.ts            # Tauri invoke wrappers + event subscriptions
│   │   ├── linkedin/posts/api.ts  # LinkedIn posts scraper invoke + events
│   │   ├── sessions/api.ts   # Session CRUD + launch/check
│   │   ├── tools/registry.ts # Platform + tool definitions (hardcoded sidebar nav)
│   │   └── utils.ts          # cn() etc.
│   ├── tools/
│   │   ├── browser/          # Core browser control tool
│   │   ├── linkedin/posts/   # LinkedIn posts scraper UI
│   │   ├── sessions/         # Per-platform session management UI
│   │   └── shared/           # ToolPage router, placeholders
│   └── store/
│       ├── browserSlice.ts
│       ├── linkedin/postsSlice.ts
│       ├── sessionsSlice.ts
│       └── setupSlice.ts
├── src-tauri/src/
│   ├── db/                   # Diesel — sessions + linkedin_posts_runs tables
│   ├── commands/             # comm, db, sessions, linkedin_posts
│   ├── platforms/linkedin/   # Run orchestrator + event handlers
│   └── …
├── py-sidecar/browser/
│   ├── manager.py              # Core single-browser tool
│   └── sessions/               # Per-session browsers + cookie files
├── py-sidecar/linkedin/posts/  # LinkedIn profile posts scraper
├── pyproject.toml            # uv, playwright dep, pyright config
└── package.json              # pnpm, Tauri, Vite, Redux, shadcn
```

---

## Requirements & constraints

### Python / Playwright

- **Playwright is not bundled.** Browser binaries install via `python -m playwright install chromium` (`browser/install.py`). Install detection uses Playwright's `chromium.executable_path` — no manual cache path logic. On app startup the UI calls `browser.install.status`; if Chromium is missing, a setup screen runs `browser.install.run`.
- **Cross-platform:** Linux, macOS, Windows. Use `chromium_launch_kwargs()` in `browser/launch.py` for container-safe flags.
- **Atomic browser control:** `BrowserManager` (core tool) and `SessionManager` (persisted sessions) each own their browser lifecycle. Handlers stay thin; domain logic lives in `manager.py` / `sessions/manager.py`.
- **Dev:** `uv run python py-sidecar/sidecar/daemon.py` (spawned automatically by `pnpm dev`).
- **Prod:** PyInstaller binary `playwright-tools-daemon` under `resources/sidecar/` (build script TBD).

### Frontend

- **shadcn/ui** for components — prefer `pnpm dlx shadcn@latest add <component>` over hand-writing UI primitives.
- **Redux Toolkit** for state — async work via `createAsyncThunk`; selectors in slices; typed hooks from `store/hooks.ts`.
- **Path alias:** `@/` → `src/`.

### Logging

- **No verbose logging by default.** `trace()` in Python is a no-op stub. Add logging surgically when debugging.
- Do not add per-message bus logging in production paths.

---

## Decoupling rules

These rules keep modules independent and testable. Follow them strictly.

### 1. One direction of dependency

```
UI → api.ts → Tauri commands → Rust sidecar bus → Python bus → handlers → domain logic
```

Never import "up" the stack (e.g. Python must not know about React; handlers must not import Tauri types).

### 2. Handlers are thin adapters

Python `handlers.py` files only:
- Parse payload dicts
- Call domain module (e.g. `get_manager().start(...)`)
- Map domain types to response dicts

**No Playwright calls in handlers.** Put logic in `manager.py`, `pages.py`, or future scrape modules.

### 3. Domain modules are sidecar-agnostic

`browser/manager.py`, future `scrape/*.py`, etc. should not import `sidecar.bus` except when emitting events (e.g. `browser.closed`). Prefer returning data to handlers; let handlers emit if needed.

### 4. Register handlers via import side-effect

New Python feature modules register in `sidecar/__init__.py`:

```python
import myfeature.handlers as _myfeature_handlers  # noqa: F401
```

Do not register handlers inside `daemon.py` or `bus.py`.

### 5. Frontend: api.ts is the only Tauri boundary

- Components and slices call `@/lib/api.ts`, never `@tauri-apps/api` directly (except inside `api.ts`).
- Redux slices call api functions inside thunks, not components calling api + dispatching manually for the same flow.

### 6. Rust commands stay thin

`commands/mod.rs` forwards to `sidecar::send_req` / `sidecar::emit`. Database access lives in `db/` and is exposed via dedicated commands in `commands/db.rs`. Add a dedicated Tauri command only when the UI needs Rust-native behavior (filesystem, windows, DB). Otherwise use generic `comm_request(channel, payload)`.

### 7. Modular tools on the frontend

- **Registry:** `src/lib/tools/registry.ts` lists platforms and tools (sidebar source of truth for navigation). Omit `component` for unimplemented tools — `ToolPage` renders a placeholder.
- **Tool pages:** `src/tools/<platform>/` or `src/tools/<name>/` — one module per tool; wire `component` in the registry.
- **Layout:** `DashboardLayout` + `AppSidebar` — do not embed tool UIs directly in layout components.

### 8. Separate slices by domain

One Redux slice per domain (`browserSlice`, future `scrapeSlice`). Do not put unrelated state in one slice.

### 9. Events for push; requests for pull

- **Request/response:** commands with a return value (launch, stop, status, scrape result).
- **Events:** unsolicited updates (browser closed, progress). Emit from Python; forward in `daemon.rs` if UI needs them.

### 10. Mirror bus/registry in Rust and Python

When adding Rust-side handlers (`sidecar/builtins.rs`), keep channel names and payload shapes identical to Python. The two registries are symmetric but independent.

---

## Local database (Diesel + SQLite)

- **Location:** `{app_data_dir}/playwright-tools.db` (created on first launch).
- **Cookie files:** `{app_data_dir}/sessions/{session_id}/storage_state.json` (not in DB).
- **Migrations:** `src-tauri/migrations/` — embedded at runtime via `diesel_migrations`.
- **Schema:** `sessions` table — `id`, `platform`, `name`, `status`, `active_run_id`, `last_checked_at`, timestamps. `linkedin_posts_runs` + `linkedin_posts_runs_item` — scrape run metadata and scraped posts. Tools/platforms are **not** in the DB; they live in `src/lib/tools/registry.ts`.
- **Module:** `src-tauri/src/db/` — `connection.rs`, `schema.rs`, `models.rs`, `sessions.rs`, `linkedin_posts.rs`.
- **Tauri commands:** `sessions_list`, `sessions_create`, `sessions_delete`, `sessions_launch`, `sessions_check`, `db_health`, `linkedin_posts_runs_list`, `linkedin_posts_runs_get`, `linkedin_posts_runs_items_list`, `linkedin_posts_run_create`, `linkedin_posts_run_pause`, `linkedin_posts_run_resume`, `linkedin_posts_run_stop`, `linkedin_posts_run_restart`.

### New migration

```bash
cd src-tauri && diesel migration generate <name>   # requires diesel-cli
cd src-tauri && diesel migration run               # dev only; app runs pending migrations on startup
```

---

## Coding conventions

### Python

- Python ≥ 3.11, async handlers for I/O (`@registry.on_req` supports async).
- Type hints on public functions; dataclasses for structured return types (`BrowserRunInfo`).
- Use `uv` for deps (`uv add`, `uv sync`). Pyright config in `pyproject.toml`.
- Package layout: `py-sidecar/` on `sys.path`; imports are `from sidecar…` and `from browser…`.

### Rust

- Minimal `unwrap()` in hot paths; propagate `Result` from commands.
- Sidecar I/O on background threads (`daemon.rs`); bus ingest is sync.

### TypeScript / React

- Strict TypeScript. Shared API types live in `lib/api.ts`.
- Functional components, hooks, no class components.
- Side effects (polling, event subscriptions) in `useEffect` in the component or a dedicated hook — dispatch Redux actions, don't mutate local duplicates of store state.
- Use shadcn `Button`, `Checkbox`, `Spinner`, etc. for UI.

---

## Adding a new feature (checklist)

Example: add `scrape.navigate` request.

### Python

1. Create `py-sidecar/scrape/` with domain logic (navigation, extraction).
2. Create `py-sidecar/scrape/handlers.py` with `@registry.on_req("scrape.navigate")`.
3. Register: `import scrape.handlers` in `sidecar/__init__.py`.
4. Add deps to `pyproject.toml` if needed.

### Frontend

1. Add typed wrapper in `src/lib/api.ts`.
2. Add slice or extend existing slice with thunk + selectors in `src/store/`.
3. Register tool in `src/lib/tools/registry.ts` (platform group + optional `component`).
4. Create page under `src/tools/<platform>/` or `src/tools/<name>/`.
5. Tool appears in sidebar automatically via registry; routing is `/tools/:platform/:toolSlug`.

### Rust (only if needed)

- Generic `comm_request` is enough for most automation features.
- Persisted data → add Diesel migration + `db/` query functions + `commands/db.rs` command.
- Forward new Python events in `daemon.rs` if UI must react in real time.

---

## Anti-patterns (do not)

- Put Playwright or scraping logic in React or Rust.
- Bundle Playwright browser binaries with the app.
- Add verbose logging on the NDJSON bus hot path.
- Create monolithic `App.tsx` or god-module handlers — extract as features grow.
- Bypass `run_id` when stopping or checking browser state.
- Import between unrelated domain modules (e.g. `scrape/` importing from unrelated packages).
- Hand-write shadcn primitives when the CLI can add them.
- Commit secrets or `.env` credentials.

---

## Dev commands

```bash
pnpm dev          # Tauri dev (spawns Python daemon via uv)
pnpm build        # Production Tauri build
pnpm build:ui     # Frontend only
uv sync           # Install Python deps
uv run pyright py-sidecar/   # Type-check Python
```

---

## Key files quick reference

| Concern | File |
|---------|------|
| Python entrypoint | `py-sidecar/sidecar/daemon.py` |
| Handler registration | `py-sidecar/sidecar/__init__.py` |
| Browser lifecycle | `py-sidecar/browser/manager.py` |
| Browser bus API | `py-sidecar/browser/handlers.py` |
| Daemon spawn | `src-tauri/src/daemon.rs` |
| Tauri commands | `src-tauri/src/commands/mod.rs` |
| Frontend API | `src/lib/api.ts` |
| Browser Redux state | `src/store/browserSlice.ts` |
| Tool registry / sidebar | `src/lib/tools/registry.ts` |
| LinkedIn posts scraper UI | `src/tools/linkedin/posts/LinkedInPostsScraperPage.tsx` |
| LinkedIn posts Redux | `src/store/linkedin/postsSlice.ts` |
| LinkedIn posts API | `src/lib/linkedin/posts/api.ts` |
| LinkedIn posts orchestrator | `src-tauri/src/platforms/linkedin/orchestrator.rs` |
| LinkedIn posts Python scraper | `py-sidecar/linkedin/posts/scraper.py` |
| Session management UI | `src/tools/sessions/PlatformSessionsPage.tsx` |
| Session Redux state | `src/store/sessionsSlice.ts` |
| Session API | `src/lib/sessions/api.ts` |
| Dashboard layout | `src/components/layout/DashboardLayout.tsx` |
| Local DB (sessions) | `src-tauri/src/db/sessions.rs` |
| Cookie persistence | `py-sidecar/browser/sessions/manager.py` |

---

## Maintaining this document

**Agents and contributors must update `context.md` whenever a change would make this file inaccurate.** Treat it as part of the definition of done — not optional documentation.

### When to update

| Change | What to update in `context.md` |
|--------|--------------------------------|
| New bus channel or event | Communication protocol tables, channel naming examples |
| New Python package or Rust module | Directory structure, layer responsibilities |
| New Redux slice or API wrapper | Directory structure, frontend conventions, key files table |
| New decoupling rule or anti-pattern discovered | Decoupling rules / Anti-patterns sections |
| Build or dev workflow change | Dev commands, requirements |
| Responsibility shift between layers | Architecture diagram, layer table, anti-patterns |
| New Tauri event for UI push | Tauri events table |

### How to update

1. **Verify against code** — read the actual implementation; do not document intent that differs from reality.
2. **Keep it concise** — tables and bullet lists over long prose; remove sections that no longer apply.
3. **Update all affected sections** — a new channel belongs in the protocol table *and* the feature checklist if the pattern changes.
4. **Do not duplicate** — one canonical description per concept; link by section name rather than repeating.
5. **Same change set** — include `context.md` edits in the commit/PR that introduces the architectural change, not a follow-up.

### What not to do

- Add changelog-style history or dated entries — the file reflects **current** state only.
- Document every file — only structure, contracts, and rules agents need to work correctly.
- Skip updates because the change "seems small" — renamed channels and moved modules break agents silently.
