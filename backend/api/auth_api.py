import json
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.database import get_client

router = APIRouter()

USERS_PATH = Path(__file__).resolve().parent.parent / "config" / "users.json"


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
    db = get_client()
    session = db.session.find_unique(where={"token": token})
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {
        "controller_id": session.controller_id,
        "name": session.name,
        "section": session.section,
    }


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
    db = get_client()
    db.session.create(
        data={
            "token": token,
            "controller_id": session["controller_id"],
            "name": session["name"],
            "section": session["section"],
            "created_at": time.time(),
        }
    )
    return SessionResponse(token=token, **session)


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return _session_from_token(authorization)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        db = get_client()
        db.session.delete_many(where={"token": token})
    return {"status": "logged out"}
