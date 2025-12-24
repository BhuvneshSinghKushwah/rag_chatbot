import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.db.postgres import Document, DocumentChunk
from app.models.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
    DocumentStatus,
    DocumentVisibility,
)
from app.services.document import get_document_processor
from app.services.qdrant import get_qdrant_service

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()

ADMIN_API_KEY = "admin-secret-key"


def verify_admin_key(x_admin_key: Optional[str] = Header(None)) -> str:
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return x_admin_key


@router.get("", response_model=DocumentListResponse)
async def list_documents(db: AsyncSession = Depends(get_db)):
    query = (
        select(Document)
        .where(
            Document.visibility == "global",
            Document.deleted_at.is_(None),
            Document.status == "ready",
        )
        .order_by(Document.created_at.desc())
    )

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in documents],
        total=len(documents),
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    query = select(Document).where(
        Document.id == document_id,
        Document.deleted_at.is_(None),
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse.model_validate(document)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    processor = get_document_processor()
    qdrant = get_qdrant_service()

    content = await file.read()

    try:
        file_info = await processor.process_upload(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = await db.execute(
        select(Document).where(Document.file_hash == file_info["file_hash"])
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Document already exists")

    doc_id = uuid.uuid4()
    storage_path = await processor.save_document(
        str(doc_id),
        file_info["file_type"],
        content,
    )

    document = Document(
        id=doc_id,
        filename=file.filename,
        original_filename=file.filename,
        file_type=file_info["file_type"],
        file_size_bytes=file_info["file_size_bytes"],
        file_hash=file_info["file_hash"],
        storage_path=storage_path,
        status="processing",
        visibility="global",
        owner_id=None,
    )
    db.add(document)
    await db.commit()

    try:
        chunks = processor.extract_and_chunk(
            content,
            file_info["file_type"],
            chunk_size=500,
            chunk_overlap=50,
        )

        vector_ids = await qdrant.add_chunks(
            document_id=str(doc_id),
            chunks=chunks,
            visibility="global",
        )

        for chunk, vector_id in zip(chunks, vector_ids):
            db_chunk = DocumentChunk(
                document_id=doc_id,
                chunk_index=chunk["chunk_index"],
                content=chunk["content"],
                content_hash=chunk["content_hash"],
                vector_id=vector_id,
                start_char=chunk.get("start_char"),
                end_char=chunk.get("end_char"),
                page_number=chunk.get("page_number"),
            )
            db.add(db_chunk)

        document.status = "ready"
        document.chunks_count = len(chunks)
        document.processed_at = datetime.utcnow()
        await db.commit()

        return DocumentUploadResponse(
            id=doc_id,
            filename=file.filename,
            status=DocumentStatus.READY,
            message=f"Document processed with {len(chunks)} chunks",
        )

    except Exception as e:
        document.status = "failed"
        document.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")


@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    query = select(Document).where(
        Document.id == document_id,
        Document.deleted_at.is_(None),
    )
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    qdrant = get_qdrant_service()
    qdrant.delete_by_document(str(document_id))

    document.deleted_at = datetime.utcnow()
    await db.commit()

    return {"message": "Document deleted"}
