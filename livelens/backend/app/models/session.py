from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SessionMode = Literal["observe", "assist", "act"]
AgentPhase = Literal["idle", "listening", "thinking", "speaking", "awaiting_confirmation"]
ActionType = Literal["click", "type", "scroll", "select"]
ActionStatus = Literal["suggested", "confirmed", "executed", "failed"]


class ChecklistItem(BaseModel):
    id: str
    label: str
    completed: bool = False
    detail: str | None = None


class ActionLogItem(BaseModel):
    id: str
    timestamp: datetime
    status: ActionStatus
    description: str


class AgentMessage(BaseModel):
    id: str
    speaker: Literal["agent", "user"]
    text: str
    created_at: datetime


class SuggestedAction(BaseModel):
    action_id: str
    type: ActionType
    target: str
    value: str | None = None
    reason: str
    requires_confirmation: bool = True


class SessionState(BaseModel):
    session_id: str
    mode: SessionMode = "assist"
    phase: AgentPhase = "idle"
    transcript: list[AgentMessage] = Field(default_factory=list)
    checklist: list[ChecklistItem] = Field(default_factory=list)
    action_log: list[ActionLogItem] = Field(default_factory=list)
    screen_summary: str | None = None
    suggested_action: SuggestedAction | None = None
    latest_summary: str | None = None
    preview_image_url: str | None = None
    artifacts: dict[str, str] = Field(default_factory=dict)


class UtteranceRequest(BaseModel):
    text: str


class ConfirmActionRequest(BaseModel):
    approved: bool

