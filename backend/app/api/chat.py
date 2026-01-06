import logging
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.db.redis import get_redis, RedisCache
from app.db.postgres import Conversation, Message
from app.config import get_settings
from app.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatHistoryResponse,
    ChatHistoryMessage,
    WebSocketMessage,
    ConversationSummary,
    ConversationsListResponse,
    SourceInfo,
    ContextSourceType,
)
from app.models.llm_config import AvailableModelsResponse
from app.services.chat import get_chat_service
from app.services.rate_limiter import RateLimiter
from app.services.llm import LLMException, get_llm_service

router = APIRouter(prefix="/api/chat", tags=["chat"])
settings = get_settings()
logger = logging.getLogger(__name__)


async def get_rate_limiter() -> RateLimiter:
    redis_client = await get_redis()
    cache = RedisCache(redis_client)
    return RateLimiter(cache, settings.RATE_LIMIT_SALT)


@router.websocket("/ws")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str = Query(...),
    fingerprint: str = Query(...),
    model_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await websocket.accept()

    redis_client = await get_redis()
    cache = RedisCache(redis_client)
    rate_limiter = RateLimiter(cache, settings.RATE_LIMIT_SALT)
    chat_service = get_chat_service()

    user_id = await rate_limiter.resolve_user_id(fingerprint, websocket)
    parsed_model_id = UUID(model_id) if model_id else None

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            content = data.get("content", "")
            msg_model_id = data.get("model_id")

            if msg_model_id:
                try:
                    parsed_model_id = UUID(msg_model_id)
                except ValueError:
                    pass

            if msg_type != "message" or not content:
                await websocket.send_json(
                    WebSocketMessage(type="error", message="Invalid message format").model_dump()
                )
                continue

            rate_check = await rate_limiter.check_rate_limit(fingerprint, websocket)
            if not rate_check["allowed"]:
                await websocket.send_json(
                    WebSocketMessage(
                        type="rate_limited",
                        message=f"Rate limit exceeded. Retry after {rate_check.get('retry_after', 60)} seconds",
                        retry_after=rate_check.get("retry_after", 60),
                        limits=rate_check["limits"],
                    ).model_dump()
                )
                continue

            await rate_limiter.increment(fingerprint, websocket)

            try:
                source_info_sent = False
                async for chunk, context_result in chat_service.chat_stream(
                    db=db,
                    message=content,
                    session_id=session_id,
                    user_id=user_id,
                    model_id=parsed_model_id,
                ):
                    if chunk:
                        msg = WebSocketMessage(type="token", content=chunk)
                        if context_result and not source_info_sent:
                            msg.source_info = SourceInfo(
                                source_type=ContextSourceType(context_result.source.value),
                                sources=context_result.sources
                            )
                            source_info_sent = True
                        await websocket.send_json(msg.model_dump())

                await websocket.send_json(
                    WebSocketMessage(type="complete").model_dump()
                )

            except LLMException as e:
                logger.warning(
                    f"LLM error in chat stream",
                    extra={
                        "session_id": session_id,
                        "user_id": user_id,
                        "error_type": e.error.error_type,
                        "provider": e.error.provider,
                        "retry_after": e.error.retry_after,
                    }
                )
                error_response = {
                    "type": "llm_error",
                    "message": e.error.user_message,
                    "error_type": e.error.error_type,
                    "retry_after": e.error.retry_after,
                    "is_retryable": e.error.is_retryable,
                }
                await websocket.send_json(error_response)

            except Exception as e:
                logger.error(
                    f"Unexpected error in chat stream",
                    extra={"session_id": session_id, "user_id": user_id, "error": str(e)[:200]}
                )
                await websocket.send_json(
                    WebSocketMessage(type="error", message="An unexpected error occurred. Please try again.").model_dump()
                )

    except WebSocketDisconnect:
        pass


@router.post("", response_model=ChatResponse)
async def chat(
    request: Request,
    chat_request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    rate_limiter = await get_rate_limiter()

    rate_check = await rate_limiter.check_rate_limit(chat_request.fingerprint, request)
    if not rate_check["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "retry_after": rate_check.get("retry_after", 60),
                "limits": rate_check["limits"],
            },
            headers={"Retry-After": str(rate_check.get("retry_after", 60))},
        )

    user_id = rate_check["user_id"]
    await rate_limiter.increment(chat_request.fingerprint, request)

    chat_service = get_chat_service()

    response, memory_updated, context_result = await chat_service.chat(
        db=db,
        message=chat_request.message,
        session_id=chat_request.session_id,
        user_id=user_id,
        model_id=chat_request.model_id,
    )

    return ChatResponse(
        response=response,
        session_id=chat_request.session_id,
        user_id=user_id,
        memory_updated=memory_updated,
        source_info=SourceInfo(
            source_type=ContextSourceType(context_result.source.value),
            sources=context_result.sources
        ),
    )


@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    fingerprint: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    rate_limiter = await get_rate_limiter()
    user_id = await rate_limiter.resolve_user_id(fingerprint, request)

    result = await db.execute(
        select(Conversation).where(
            Conversation.session_id == session_id,
            Conversation.user_id == user_id,
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        return ChatHistoryResponse(session_id=session_id, messages=[])

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatHistoryMessage(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
    )


@router.post("/conversations")
async def create_conversation(
    session_id: str = Query(...),
    fingerprint: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    rate_limiter = await get_rate_limiter()
    user_id = await rate_limiter.resolve_user_id(fingerprint, request)

    result = await db.execute(
        select(Conversation).where(Conversation.session_id == session_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        return {"id": existing.id, "session_id": existing.session_id, "created": False}

    conversation = Conversation(session_id=session_id, user_id=user_id)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    return {"id": conversation.id, "session_id": conversation.session_id, "created": True}


@router.get("/conversations", response_model=ConversationsListResponse)
async def list_conversations(
    fingerprint: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    rate_limiter = await get_rate_limiter()
    user_id = await rate_limiter.resolve_user_id(fingerprint, request)

    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()

    summaries = []
    for conv in conversations:
        msg_result = await db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == conv.id)
        )
        message_count = msg_result.scalar() or 0

        first_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar_one_or_none()
        preview = first_msg.content[:100] if first_msg else "New conversation"

        summaries.append(
            ConversationSummary(
                id=conv.id,
                session_id=conv.session_id,
                preview=preview,
                message_count=message_count,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
            )
        )

    return ConversationsListResponse(conversations=summaries, total=len(summaries))


@router.get("/models", response_model=AvailableModelsResponse)
async def list_available_models(
    db: AsyncSession = Depends(get_db),
):
    llm_service = get_llm_service()
    return await llm_service.get_available_models(db)
