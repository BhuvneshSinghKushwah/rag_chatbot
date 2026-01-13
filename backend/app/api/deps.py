import logging
from typing import Optional
from datetime import datetime

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db import get_db
from app.db.postgres import User, UserRole
from app.services.firebase_auth import FirebaseAuthService, FirebaseUser
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer(auto_error=False)


async def get_firebase_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[FirebaseUser]:
    if not credentials:
        return None

    token = credentials.credentials
    firebase_user = FirebaseAuthService.verify_token(token)
    return firebase_user


async def get_current_user(
    firebase_user: Optional[FirebaseUser] = Depends(get_firebase_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not firebase_user:
        return None

    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_user.uid)
    )
    user = result.scalar_one_or_none()

    if user:
        user.last_login_at = datetime.utcnow()
        if firebase_user.name and firebase_user.name != user.name:
            user.name = firebase_user.name
        if firebase_user.picture and firebase_user.picture != user.picture:
            user.picture = firebase_user.picture
        if firebase_user.email_verified != user.email_verified:
            user.email_verified = firebase_user.email_verified
        await db.commit()
        await db.refresh(user)
    else:
        user = User(
            firebase_uid=firebase_user.uid,
            email=firebase_user.email,
            name=firebase_user.name,
            picture=firebase_user.picture,
            email_verified=firebase_user.email_verified,
            role=UserRole.USER.value,
            subscription_tier="free",
            storage_limit=settings.FREE_TIER_STORAGE_MB * 1024 * 1024,
            agent_limit=settings.FREE_TIER_AGENT_LIMIT,
            last_login_at=datetime.utcnow(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"Created new user: {user.email} ({user.id})")

    return user


async def require_auth(
    user: Optional[User] = Depends(get_current_user),
) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    return user


async def get_optional_user(
    user: Optional[User] = Depends(get_current_user),
) -> Optional[User]:
    return user


def verify_admin_key(x_admin_key: Optional[str] = Header(None)) -> bool:
    if not x_admin_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin API key required",
        )

    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin API key",
        )

    return True
