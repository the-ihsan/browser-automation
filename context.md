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
| **Rust (`src-tauri/`)** | Process spawn/kill, NDJSON I/O, thin Tauri bridge | Business logic, Playwright |
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

---

## Directory structure

```
playwright-tools/
├── src/                      # React frontend
│   ├── App.tsx               # Startup gate: checking → setup → main app
│   ├── components/
│   │   ├── CheckingScreen.tsx
│   │   ├── MainApp.tsx       # Browser launch/stop UI
│   │   ├── SetupScreen.tsx   # First-run Chromium install
│   │   └── ui/               # shadcn components (prefer CLI: pnpm dlx shadcn@latest add …)
│   ├── lib/
│   │   ├── api.ts            # Tauri invoke wrappers + event subscriptions
│   │   └── utils.ts          # cn() etc.
│   └── store/
│       ├── index.ts          # configureStore
│       ├── hooks.ts          # useAppDispatch, useAppSelector
│       ├── browserSlice.ts   # browser domain state + thunks
│       └── setupSlice.ts     # Chromium install check + first-run setup
├── src-tauri/src/
│   ├── lib.rs                # App setup, daemon spawn on start, kill on exit
│   ├── daemon.rs             # Spawn/kill Python, stdout/stderr pipes
│   ├── state.rs              # AppState, DaemonHandle
│   ├── commands/mod.rs       # Tauri commands (thin bridge to sidecar bus)
│   └── sidecar/              # Rust mirror of Python bus (bus, registry, transport)
├── py-sidecar/
│   ├── sidecar/
│   │   ├── daemon.py         # Entrypoint (stdin reader thread + asyncio loop)
│   │   ├── bus.py            # ingest, emit, send_req
│   │   ├── registry.py       # on, on_req, dispatch_event
│   │   ├── transport.py      # NDJSON stdout writer; trace() is no-op stub
│   │   └── builtins.py       # Test/demo handlers
│   └── browser/
│       ├── handlers.py       # @registry.on_req — thin, delegates to manager
│       ├── manager.py        # BrowserManager — atomic start/recover/stop
│       ├── launch.py         # Chromium launch kwargs
│       ├── install.py        # Playwright install + executable_path check
│       ├── pages.py          # Page helpers
│       └── errors.py         # is_recoverable_browser_error()
├── pyproject.toml            # uv, playwright dep, pyright config
└── package.json              # pnpm, Tauri, Vite, Redux, shadcn
```

---

## Requirements & constraints

### Python / Playwright

- **Playwright is not bundled.** Browser binaries install via `python -m playwright install chromium` (`browser/install.py`). Install detection uses Playwright's `chromium.executable_path` — no manual cache path logic. On app startup the UI calls `browser.install.status`; if Chromium is missing, a setup screen runs `browser.install.run`.
- **Cross-platform:** Linux, macOS, Windows. Use `chromium_launch_kwargs()` in `browser/launch.py` for container-safe flags.
- **Atomic browser control:** Only `BrowserManager` launches/stops/recovers the browser. Handlers and future scrapers receive pages via the manager; use `recover()` for in-process restart on failure.
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

`commands/mod.rs` forwards to `sidecar::send_req` / `sidecar::emit`. Add a dedicated Tauri command only when the UI needs Rust-native behavior (filesystem, windows). Otherwise use generic `comm_request(channel, payload)`.

### 7. Separate slices by domain

One Redux slice per domain (`browserSlice`, future `scrapeSlice`). Do not put unrelated state in one slice.

### 8. Events for push; requests for pull

- **Request/response:** commands with a return value (launch, stop, status, scrape result).
- **Events:** unsolicited updates (browser closed, progress). Emit from Python; forward in `daemon.rs` if UI needs them.

### 9. Mirror bus/registry in Rust and Python

When adding Rust-side handlers (`sidecar/builtins.rs`), keep channel names and payload shapes identical to Python. The two registries are symmetric but independent.

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
3. Build UI in a component; wire via `useAppDispatch` / `useAppSelector`.

### Rust (only if needed)

- Generic `comm_request` is enough for most features.
- Add Rust handler in `sidecar/builtins.rs` only for host-native operations.
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
