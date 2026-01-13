from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL_NAME: str = "gemini-2.0-flash"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL_NAME: str = "gpt-4o"

    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL_NAME: str = "claude-sonnet-4-20250514"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL_NAME: str = "gemma3:1b"

    DEFAULT_LLM_PROVIDER: Optional[str] = None

    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2000

    DEFAULT_EMBEDDING_PROVIDER: str = "local"
    LOCAL_EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"

    POSTGRES_USER: str = "support_user"
    POSTGRES_PASSWORD: str = "support_user_password"
    POSTGRES_DB: str = "support_chat"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    QDRANT_HOST: str = "localhost"
    QDRANT_HTTP_PORT: int = 6333

    ADMIN_API_KEY: str = "admin-secret-key"

    RATE_LIMIT_SALT: str = "change_this_to_random_secret"
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 600
    RATE_LIMIT_PER_DAY: int = 1000

    MEMORY_MAX_PER_USER: int = 100
    MEMORY_COMPACTION_THRESHOLD: int = 80
    MEMORY_SUMMARY_BATCH_SIZE: int = 50
    MEMORY_RETENTION_DAYS_GENERAL: int = 30
    MEMORY_RETENTION_DAYS_ISSUES: int = 90
    MEMORY_RETENTION_DAYS_ROUTINE: int = 7

    CHUNK_SIZE: int = 4000
    CHUNK_OVERLAP: int = 800
    CHUNK_SEPARATORS: list[str] = ["\n\n", "\n", ". ", " ", ""]

    SEARXNG_BASE_URL: str = "http://searxng:8080"
    WEB_SEARCH_ENABLED: bool = True
    WEB_SEARCH_MAX_RESULTS: int = 5
    RAG_RELEVANCE_THRESHOLD: float = 0.65

    # Firebase Authentication
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None

    # Demo Mode
    DEMO_RATE_LIMIT_PER_MINUTE: int = 10
    DEMO_RATE_LIMIT_PER_HOUR: int = 50
    DEMO_CONVERSATION_TTL_HOURS: int = 24

    # Subscription Defaults
    FREE_TIER_STORAGE_MB: int = 200
    FREE_TIER_AGENT_LIMIT: int = 1
    GOATED_TIER_STORAGE_MB: int = 2048
    GOATED_TIER_AGENT_LIMIT: int = 3

    # Agent API Rate Limits
    FREE_TIER_API_REQUESTS_PER_DAY: int = 100
    GOATED_TIER_API_REQUESTS_PER_DAY: int = 1000

    @property
    def firebase_configured(self) -> bool:
        return all([
            self.FIREBASE_PROJECT_ID,
            self.FIREBASE_CLIENT_EMAIL,
            self.FIREBASE_PRIVATE_KEY
        ])

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    class Config:
        env_file = ("../.env", ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
