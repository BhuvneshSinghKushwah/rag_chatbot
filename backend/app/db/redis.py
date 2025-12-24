import redis.asyncio as redis
from typing import Optional

from app.config import get_settings

settings = get_settings()

redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return redis_client


async def close_redis():
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None


class RedisCache:
    def __init__(self, client: redis.Redis):
        self.client = client

    async def get(self, key: str) -> Optional[str]:
        return await self.client.get(key)

    async def set(self, key: str, value: str, expire: int = 3600):
        await self.client.set(key, value, ex=expire)

    async def delete(self, key: str):
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        return await self.client.exists(key) > 0

    async def incr(self, key: str) -> int:
        return await self.client.incr(key)

    async def expire(self, key: str, seconds: int):
        await self.client.expire(key, seconds)

    async def ttl(self, key: str) -> int:
        return await self.client.ttl(key)

    async def lpush(self, key: str, *values):
        await self.client.lpush(key, *values)

    async def lrange(self, key: str, start: int, end: int) -> list:
        return await self.client.lrange(key, start, end)

    async def ltrim(self, key: str, start: int, end: int):
        await self.client.ltrim(key, start, end)
