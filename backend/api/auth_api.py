import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()

USERS_PATH = Path(__file__).resolve().parent.parent / "config" / "users.json"

# Demo-only auth: plaintext credentials in config, tokens kept in memory
_active_tokens: dict = {}


def _load_users() -> list:
    return json.loads(USERS_PATH.read_text(encoding="utf-8"))


class LoginRequest(BaseModel):
    controller_id: str
    password: str


class SessionResponse(BaseModel):
    token: str
    controller_id: str
    name: str
    section: str


def _session_from_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    session = _active_tokens.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return session


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest):
    user = next(
        (
            u
            for u in _load_users()
            if u["controller_id"] == payload.controller_id
            and u["password"] == payload.password
        ),
        None,
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid controller ID or password")

    token = uuid.uuid4().hex
    session = {
        "controller_id": user["controller_id"],
        "name": user["name"],
        "section": user["section"],
    }
    _active_tokens[token] = session
    return SessionResponse(token=token, **session)


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return _session_from_token(authorization)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        _active_tokens.pop(authorization.removeprefix("Bearer ").strip(), None)
    return {"status": "logged out"}
