import json
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import get_db
from app.db.postgres import Conversation, Message, Document, LLMProvider, LLMModel
from app.models.llm_config import (
    ProviderType,
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    LLMProviderListResponse,
    LLMModelCreate,
    LLMModelUpdate,
    LLMModelResponse,
    TestProviderRequest,
    TestProviderResponse,
)

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


def _provider_to_response(provider: LLMProvider) -> LLMProviderResponse:
    return LLMProviderResponse(
        id=provider.id,
        provider_type=ProviderType(provider.provider_type),
        name=provider.name,
        base_url=provider.base_url,
        is_active=provider.is_active,
        is_default=provider.is_default,
        has_api_key=provider.api_key is not None and len(provider.api_key) > 0,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
        models=[
            LLMModelResponse(
                id=m.id,
                provider_id=m.provider_id,
                model_name=m.model_name,
                display_name=m.display_name,
                is_active=m.is_active,
                is_default=m.is_default,
                max_tokens=m.max_tokens,
                temperature=m.temperature,
                created_at=m.created_at,
            )
            for m in provider.models
        ],
    )


@router.get("/llm/providers", response_model=LLMProviderListResponse)
async def list_providers(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider)
        .options(selectinload(LLMProvider.models))
        .order_by(LLMProvider.created_at.asc())
    )
    providers = result.scalars().all()

    return LLMProviderListResponse(
        providers=[_provider_to_response(p) for p in providers],
        total=len(providers),
    )


@router.post("/llm/providers", response_model=LLMProviderResponse)
async def create_provider(
    data: LLMProviderCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    existing = await db.execute(
        select(LLMProvider).where(LLMProvider.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Provider with this name already exists")

    if data.provider_type != ProviderType.OLLAMA and not data.api_key:
        raise HTTPException(status_code=400, detail="API key is required for cloud providers")

    if data.provider_type == ProviderType.OLLAMA and not data.base_url:
        raise HTTPException(status_code=400, detail="Base URL is required for Ollama")

    if data.is_default:
        await db.execute(
            select(LLMProvider).where(LLMProvider.is_default == True)
        )
        await db.execute(
            LLMProvider.__table__.update().where(LLMProvider.is_default == True).values(is_default=False)
        )

    provider = LLMProvider(
        provider_type=data.provider_type.value,
        name=data.name,
        api_key=data.api_key,
        base_url=data.base_url,
        is_default=data.is_default,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)

    result = await db.execute(
        select(LLMProvider)
        .options(selectinload(LLMProvider.models))
        .where(LLMProvider.id == provider.id)
    )
    provider = result.scalar_one()

    return _provider_to_response(provider)


@router.put("/llm/providers/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(
    provider_id: uuid.UUID,
    data: LLMProviderUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider)
        .options(selectinload(LLMProvider.models))
        .where(LLMProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if data.name is not None and data.name != provider.name:
        existing = await db.execute(
            select(LLMProvider).where(LLMProvider.name == data.name)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Provider with this name already exists")
        provider.name = data.name

    if data.api_key is not None:
        provider.api_key = data.api_key
    if data.base_url is not None:
        provider.base_url = data.base_url
    if data.is_active is not None:
        provider.is_active = data.is_active
    if data.is_default is not None and data.is_default:
        await db.execute(
            LLMProvider.__table__.update().where(LLMProvider.is_default == True).values(is_default=False)
        )
        provider.is_default = True
    elif data.is_default is not None:
        provider.is_default = False

    await db.commit()
    await db.refresh(provider)

    return _provider_to_response(provider)


@router.delete("/llm/providers/{provider_id}")
async def delete_provider(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.delete(provider)
    await db.commit()

    return {"message": "Provider deleted"}


@router.patch("/llm/providers/{provider_id}/default")
async def set_default_provider(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.execute(
        LLMProvider.__table__.update().where(LLMProvider.is_default == True).values(is_default=False)
    )
    provider.is_default = True
    await db.commit()

    return {"message": "Default provider updated"}


@router.post("/llm/providers/{provider_id}/models", response_model=LLMModelResponse)
async def create_model(
    provider_id: uuid.UUID,
    data: LLMModelCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    existing = await db.execute(
        select(LLMModel).where(
            LLMModel.provider_id == provider_id,
            LLMModel.model_name == data.model_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Model already exists for this provider")

    if data.is_default:
        await db.execute(
            LLMModel.__table__.update().where(
                LLMModel.provider_id == provider_id,
                LLMModel.is_default == True,
            ).values(is_default=False)
        )

    model = LLMModel(
        provider_id=provider_id,
        model_name=data.model_name,
        display_name=data.display_name or data.model_name,
        max_tokens=data.max_tokens,
        temperature=data.temperature,
        is_default=data.is_default,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)

    return LLMModelResponse(
        id=model.id,
        provider_id=model.provider_id,
        model_name=model.model_name,
        display_name=model.display_name,
        is_active=model.is_active,
        is_default=model.is_default,
        max_tokens=model.max_tokens,
        temperature=model.temperature,
        created_at=model.created_at,
    )


@router.put("/llm/models/{model_id}", response_model=LLMModelResponse)
async def update_model(
    model_id: uuid.UUID,
    data: LLMModelUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMModel).where(LLMModel.id == model_id)
    )
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if data.model_name is not None:
        existing = await db.execute(
            select(LLMModel).where(
                LLMModel.provider_id == model.provider_id,
                LLMModel.model_name == data.model_name,
                LLMModel.id != model_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Model name already exists for this provider")
        model.model_name = data.model_name

    if data.display_name is not None:
        model.display_name = data.display_name
    if data.max_tokens is not None:
        model.max_tokens = data.max_tokens
    if data.temperature is not None:
        model.temperature = data.temperature
    if data.is_active is not None:
        model.is_active = data.is_active
    if data.is_default is not None and data.is_default:
        await db.execute(
            LLMModel.__table__.update().where(
                LLMModel.provider_id == model.provider_id,
                LLMModel.is_default == True,
            ).values(is_default=False)
        )
        model.is_default = True
    elif data.is_default is not None:
        model.is_default = False

    await db.commit()
    await db.refresh(model)

    return LLMModelResponse(
        id=model.id,
        provider_id=model.provider_id,
        model_name=model.model_name,
        display_name=model.display_name,
        is_active=model.is_active,
        is_default=model.is_default,
        max_tokens=model.max_tokens,
        temperature=model.temperature,
        created_at=model.created_at,
    )


@router.delete("/llm/models/{model_id}")
async def delete_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMModel).where(LLMModel.id == model_id)
    )
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    await db.delete(model)
    await db.commit()

    return {"message": "Model deleted"}


@router.patch("/llm/models/{model_id}/default")
async def set_default_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMModel).where(LLMModel.id == model_id)
    )
    model = result.scalar_one_or_none()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    await db.execute(
        LLMModel.__table__.update().where(
            LLMModel.provider_id == model.provider_id,
            LLMModel.is_default == True,
        ).values(is_default=False)
    )
    model.is_default = True
    await db.commit()

    return {"message": "Default model updated"}


async def _test_provider_connection(
    provider_type: ProviderType,
    api_key: Optional[str],
    base_url: Optional[str],
    model_name: Optional[str] = None,
) -> TestProviderResponse:
    try:
        if provider_type == ProviderType.GEMINI:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model=model_name or "gemini-2.0-flash-001",
                google_api_key=api_key,
                max_tokens=10,
            )
            await llm.ainvoke("Hi")
        elif provider_type == ProviderType.OPENAI:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model=model_name or "gpt-4o-mini",
                api_key=api_key,
                max_tokens=10,
            )
            await llm.ainvoke("Hi")
        elif provider_type == ProviderType.ANTHROPIC:
            from langchain_anthropic import ChatAnthropic
            llm = ChatAnthropic(
                model=model_name or "claude-3-haiku-20240307",
                api_key=api_key,
                max_tokens=10,
            )
            await llm.ainvoke("Hi")
        elif provider_type == ProviderType.OLLAMA:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{base_url}/api/tags")
                if response.status_code != 200:
                    raise Exception(f"Ollama returned status {response.status_code}")

        return TestProviderResponse(
            success=True,
            message="Connection successful",
            provider_type=provider_type,
        )
    except Exception as e:
        return TestProviderResponse(
            success=False,
            message=str(e)[:200],
            provider_type=provider_type,
        )


@router.post("/llm/providers/test", response_model=TestProviderResponse)
async def test_provider(
    data: TestProviderRequest,
    _: str = Depends(verify_admin_key),
):
    return await _test_provider_connection(
        provider_type=data.provider_type,
        api_key=data.api_key,
        base_url=data.base_url,
        model_name=data.model_name,
    )


@router.post("/llm/providers/{provider_id}/test", response_model=TestProviderResponse)
async def test_existing_provider(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_admin_key),
):
    result = await db.execute(
        select(LLMProvider)
        .options(selectinload(LLMProvider.models))
        .where(LLMProvider.id == provider_id)
    )
    provider = result.scalar_one_or_none()

    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    model_name = None
    for m in provider.models:
        if m.is_active:
            model_name = m.model_name
            break

    return await _test_provider_connection(
        provider_type=ProviderType(provider.provider_type),
        api_key=provider.api_key,
        base_url=provider.base_url,
        model_name=model_name,
    )
