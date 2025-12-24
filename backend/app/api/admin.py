import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.db.postgres import Conversation, Message, Document

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()


def verify_admin_key(x_admin_key: Optional[str] = Header(None)) -> str:
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return x_admin_key


@router.get("/conversations")
async def list_all_conversations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    query = select(Conversation).order_by(Conversation.updated_at.desc())

    if user_id:
        query = query.where(Conversation.user_id == user_id)

    count_query = select(func.count(Conversation.id))
    if user_id:
        count_query = count_query.where(Conversation.user_id == user_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        msg_count_result = await db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == conv.id)
        )
        message_count = msg_count_result.scalar() or 0

        first_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar_one_or_none()
        preview = first_msg.content[:100] if first_msg else "New conversation"

        items.append({
            "id": str(conv.id),
            "session_id": conv.session_id,
            "user_id": conv.user_id,
            "preview": preview,
            "message_count": message_count,
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat(),
        })

    return {
        "conversations": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation_detail(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
    )
    messages = messages_result.scalars().all()

    return {
        "id": str(conversation.id),
        "session_id": conversation.session_id,
        "user_id": conversation.user_id,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "messages": [
            {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "sources": json.loads(msg.sources) if msg.sources else None,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in messages
        ],
    }


@router.get("/analytics/usage")
async def get_usage_analytics(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    total_conversations_result = await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.created_at >= start_date
        )
    )
    total_conversations = total_conversations_result.scalar() or 0

    total_messages_result = await db.execute(
        select(func.count(Message.id)).where(Message.created_at >= start_date)
    )
    total_messages = total_messages_result.scalar() or 0

    unique_users_result = await db.execute(
        select(func.count(func.distinct(Conversation.user_id))).where(
            Conversation.created_at >= start_date
        )
    )
    unique_users = unique_users_result.scalar() or 0

    total_docs_result = await db.execute(
        select(func.count(Document.id)).where(Document.deleted_at.is_(None))
    )
    total_documents = total_docs_result.scalar() or 0

    ready_docs_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.deleted_at.is_(None),
            Document.status == "ready",
        )
    )
    ready_documents = ready_docs_result.scalar() or 0

    daily_stats = []
    for i in range(days):
        day_start = (now - timedelta(days=days - 1 - i)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)

        day_convs_result = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(
                    Conversation.created_at >= day_start,
                    Conversation.created_at < day_end,
                )
            )
        )
        day_conversations = day_convs_result.scalar() or 0

        day_msgs_result = await db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.created_at >= day_start,
                    Message.created_at < day_end,
                )
            )
        )
        day_messages = day_msgs_result.scalar() or 0

        day_users_result = await db.execute(
            select(func.count(func.distinct(Conversation.user_id))).where(
                and_(
                    Conversation.created_at >= day_start,
                    Conversation.created_at < day_end,
                )
            )
        )
        day_users = day_users_result.scalar() or 0

        daily_stats.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "conversations": day_conversations,
            "messages": day_messages,
            "unique_users": day_users,
        })

    avg_msgs_per_conv = 0
    if total_conversations > 0:
        avg_msgs_per_conv = round(total_messages / total_conversations, 2)

    return {
        "period": {
            "start": start_date.isoformat(),
            "end": now.isoformat(),
            "days": days,
        },
        "summary": {
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "unique_users": unique_users,
            "avg_messages_per_conversation": avg_msgs_per_conv,
        },
        "documents": {
            "total": total_documents,
            "ready": ready_documents,
        },
        "daily": daily_stats,
    }


@router.get("/analytics/top-users")
async def get_top_users(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    start_date = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            Conversation.user_id,
            func.count(Conversation.id).label("conversation_count"),
        )
        .where(
            Conversation.created_at >= start_date,
            Conversation.user_id.isnot(None),
        )
        .group_by(Conversation.user_id)
        .order_by(func.count(Conversation.id).desc())
        .limit(limit)
    )
    rows = result.all()

    users = []
    for row in rows:
        msg_count_result = await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.user_id == row.user_id,
                Message.created_at >= start_date,
            )
        )
        message_count = msg_count_result.scalar() or 0

        users.append({
            "user_id": row.user_id,
            "conversation_count": row.conversation_count,
            "message_count": message_count,
        })

    return {
        "period_days": days,
        "users": users,
    }
