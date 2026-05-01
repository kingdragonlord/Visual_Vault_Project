import json
import logging
import os
import redis.asyncio as redis

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CacheService:
    """Redis-based caching service for fast database lookups."""
    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    async def get(self, key: str):
        """Retrieve a JSON-parsed value from Redis."""
        try:
            value = await self.redis.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set(self, key: str, value: dict | list, ttl: int = 300):
        """Store a JSON value in Redis with a Time-To-Live (TTL) in seconds."""
        try:
            await self.redis.setex(key, ttl, json.dumps(value))
        except Exception as e:
            logger.warning(f"Cache set error: {e}")

    async def delete(self, key: str):
        """Invalidate a specific cache key."""
        await self.redis.delete(key)

# Singleton instance
_cache_service = None
def get_cache_service():
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service