import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def get_rate_limit_key(request: Request) -> str:
    """Rate limit by JWT token if present, otherwise fall back to IP Address."""
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return f"token:{auth[7:27]}"
    return get_remote_address(request)

# Configure the Bouncer: Max 60 requests per minute per user/IP
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["60/minute"],
    storage_uri=REDIS_URL,
    strategy="fixed-window"
)