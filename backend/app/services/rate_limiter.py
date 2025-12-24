import hashlib
from typing import Optional, Union

from fastapi import Request, WebSocket

from app.db.redis import RedisCache
from app.config import get_settings


class RateLimiter:
    def __init__(self, redis_cache: RedisCache, secret_salt: str):
        self.redis = redis_cache
        self.salt = secret_salt
        settings = get_settings()
        self.limits = {
            "per_minute": settings.RATE_LIMIT_PER_MINUTE,
            "per_hour": settings.RATE_LIMIT_PER_HOUR,
            "per_day": settings.RATE_LIMIT_PER_DAY,
        }

    def generate_user_id(self, client_fingerprint: str, request: Union[Request, WebSocket]) -> str:
        ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        accept_lang = request.headers.get("accept-language", "")

        combined = f"{client_fingerprint}|{ip}|{user_agent}|{accept_lang}|{self.salt}"
        user_id = hashlib.sha256(combined.encode()).hexdigest()[:32]
        return user_id

    def _get_client_ip(self, request: Union[Request, WebSocket]) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    async def check_rate_limit(self, user_id: str) -> dict:
        results = {
            "allowed": True,
            "user_id": user_id,
            "limits": {}
        }

        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        for limit_name, window_seconds in windows:
            key = f"ratelimit:{user_id}:{limit_name}"
            current = await self.redis.get(key)
            current_count = int(current) if current else 0
            max_allowed = self.limits[limit_name]

            results["limits"][limit_name] = {
                "current": current_count,
                "max": max_allowed,
                "remaining": max(0, max_allowed - current_count)
            }

            if current_count >= max_allowed:
                results["allowed"] = False
                results["retry_after"] = await self.redis.ttl(key)

        return results

    async def increment(self, user_id: str):
        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        for limit_name, window_seconds in windows:
            key = f"ratelimit:{user_id}:{limit_name}"
            await self.redis.incr(key)
            await self.redis.expire(key, window_seconds)

    async def get_rate_limit_headers(self, user_id: str) -> dict:
        result = await self.check_rate_limit(user_id)
        headers = {}
        for limit_name, info in result["limits"].items():
            header_suffix = limit_name.replace("per_", "").capitalize()
            headers[f"X-RateLimit-Limit-{header_suffix}"] = str(info["max"])
            headers[f"X-RateLimit-Remaining-{header_suffix}"] = str(info["remaining"])
        return headers


_rate_limiter: Optional[RateLimiter] = None


async def get_rate_limiter(redis_cache: RedisCache, salt: str) -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(redis_cache, salt)
    return _rate_limiter
