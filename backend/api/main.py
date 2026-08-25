from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.advisory import router as advisory_router
from backend.api.audit_api import router as audit_router
from backend.api.auth_api import router as auth_router
from backend.api.chat_api import router as chat_router
from backend.api.crisis_api import router as crisis_router
from backend.api.kpi import router as kpi_router
from backend.api.permissions import (
    ControllerSection,
    assert_decision_allowed,
    get_controller_section,
)
from backend.api.rtis_api import router as rtis_router
from backend.api.sensors_api import router as sensor_router
from backend.api.whatif_api import router as whatif_router
from backend.api.yard_api import router as yard_router
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_router)
app.include_router(yard_router)
app.include_router(auth_router)
app.include_router(advisory_router)
app.include_router(audit_router)
app.include_router(crisis_router)
app.include_router(whatif_router)
app.include_router(chat_router)
app.include_router(kpi_router)
app.include_router(rtis_router)


@app.post("/decision", response_model=SectionDecisionResponse)
def make_decision_route(
    payload: SectionDecisionRequest,
    section: Annotated[ControllerSection, Depends(get_controller_section)],
):
    assert_decision_allowed(payload, section)
    return make_decision(payload)


@app.get("/health")
def health_check():
    return {"status": "RailSahayak API running"}
