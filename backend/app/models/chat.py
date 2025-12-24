import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str
    fingerprint: str


class ChatResponse(BaseModel):
    response: str
    sources: list[str]
    session_id: str
    user_id: str
    memory_updated: bool


class ChatHistoryMessage(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: Optional[list[str]] = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatHistoryMessage]


class WebSocketMessage(BaseModel):
    type: str
    content: Optional[str] = None
    sources: Optional[list[str]] = None
    message: Optional[str] = None


class RateLimitInfo(BaseModel):
    per_minute: dict
    per_hour: dict
    per_day: dict
