from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.db import get_pool, close_pool
from app.logging import configure_logging
from app.middleware.auth import api_key_middleware
from app.dashboard_stream import dashboard_ws
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.layers import router as layers_router
from app.api.predictions import router as predictions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(dev=True)
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="CDF API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(BaseHTTPMiddleware, dispatch=api_key_middleware)

app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(layers_router)
app.include_router(predictions_router)
app.add_api_websocket_route("/ws/events", dashboard_ws)
