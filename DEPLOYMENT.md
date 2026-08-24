# RailSahayak Deployment Runbook

This runbook covers how to build, run, and monitor RailSahayak in production-like environments.

## Architecture

RailSahayak is a three-service application:

| Service | Role | Default Port | Build Context |
|---------|------|--------------|---------------|
| `api`   | FastAPI decision + sensor + advisory + KPI endpoints | `8000` | `backend/Dockerfile` |
| `comms` | WebSocket controller-to-controller relay | `8001` | `backend/Dockerfile` |
| `frontend` | Next.js 15 dashboard UI | `3000` | Root `Dockerfile` |

## Quick start (Docker Compose)

```bash
docker compose up --build -d
```

Open the dashboard at `http://localhost:3000` and sign in with demo credentials from `backend/config/users.json`.

## Environment variables

Copy `.env.example` to `.env` and set the values you need:

| Variable | Default | Used by |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend |
| `NEXT_PUBLIC_COMM_WS_URL` | `ws://localhost:8001` | Frontend |

Backend environment variables are baked into the Docker images via the Dockerfiles and config files in `backend/config/`.

## Health checks

Each service exposes a health endpoint:

- API: `GET /health` → `{"status": "RailSahayak API running"}`
- Comms: Connect WebSocket and send a `HANDSHAKE`; expect `HANDSHAKE_ACK`.
- Frontend: `GET /` returns the landing page.

`docker compose` will restart unhealthy containers automatically.

## Logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f api
```

## Stopping

```bash
docker compose down
```

To remove persisted volumes (none are mounted by default):

```bash
docker compose down -v
```

## Production notes

- The current auth layer uses in-memory tokens and plaintext demo credentials (`backend/config/users.json`). Replace this with a persistent identity provider before exposing to the internet.
- The decision history, audit log, and KPI snapshots are in-memory. Mount a persistent store (e.g., SQLite/PostgreSQL) if you need data to survive restarts.
- The comms relay buffers offline messages in memory; they are lost on restart.
- Use a reverse proxy (nginx/traefik) with TLS termination in front of the frontend and API.
- Pin `image` tags instead of relying on `build` for reproducible deploys.

## CI/CD

The GitHub Actions workflow in `.github/workflows/ci.yml` runs:

- Frontend lint, typecheck, build, Vitest
- Backend compileall, ruff, mypy, pytest
- Playwright end-to-end tests against the local backend and Next dev server

Merge to `main` only after all three jobs pass.
