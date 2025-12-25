import hashlib
import uuid
from typing import Optional, Union

from fastapi import Request, WebSocket

from app.db.redis import RedisCache
from app.config import get_settings

FP_TTL = 90 * 24 * 3600
IP_TTL = 7 * 24 * 3600


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

    def _hash(self, value: str) -> str:
        combined = f"{value}|{self.salt}"
        return hashlib.sha256(combined.encode()).hexdigest()[:32]

    def _get_client_ip(self, request: Union[Request, WebSocket]) -> str:
        if not request:
            return "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"

    async def resolve_user_id(
        self, fingerprint: str, request: Union[Request, WebSocket]
    ) -> str:
        fp_hash = self._hash(fingerprint)
        return fp_hash

    async def check_rate_limit(
        self, fingerprint: str, request: Union[Request, WebSocket]
    ) -> dict:
        ip = self._get_client_ip(request)
        fp_hash = self._hash(fingerprint)
        ip_hash = self._hash(ip)

        user_id = await self.resolve_user_id(fingerprint, request)

        results = {
            "allowed": True,
            "user_id": user_id,
            "limits": {},
        }

        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        for limit_name, window_seconds in windows:
            fp_key = f"ratelimit:fp:{fp_hash}:{limit_name}"
            ip_key = f"ratelimit:ip:{ip_hash}:{limit_name}"

            fp_count = int(await self.redis.get(fp_key) or 0)
            ip_count = int(await self.redis.get(ip_key) or 0)
            max_allowed = self.limits[limit_name]

            current_count = max(fp_count, ip_count)

            results["limits"][limit_name] = {
                "current": current_count,
                "max": max_allowed,
                "remaining": max(0, max_allowed - current_count),
            }

            if fp_count >= max_allowed or ip_count >= max_allowed:
                results["allowed"] = False
                fp_ttl = await self.redis.ttl(fp_key)
                ip_ttl = await self.redis.ttl(ip_key)
                results["retry_after"] = max(fp_ttl or 0, ip_ttl or 0)

        return results

    async def increment(self, fingerprint: str, request: Union[Request, WebSocket]):
        ip = self._get_client_ip(request)
        fp_hash = self._hash(fingerprint)
        ip_hash = self._hash(ip)

        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        for limit_name, window_seconds in windows:
            fp_key = f"ratelimit:fp:{fp_hash}:{limit_name}"
            ip_key = f"ratelimit:ip:{ip_hash}:{limit_name}"

            await self.redis.incr(fp_key)
            await self.redis.expire(fp_key, window_seconds)
            await self.redis.incr(ip_key)
            await self.redis.expire(ip_key, window_seconds)

    async def get_rate_limit_headers(
        self, fingerprint: str, request: Union[Request, WebSocket]
    ) -> dict:
        result = await self.check_rate_limit(fingerprint, request)
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
