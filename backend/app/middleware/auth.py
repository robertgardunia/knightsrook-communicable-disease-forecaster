from fastapi import Request, HTTPException
from app.config import settings


async def api_key_middleware(request: Request, call_next):
    if not settings.api_key:
        return await call_next(request)
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)
    key = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not key:
        key = request.query_params.get("api_key", "")
    if key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return await call_next(request)
