import uuid
from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentVisibility(str, Enum):
    GLOBAL = "global"
    PRIVATE = "private"
    SHARED = "shared"


class DocumentBase(BaseModel):
    filename: str
    file_type: str


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: uuid.UUID
    original_filename: str
    file_size_bytes: int
    status: DocumentStatus
    chunks_count: int
    visibility: DocumentVisibility
    created_at: datetime
    processed_at: Optional[datetime] = None
    can_edit: bool = False
    can_delete: bool = False

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: DocumentStatus
    message: str


class DocumentUpdate(BaseModel):
    filename: Optional[str] = None
    visibility: Optional[DocumentVisibility] = None


class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str
    page_number: Optional[int] = None

    model_config = {"from_attributes": True}
