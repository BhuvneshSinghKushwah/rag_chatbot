from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.db.redis import get_redis, close_redis
from app.services.embedding import get_embedding_service, close_embedding_service
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await get_redis()
    embedding_service = get_embedding_service()
    await embedding_service.initialize()
    yield
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

app.include_router(documents_router)
app.include_router(chat_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {
        "message": "Customer Support Chat API",
        "docs": "/docs",
    }
