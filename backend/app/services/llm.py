from typing import Optional, AsyncIterator
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage

from app.config import Settings, get_settings


class LLMService:

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.providers: dict[str, BaseChatModel] = {}
        self.default_provider: Optional[str] = None

        self._initialize_providers()

    def _initialize_providers(self) -> None:
        if self.settings.GEMINI_API_KEY:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI

                self.providers["gemini"] = ChatGoogleGenerativeAI(
                    model=self.settings.GEMINI_MODEL_NAME,
                    google_api_key=self.settings.GEMINI_API_KEY,
                    temperature=self.settings.LLM_TEMPERATURE,
                    max_tokens=self.settings.LLM_MAX_TOKENS,
                )
                print(f"Gemini initialized: {self.settings.GEMINI_MODEL_NAME}")
            except ImportError:
                print("langchain-google-genai not installed")
            except Exception as e:
                print(f"Gemini initialization failed: {e}")

        if self.settings.OPENAI_API_KEY:
            try:
                from langchain_openai import ChatOpenAI

                self.providers["openai"] = ChatOpenAI(
                    model=self.settings.OPENAI_MODEL_NAME,
                    api_key=self.settings.OPENAI_API_KEY,
                    temperature=self.settings.LLM_TEMPERATURE,
                    max_tokens=self.settings.LLM_MAX_TOKENS,
                )
                print(f"OpenAI initialized: {self.settings.OPENAI_MODEL_NAME}")
            except ImportError:
                print("langchain-openai not installed")
            except Exception as e:
                print(f"OpenAI initialization failed: {e}")

        if self.settings.ANTHROPIC_API_KEY:
            try:
                from langchain_anthropic import ChatAnthropic

                self.providers["anthropic"] = ChatAnthropic(
                    model=self.settings.ANTHROPIC_MODEL_NAME,
                    api_key=self.settings.ANTHROPIC_API_KEY,
                    temperature=self.settings.LLM_TEMPERATURE,
                    max_tokens=self.settings.LLM_MAX_TOKENS,
                )
                print(f"Anthropic initialized: {self.settings.ANTHROPIC_MODEL_NAME}")
            except ImportError:
                print("langchain-anthropic not installed")
            except Exception as e:
                print(f"Anthropic initialization failed: {e}")

        if self.settings.OLLAMA_BASE_URL:
            try:
                from langchain_ollama import ChatOllama

                self.providers["ollama"] = ChatOllama(
                    model=self.settings.OLLAMA_MODEL_NAME,
                    base_url=self.settings.OLLAMA_BASE_URL,
                    temperature=self.settings.LLM_TEMPERATURE,
                )
                print(f"Ollama initialized: {self.settings.OLLAMA_MODEL_NAME}")
            except ImportError:
                print("langchain-ollama not installed")
            except Exception as e:
                print(f"Ollama initialization failed: {e}")

        self._set_default_provider()

    def _set_default_provider(self) -> None:
        if not self.providers:
            print("No LLM providers available")
            return

        if self.settings.DEFAULT_LLM_PROVIDER and self.settings.DEFAULT_LLM_PROVIDER in self.providers:
            self.default_provider = self.settings.DEFAULT_LLM_PROVIDER
        else:
            priority = ["gemini", "openai", "anthropic", "ollama"]
            for provider in priority:
                if provider in self.providers:
                    self.default_provider = provider
                    break

        print(f"Default LLM provider: {self.default_provider}")

    @property
    def available_providers(self) -> list[str]:
        return list(self.providers.keys())

    def get_provider(self, name: Optional[str] = None) -> BaseChatModel:
        provider_name = name or self.default_provider

        if not provider_name:
            raise ValueError("No LLM provider available")

        if provider_name not in self.providers:
            raise ValueError(
                f"Provider '{provider_name}' not available. "
                f"Available: {self.available_providers}"
            )

        return self.providers[provider_name]

    async def invoke(
        self,
        messages: list[BaseMessage],
        provider: Optional[str] = None,
    ) -> str:
        llm = self.get_provider(provider)
        response = await llm.ainvoke(messages)
        return response.content

    async def invoke_with_fallback(
        self,
        messages: list[BaseMessage],
        provider: Optional[str] = None,
    ) -> tuple[str, str]:
        fallback_order = []

        preferred = provider or self.default_provider
        if preferred and preferred in self.providers:
            fallback_order.append(preferred)

        for p in self.providers:
            if p not in fallback_order:
                fallback_order.append(p)

        last_error: Optional[Exception] = None

        for provider_name in fallback_order:
            try:
                llm = self.providers[provider_name]
                response = await llm.ainvoke(messages)
                return response.content, provider_name
            except Exception as e:
                last_error = e
                print(f"{provider_name} failed: {e}")
                continue

        raise RuntimeError(
            f"All LLM providers failed. Last error: {last_error}"
        )

    async def stream(
        self,
        messages: list[BaseMessage],
        provider: Optional[str] = None,
    ) -> AsyncIterator[str]:
        llm = self.get_provider(provider)

        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content

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
