from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.sensors_api import router as sensor_router
from backend.api.yard_api import router as yard_router
from backend.api.auth_api import router as auth_router
from backend.api.advisory import router as advisory_router
from backend.services.decision_service import (
    SectionDecisionRequest,
    SectionDecisionResponse,
    make_decision,
)

app = FastAPI(
    title="RailSahayak Decision API",
    description="G&SR-compliant railway decision support system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_router)
app.include_router(yard_router)
app.include_router(auth_router)
app.include_router(advisory_router)


@app.post("/decision", response_model=SectionDecisionResponse)
def make_decision_route(payload: SectionDecisionRequest):
    return make_decision(payload)


@app.get("/health")
def health_check():
    return {"status": "RailSahayak API running"}
