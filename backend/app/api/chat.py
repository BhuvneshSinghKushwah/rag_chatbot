import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
)
from app.services.chat import get_chat_service
from app.services.rate_limiter import RateLimiter

router = APIRouter(prefix="/api/chat", tags=["chat"])
settings = get_settings()


async def get_rate_limiter() -> RateLimiter:
    redis_client = await get_redis()
    cache = RedisCache(redis_client)
    return RateLimiter(cache, settings.RATE_LIMIT_SALT)


@router.websocket("/ws")
async def websocket_chat(
    websocket: WebSocket,
    session_id: str = Query(...),
    fingerprint: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    await websocket.accept()

    redis_client = await get_redis()
    cache = RedisCache(redis_client)
    rate_limiter = RateLimiter(cache, settings.RATE_LIMIT_SALT)
    chat_service = get_chat_service()

    user_id = rate_limiter.generate_user_id(fingerprint, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            content = data.get("content", "")

            if msg_type != "message" or not content:
                await websocket.send_json(
                    WebSocketMessage(type="error", message="Invalid message format").model_dump()
                )
                continue

            rate_check = await rate_limiter.check_rate_limit(user_id)
            if not rate_check["allowed"]:
                await websocket.send_json(
                    WebSocketMessage(
                        type="error",
                        message=f"Rate limit exceeded. Retry after {rate_check.get('retry_after', 60)} seconds"
                    ).model_dump()
                )
                continue

            await rate_limiter.increment(user_id)

            try:
                sources = None
                async for chunk, chunk_sources in chat_service.chat_stream(
                    db=db,
                    message=content,
                    session_id=session_id,
                    user_id=user_id,
                ):
                    if chunk:
                        await websocket.send_json(
                            WebSocketMessage(type="token", content=chunk).model_dump()
                        )
                    if chunk_sources is not None:
                        sources = chunk_sources

                await websocket.send_json(
                    WebSocketMessage(type="complete", sources=sources or []).model_dump()
                )

            except Exception as e:
                await websocket.send_json(
                    WebSocketMessage(type="error", message=str(e)).model_dump()
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
    user_id = rate_limiter.generate_user_id(chat_request.fingerprint, request)

    rate_check = await rate_limiter.check_rate_limit(user_id)
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

    await rate_limiter.increment(user_id)

    chat_service = get_chat_service()

    response, sources, memory_updated = await chat_service.chat(
        db=db,
        message=chat_request.message,
        session_id=chat_request.session_id,
        user_id=user_id,
    )

    return ChatResponse(
        response=response,
        sources=sources,
        session_id=chat_request.session_id,
        user_id=user_id,
        memory_updated=memory_updated,
    )


@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    fingerprint: str = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    rate_limiter = await get_rate_limiter()
    user_id = rate_limiter.generate_user_id(fingerprint, request)

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
                sources=json.loads(msg.sources) if msg.sources else None,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
    )
