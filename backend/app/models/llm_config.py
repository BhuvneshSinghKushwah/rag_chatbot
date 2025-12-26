import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum


class ProviderType(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    GROQ = "groq"


class LLMModelCreate(BaseModel):
    model_name: str
    display_name: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.7
    is_default: bool = False


class LLMModelUpdate(BaseModel):
    model_name: Optional[str] = None
    display_name: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class LLMModelResponse(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    model_name: str
    display_name: Optional[str]
    is_active: bool
    is_default: bool
    max_tokens: int
    temperature: float
    created_at: datetime

    class Config:
        from_attributes = True


class LLMProviderCreate(BaseModel):
    provider_type: ProviderType
    name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_default: bool = False


class LLMProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class LLMProviderResponse(BaseModel):
    id: uuid.UUID
    provider_type: ProviderType
    name: str
    base_url: Optional[str]
    is_active: bool
    is_default: bool
    has_api_key: bool
    created_at: datetime
    updated_at: datetime
    models: list[LLMModelResponse] = []

    class Config:
        from_attributes = True


class LLMProviderListResponse(BaseModel):
    providers: list[LLMProviderResponse]
    total: int


class AvailableModel(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    provider_type: ProviderType
    provider_name: str
    model_name: str
    display_name: str


class AvailableModelsResponse(BaseModel):
    models: list[AvailableModel]
    default_model_id: Optional[uuid.UUID] = None


class TestProviderRequest(BaseModel):
    provider_type: ProviderType
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: str = "test"


class TestProviderResponse(BaseModel):
    success: bool
    message: str
    provider_type: ProviderType
