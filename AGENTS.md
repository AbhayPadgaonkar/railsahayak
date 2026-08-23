# AGENTS.md — RailSahayak

Agent-focused notes for working in this repo.

## Repository

- Monorepo: Next.js 15 frontend (`src/`) + FastAPI backend (`backend/`).
- Working branch pattern: `rah-<short-description>`.
- Merge workflow: push branch → open PR → wait for CI (frontend/backend/e2e) → merge squash/merge → pull `main` locally.
- `roadmap.md` exists locally but is **gitignored**; update it after merging, do not commit it.

## Tech stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind v4, Vitest + React Testing Library, Playwright.
- **Backend**: Python 3.12, FastAPI, Pydantic v2, OR-Tools, pytest.
- **Comms relay**: separate Python WebSocket server (`backend/communication/ws_server.py`) on port 8001.

## Running locally

### Backend API

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Demo login credentials are in `backend/config/users.json` (e.g. `CCG-VR` / `ccgvr123`).

### Comms relay

```bash
python backend/communication/ws_server.py
```

## Testing

| Suite | Command |
|-------|---------|
| Backend unit tests | `.venv\Scripts\python.exe -m pytest` |
| Frontend unit/component tests | `npm test` |
| Frontend tests watch mode | `npm run test:watch` |
| E2E | `npm run test:e2e` |

CI runs three jobs: `frontend`, `backend`, and `e2e`.

### Frontend test notes

- Vitest config: `vitest.config.mts`; setup file: `vitest.setup.ts`.
- `vitest.setup.ts` stubs `requestAnimationFrame` and SVG path measurement APIs because components render in jsdom.
- Mock `next/navigation` and `@/lib/api` in component tests.
- Test fixtures/helpers live in `src/test/helpers.ts`.

### E2E notes

- Playwright config: `playwright.config.ts`.
- Tests inject a fake `railsahayak_session` into `localStorage` via `page.addInitScript` to bypass `/login`.
- CI spins up the backend (`uvicorn`) and Next dev server via Playwright `webServer`.
- Backend CORS allows both `http://localhost:3000` and `http://127.0.0.1:3000`.

## Common gotchas

- `package-lock.json` is managed by npm 11 (Node 24). If `npm ci` fails with `Invalid Version:`, delete `node_modules` and `package-lock.json` and run `npm install` to regenerate.
- The decision engine expects `block_id|line_id` strings in occupancy contexts.
- Frontend API calls use `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
- Yard schemas use forward `next_blocks` references; the builder validates all block ids before checking next references.
