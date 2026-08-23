# RailSahayak

RailSahayak is a decision-support and communications dashboard for Indian Railways section controllers. It combines rule-based safety checks (G&SR aligned), operational optimization, and a modern control-room UI for live map monitoring, advisories, and controller-to-controller messaging.

## Highlights

- **Decision engine**: Signal authority, line occupancy, fouling detection, turnout conflicts, and speed restrictions.
- **Optimization**: IR-compliant precedence and order optimization across trains sharing a block and line.
- **Operations UI**: Live yard diagram, AI recommendations panel, and built-in comms gateway.
- **Comms relay**: Separate WebSocket service for controller-to-controller messaging.

## Architecture

- **Frontend (Next.js)**: Control-room dashboard and panels.
- **Backend (FastAPI)**: Decision API and sensor snapshot endpoint.
- **Comms relay (WebSocket)**: Lightweight controller message hub.

## Quick Start

### 0) Docker (all services)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Decision API: http://localhost:8000
- Comms relay: ws://localhost:8001

### 1) Backend API

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.api.main:app --reload
```

API:
- `POST /decision` - decision + optimization output
- `POST /login` / `GET /me` / `POST /logout` - controller auth (demo credentials in `backend/config/users.json`)
- `GET /sensors` - sensor snapshot
- `GET /yards` - list available yard layouts
- `GET /yard/{station_id}` - yard layout schema (drives the dynamic yard map; add `<station>.json` under `backend/config/yards/`)
- `GET /health` - health check

Multi-yard: dashboard picks a station via `?station=<id>` (e.g. `/dashboard?station=vangaon_road`) or the station dropdown. Each `<station>.json` fully defines the yard — lines, turnouts, signals, sensor zones.

### 2) WebSocket Comms Relay

```bash
python backend/communication/ws_server.py
```

Default: `ws://localhost:8001`

Controllers must send a `HANDSHAKE` as the first message. The server then sends `HANDSHAKE_ACK`, a `PRESENCE` snapshot of current peers, and live `PEER_JOIN` / `PEER_LEAVE` broadcasts as other controllers connect or disconnect. Direct messages sent to an offline controller are buffered and delivered as a `REPLAY` when that controller reconnects.

### 3) Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000 - landing page. Sign in at `/login` with demo credentials (`CCG-VR` / `ccgvr123`, `VR-VLSD` / `vrvlsd123`, `VR-BL` / `vrbl123`) to reach the dashboard.

## Demo: Two Controllers on One PC

Open two browser windows with different controller identities:

- **CCG-VR**:
	`http://localhost:3000/?controller_id=CCG-VR&name=Controller%20CCG-VR&section=CCG-VR`

- **VR-VLSD**:
	`http://localhost:3000/?controller_id=VR-VLSD&name=Controller%20VR-VLSD&section=VR-VLSD`

Type a message in one window and it will appear in the other. The peer dropdown shows a green dot when a controller is online and grey when offline.

## Environment

Optional override for the WebSocket relay URL:

```
NEXT_PUBLIC_COMM_WS_URL=ws://localhost:8001
```

## Testing

### Backend

```bash
python -m pytest
```

### Frontend

```bash
npm test                 # unit + component tests (Vitest + React Testing Library)
npm run test:watch       # Vitest watch mode
npm run test:e2e         # end-to-end tests (Playwright)
```

### CI

The GitHub Actions workflow runs three jobs:

- `frontend` — lint, typecheck, build, and Vitest
- `backend` — compileall and pytest
- `e2e` — boots the backend and Next dev server, then runs Playwright in Chromium

## Repository Layout

- `backend/api` - FastAPI decision and sensor endpoints
- `backend/rules` - safety and operational rules (signals, tracks, speed, emergency, turnouts)
- `backend/optimizer` - train order optimization
- `backend/communication` - WebSocket relay for controller-to-controller messaging
- `src/components` - dashboard UI panels and live yard layout

## Notes

- Train types supported: `VANDE_BHARAT`, `RAJDHANI`, `SHATABDI`, `MAIL_EXPRESS`, `PASSENGER`, `MEMU`, `GOODS`, `DEPARTMENTAL`.
- The decision engine expects `block_id|line_id` keys in occupancy contexts.
