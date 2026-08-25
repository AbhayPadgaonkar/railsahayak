# RailSahayak Deployment Runbook

This runbook covers how to build, run, and monitor RailSahayak in production-like environments.

## Architecture

RailSahayak is a four-service application:

| Service | Role | Default Port | Build Context |
|---------|------|--------------|---------------|
| `db`    | PostgreSQL database | `5432` | `postgres:16-alpine` image |
| `api`   | FastAPI decision + sensor + advisory + KPI endpoints | `8000` | `backend/Dockerfile` |
| `comms` | WebSocket controller-to-controller relay | `8001` | `backend/Dockerfile` |
| `frontend` | Next.js 15 dashboard UI | `3000` | Root `Dockerfile` |

## Quick start (Docker Compose)

```bash
docker compose up --build -d
```

The `api` container will run `prisma db push` on startup to create/apply the schema against PostgreSQL.

Open the dashboard at `http://localhost:3000` and sign in with demo credentials from `backend/config/users.json`.

## Local development without Docker

1. Start a PostgreSQL 16 server (or use the `db` service from Docker Compose).
2. Create `railsahayak` and `railsahayak_test` databases.
3. Install Prisma Client Python and generate the client:

```bash
pip install -r backend/requirements.txt
python -m prisma generate --schema backend/prisma/schema.prisma
python -m prisma db push --schema backend/prisma/schema.prisma
```

4. Run the API:

```bash
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

## Environment variables

Copy `.env.example` to `.env` and set the values you need:

| Variable | Default | Used by |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend |
| `NEXT_PUBLIC_COMM_WS_URL` | `ws://localhost:8001` | Frontend |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/railsahayak` | Backend Prisma client |
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@localhost:5432/railsahayak_test` | Backend tests |

## Health checks

Each service exposes a health endpoint:

- API: `GET /health` → `{"status": "RailSahayak API running"}`
- Comms: Connect WebSocket and send a `HANDSHAKE`; expect `HANDSHAKE_ACK`.
- Frontend: `GET /` returns the landing page.
- DB: `pg_isready` via Docker Compose healthcheck.

`docker compose` will restart unhealthy containers automatically.

## Database schema changes

Edit `backend/prisma/schema.prisma` and regenerate the client:

```bash
prisma generate --schema backend/prisma/schema.prisma
```

Apply changes to the running database:

```bash
prisma db push --schema backend/prisma/schema.prisma
```

For production, generate and commit migration files with `prisma migrate dev` and run `prisma migrate deploy` instead of `db push`.

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

To remove the persisted PostgreSQL volume:

```bash
docker compose down -v
```

## Production notes

- The current auth layer uses plaintext demo credentials (`backend/config/users.json`) and stores sessions in PostgreSQL. Replace the credential source with a real identity provider before exposing to the internet.
- The comms relay buffers offline messages in memory; they are lost on restart.
- Use a reverse proxy (nginx/traefik) with TLS termination in front of the frontend and API.
- Pin `image` tags instead of relying on `build` for reproducible deploys.

## CI/CD

The GitHub Actions workflow in `.github/workflows/ci.yml` runs:

- Frontend lint, typecheck, build, Vitest
- Backend compileall, ruff, mypy, pytest
- Playwright end-to-end tests against the local backend and Next dev server

Merge to `main` only after all three jobs pass.
