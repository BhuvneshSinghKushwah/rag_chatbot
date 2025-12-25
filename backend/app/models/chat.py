import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str
    fingerprint: str
    model_id: Optional[uuid.UUID] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    user_id: str
    memory_updated: bool


class ChatHistoryMessage(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatHistoryMessage]


class WebSocketMessage(BaseModel):
    type: str
    content: Optional[str] = None
    message: Optional[str] = None
    retry_after: Optional[float] = None
    limits: Optional[dict] = None
    error_type: Optional[str] = None
    is_retryable: Optional[bool] = None


class RateLimitInfo(BaseModel):
    per_minute: dict
    per_hour: dict
    per_day: dict


class ConversationSummary(BaseModel):
    id: uuid.UUID
    session_id: str
    preview: str
    message_count: int
    created_at: datetime
    updated_at: datetime


class ConversationsListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int
