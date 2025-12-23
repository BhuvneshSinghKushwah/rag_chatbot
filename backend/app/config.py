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

    OLLAMA_BASE_URL: Optional[str] = None
    OLLAMA_MODEL_NAME: str = "llama3.2"

    DEFAULT_LLM_PROVIDER: Optional[str] = None

    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
