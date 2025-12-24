import logging
import sys
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import init_db
from app.db.redis import get_redis, close_redis
from app.services.embedding import get_embedding_service, close_embedding_service
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.api.admin import router as admin_router

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application")
    await init_db()
    logger.info("Database initialized")
    await get_redis()
    logger.info("Redis connected")
    embedding_service = get_embedding_service()
    await embedding_service.initialize()
    logger.info("Embedding service initialized")
    yield
    logger.info("Shutting down application")
    await close_embedding_service()
    await close_redis()


app = FastAPI(
    title="Customer Support Chat API",
    description="RAG-powered customer support chat with memory",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    logger.info(
        f"[{request_id}] {request.method} {request.url.path} started"
    )

    try:
        response = await call_next(request)
        duration = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"completed | status={response.status_code} | duration={duration}ms"
        )
        return response
    except Exception as e:
        duration = round((time.time() - start_time) * 1000, 2)
        logger.error(
            f"[{request_id}] {request.method} {request.url.path} "
            f"failed | error={str(e)} | duration={duration}ms"
        )
        raise


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(admin_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {
        "message": "Customer Support Chat API",
        "docs": "/docs",
    }
