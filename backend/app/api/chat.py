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

    user_id = await rate_limiter.resolve_user_id(fingerprint, websocket)

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
                async for chunk in chat_service.chat_stream(
                    db=db,
                    message=content,
                    session_id=session_id,
                    user_id=user_id,
                ):
                    if chunk:
                        await websocket.send_json(
                            WebSocketMessage(type="token", content=chunk).model_dump()
                        )

                await websocket.send_json(
                    WebSocketMessage(type="complete").model_dump()
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

    response, memory_updated = await chat_service.chat(
        db=db,
        message=chat_request.message,
        session_id=chat_request.session_id,
        user_id=user_id,
    )

    return ChatResponse(
        response=response,
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
