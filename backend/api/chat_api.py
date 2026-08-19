from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.chat_assistant import answer_for, quick_prompts

router = APIRouter()


class Chip(BaseModel):
    label: str
    section: Optional[str] = None


class AssistantResponse(BaseModel):
    answer: str
    chips: List[Chip]


class AssistantQuery(BaseModel):
    message: Optional[str] = ""


class QuickPromptsResponse(BaseModel):
    prompts: List[str]


@router.get("/assistant/prompts", response_model=QuickPromptsResponse)
def get_quick_prompts():
    return QuickPromptsResponse(prompts=quick_prompts())


@router.post("/assistant", response_model=AssistantResponse)
def ask_assistant(payload: AssistantQuery):
    result = answer_for(payload.message or "")
    return AssistantResponse(
        answer=result["answer"],
        chips=[Chip(**c) for c in result["chips"]],
    )