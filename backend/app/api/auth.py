import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.db.postgres import User, Agent
from app.api.deps import get_current_user, require_auth
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    picture: Optional[str]
    role: str
    subscription_tier: str
    storage_used: int
    storage_limit: int
    agent_count: int
    agent_limit: int
    email_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


async def _get_agent_count(db: AsyncSession, user_id) -> int:
    result = await db.execute(
        select(func.count(Agent.id)).where(Agent.user_id == user_id)
    )
    return result.scalar() or 0


def _user_to_response(user: User, agent_count: int) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
        subscription_tier=user.subscription_tier,
        storage_used=user.storage_used,
        storage_limit=user.storage_limit,
        agent_count=agent_count,
        agent_limit=user.agent_limit,
        email_verified=user.email_verified,
        created_at=user.created_at,
    )


@router.get("/me", response_model=AuthStatusResponse)
async def get_auth_status(
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        return AuthStatusResponse(authenticated=False)

    agent_count = await _get_agent_count(db, user.id)

    return AuthStatusResponse(
        authenticated=True,
        user=_user_to_response(user, agent_count),
    )


@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    agent_count = await _get_agent_count(db, user.id)
    return _user_to_response(user, agent_count)


@router.patch("/profile", response_model=UserResponse)
async def update_user_profile(
    request: UpdateProfileRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    if request.name is not None:
        user.name = request.name

    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    agent_count = await _get_agent_count(db, user.id)
    return _user_to_response(user, agent_count)
