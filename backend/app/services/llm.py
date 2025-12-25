import logging
import re
import uuid
from typing import Optional, AsyncIterator
from dataclasses import dataclass

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings, get_settings
from app.db.postgres import LLMProvider, LLMModel
from app.models.llm_config import AvailableModel, AvailableModelsResponse, ProviderType

logger = logging.getLogger(__name__)


@dataclass
class LLMError:
    provider: str
    error_type: str
    message: str
    retry_after: Optional[float] = None
    is_retryable: bool = False
    user_message: str = "An error occurred while processing your request."

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "error_type": self.error_type,
            "message": self.message,
            "retry_after": self.retry_after,
            "is_retryable": self.is_retryable,
            "user_message": self.user_message,
        }


class LLMException(Exception):
    def __init__(self, error: LLMError):
        self.error = error
        super().__init__(error.message)


def parse_llm_error(provider: str, exception: Exception) -> LLMError:
    error_str = str(exception)
    error_lower = error_str.lower()

    retry_after = None
    retry_match = re.search(r"retry\s+(?:in|after)\s+([\d.]+)\s*s", error_str, re.IGNORECASE)
    if retry_match:
        try:
            retry_after = float(retry_match.group(1))
        except ValueError:
            pass

    if "429" in error_str or "resource_exhausted" in error_lower or "quota" in error_lower:
        return LLMError(
            provider=provider,
            error_type="rate_limit",
            message=error_str,
            retry_after=retry_after or 60.0,
            is_retryable=True,
            user_message=f"Service is temporarily busy. Please try again in {int(retry_after or 60)} seconds.",
        )

    if "401" in error_str or "403" in error_str or "authentication" in error_lower or "api_key" in error_lower:
        return LLMError(
            provider=provider,
            error_type="auth_error",
            message=error_str,
            is_retryable=False,
            user_message="Service configuration error. Please contact support.",
        )

    if "timeout" in error_lower or "timed out" in error_lower:
        return LLMError(
            provider=provider,
            error_type="timeout",
            message=error_str,
            is_retryable=True,
            user_message="Request timed out. Please try again.",
        )

    if "connection" in error_lower or "network" in error_lower:
        return LLMError(
            provider=provider,
            error_type="connection_error",
            message=error_str,
            is_retryable=True,
            user_message="Connection error. Please check your internet and try again.",
        )

    if "500" in error_str or "502" in error_str or "503" in error_str or "504" in error_str:
        return LLMError(
            provider=provider,
            error_type="server_error",
            message=error_str,
            is_retryable=True,
            user_message="Service temporarily unavailable. Please try again.",
        )

    return LLMError(
        provider=provider,
        error_type="unknown",
        message=error_str,
        is_retryable=False,
        user_message="An unexpected error occurred. Please try again later.",
    )


class LLMService:

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._client_cache: dict[str, BaseChatModel] = {}

    def _create_client(
        self,
        provider_type: str,
        model_name: str,
        api_key: Optional[str],
        base_url: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> BaseChatModel:
        if provider_type == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        elif provider_type == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=model_name,
                api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        elif provider_type == "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model=model_name,
                api_key=api_key,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        elif provider_type == "ollama":
            from langchain_ollama import ChatOllama
            return ChatOllama(
                model=model_name,
                base_url=base_url,
                temperature=temperature,
            )
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")

    async def get_available_models(self, db: AsyncSession) -> AvailableModelsResponse:
        result = await db.execute(
            select(LLMModel)
            .join(LLMProvider)
            .options(selectinload(LLMModel.provider))
            .where(LLMProvider.is_active == True, LLMModel.is_active == True)
            .order_by(LLMProvider.name, LLMModel.model_name)
        )
        models = result.scalars().all()

        default_model_id = None
        available = []
        for m in models:
            if m.provider.is_default and m.is_default:
                default_model_id = m.id
            available.append(
                AvailableModel(
                    id=m.id,
                    provider_id=m.provider_id,
                    provider_type=ProviderType(m.provider.provider_type),
                    provider_name=m.provider.name,
                    model_name=m.model_name,
                    display_name=m.display_name or m.model_name,
                )
            )

        if not default_model_id and available:
            default_model_id = available[0].id

        return AvailableModelsResponse(models=available, default_model_id=default_model_id)

    async def get_model_config(self, db: AsyncSession, model_id: uuid.UUID) -> tuple[LLMModel, LLMProvider]:
        result = await db.execute(
            select(LLMModel)
            .options(selectinload(LLMModel.provider))
            .where(LLMModel.id == model_id, LLMModel.is_active == True)
        )
        model = result.scalar_one_or_none()

        if not model or not model.provider.is_active:
            raise ValueError(f"Model {model_id} not found or not active")

        return model, model.provider

    async def get_default_model_config(self, db: AsyncSession) -> tuple[LLMModel, LLMProvider]:
        result = await db.execute(
            select(LLMProvider)
            .options(selectinload(LLMProvider.models))
            .where(LLMProvider.is_active == True, LLMProvider.is_default == True)
        )
        provider = result.scalar_one_or_none()

        if provider:
            for m in provider.models:
                if m.is_active and m.is_default:
                    return m, provider
            for m in provider.models:
                if m.is_active:
                    return m, provider

        result = await db.execute(
            select(LLMProvider)
            .options(selectinload(LLMProvider.models))
            .where(LLMProvider.is_active == True)
            .order_by(LLMProvider.created_at.asc())
        )
        providers = result.scalars().all()

        for provider in providers:
            for m in provider.models:
                if m.is_active:
                    return m, provider

        raise ValueError("No active LLM models configured")

    async def get_client(
        self,
        db: AsyncSession,
        model_id: Optional[uuid.UUID] = None,
    ) -> tuple[BaseChatModel, str, str]:
        if model_id:
            model, provider = await self.get_model_config(db, model_id)
        else:
            model, provider = await self.get_default_model_config(db)

        cache_key = f"{provider.id}:{model.id}"

        if cache_key not in self._client_cache:
            client = self._create_client(
                provider_type=provider.provider_type,
                model_name=model.model_name,
                api_key=provider.api_key,
                base_url=provider.base_url,
                temperature=model.temperature,
                max_tokens=model.max_tokens,
            )
            self._client_cache[cache_key] = client
            logger.info(f"Created LLM client: {provider.name}/{model.model_name}")

        return self._client_cache[cache_key], provider.provider_type, model.model_name

    def invalidate_cache(self, provider_id: Optional[uuid.UUID] = None):
        if provider_id:
            keys_to_remove = [k for k in self._client_cache if k.startswith(str(provider_id))]
            for k in keys_to_remove:
                del self._client_cache[k]
        else:
            self._client_cache.clear()

    async def invoke(
        self,
        db: AsyncSession,
        messages: list[BaseMessage],
        model_id: Optional[uuid.UUID] = None,
    ) -> str:
        client, _, _ = await self.get_client(db, model_id)
        response = await client.ainvoke(messages)
        return response.content

    async def stream(
        self,
        db: AsyncSession,
        messages: list[BaseMessage],
        model_id: Optional[uuid.UUID] = None,
    ) -> AsyncIterator[str]:
        client, provider_type, model_name = await self.get_client(db, model_id)

        try:
            if provider_type == "ollama":
                async for chunk in self._stream_ollama(db, messages, model_id):
                    yield chunk
            else:
                async for chunk in client.astream(messages):
                    if chunk.content:
                        yield chunk.content
        except Exception as e:
            parsed_error = parse_llm_error(provider_type, e)
            logger.error(
                f"Stream error",
                extra={
                    "provider": provider_type,
                    "model": model_name,
                    "error_type": parsed_error.error_type,
                    "retry_after": parsed_error.retry_after,
                    "error_message": parsed_error.message[:200],
                }
            )
            raise LLMException(parsed_error)

    async def _stream_ollama(
        self,
        db: AsyncSession,
        messages: list[BaseMessage],
        model_id: Optional[uuid.UUID] = None,
    ) -> AsyncIterator[str]:
        import httpx
        import json

        if model_id:
            model, provider = await self.get_model_config(db, model_id)
        else:
            model, provider = await self.get_default_model_config(db)

        ollama_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                ollama_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                ollama_messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                ollama_messages.append({"role": "assistant", "content": msg.content})

        payload = {
            "model": model.model_name,
            "messages": ollama_messages,
            "stream": True,
            "options": {
                "temperature": model.temperature,
            },
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{provider.base_url}/api/chat",
                json=payload,
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            content = data["message"]["content"]
                            if content:
                                yield content

    def create_messages(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        chat_history: Optional[list[dict]] = None,
    ) -> list[BaseMessage]:
        messages: list[BaseMessage] = []

        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))

        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=user_message))

        return messages


_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
