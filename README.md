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
- `GET /sensors` - sensor snapshot
- `GET /yard/{station_id}` - yard layout schema (drives the dynamic yard map; add `<station>.json` under `backend/config/yards/`)
- `GET /health` - health check

### 2) WebSocket Comms Relay

```bash
python backend/communication/ws_server.py
```

Default: `ws://localhost:8001`

### 3) Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Demo: Two Controllers on One PC

Open two browser windows with different controller identities:

- **CCG-VR**:
	`http://localhost:3000/?controller_id=CCG-VR&name=Controller%20CCG-VR&section=CCG-VR`

- **VR-VLSD**:
	`http://localhost:3000/?controller_id=VR-VLSD&name=Controller%20VR-VLSD&section=VR-VLSD`

Type a message in one window and it will appear in the other.

## Environment

Optional override for the WebSocket relay URL:

```
NEXT_PUBLIC_COMM_WS_URL=ws://localhost:8001
```

## Repository Layout

- `backend/api` - FastAPI decision and sensor endpoints
- `backend/rules` - safety and operational rules (signals, tracks, speed, emergency, turnouts)
- `backend/optimizer` - train order optimization
- `backend/communication` - TCP mock + WebSocket relay
- `src/components` - dashboard UI panels and live yard layout

## Notes

- Train types supported: `VANDE_BHARAT`, `RAJDHANI`, `SHATABDI`, `MAIL_EXPRESS`, `PASSENGER`, `MEMU`, `GOODS`, `DEPARTMENTAL`.
- The decision engine expects `block_id|line_id` keys in occupancy contexts.
