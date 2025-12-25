from abc import ABC, abstractmethod
from typing import Optional

import httpx
from sentence_transformers import SentenceTransformer

from app.config import Settings, get_settings


class BaseEmbedder(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        pass

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        pass

    @abstractmethod
    async def warmup(self) -> None:
        pass

    @abstractmethod
    async def close(self) -> None:
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass


class OllamaEmbedder(BaseEmbedder):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)
        self._dimension: Optional[int] = None

    async def embed(self, text: str) -> list[float]:
        response = await self.client.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text}
        )
        response.raise_for_status()
        embedding = response.json()["embedding"]
        if self._dimension is None:
            self._dimension = len(embedding)
        return embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]

    async def warmup(self) -> None:
        await self.embed("warmup")

    async def close(self) -> None:
        await self.client.aclose()

    @property
    def dimension(self) -> int:
        if self._dimension is None:
            raise RuntimeError("Dimension unknown. Call embed() or warmup() first.")
        return self._dimension


class OpenAIEmbedder(BaseEmbedder):
    DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0
        )

    async def embed(self, text: str) -> list[float]:
        response = await self.client.post(
            "/embeddings",
            json={"model": self.model, "input": text}
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.post(
            "/embeddings",
            json={"model": self.model, "input": texts}
        )
        response.raise_for_status()
        data = response.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]

    async def warmup(self) -> None:
        pass

    async def close(self) -> None:
        await self.client.aclose()

    @property
    def dimension(self) -> int:
        return self.DIMENSIONS.get(self.model, 1536)


class GeminiEmbedder(BaseEmbedder):
    def __init__(self, api_key: str, model: str = "text-embedding-004"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def embed(self, text: str) -> list[float]:
        response = await self.client.post(
            f"{self.base_url}/models/{self.model}:embedContent",
            params={"key": self.api_key},
            json={"content": {"parts": [{"text": text}]}}
        )
        response.raise_for_status()
        return response.json()["embedding"]["values"]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]

    async def warmup(self) -> None:
        pass

    async def close(self) -> None:
        await self.client.aclose()

    @property
    def dimension(self) -> int:
        return 768


class LocalEmbedder(BaseEmbedder):
    DIMENSIONS = {
        "nomic-ai/nomic-embed-text-v1.5": 768,
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "sentence-transformers/all-mpnet-base-v2": 768,
        "BAAI/bge-base-en-v1.5": 768,
        "BAAI/bge-small-en-v1.5": 384,
    }

    def __init__(self, model: str = "nomic-ai/nomic-embed-text-v1.5"):
        self.model_name = model
        self._model: Optional[SentenceTransformer] = None

    def _load_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(self.model_name, trust_remote_code=True)
        return self._model

    async def embed(self, text: str) -> list[float]:
        model = self._load_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = self._load_model()
        embeddings = model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    async def warmup(self) -> None:
        self._load_model()

    async def close(self) -> None:
        self._model = None

    @property
    def dimension(self) -> int:
        return self.DIMENSIONS.get(self.model_name, 768)


class EmbeddingService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.embedder: Optional[BaseEmbedder] = None
        self._initialized = False

    async def initialize(self) -> None:
        if self._initialized:
            return

        provider = self.settings.DEFAULT_EMBEDDING_PROVIDER

        if provider == "local":
            self.embedder = LocalEmbedder(
                self.settings.LOCAL_EMBEDDING_MODEL
            )
        elif provider == "ollama":
            self.embedder = OllamaEmbedder(
                self.settings.OLLAMA_BASE_URL,
                self.settings.OLLAMA_EMBEDDING_MODEL
            )
        elif provider == "openai":
            self.embedder = OpenAIEmbedder(
                self.settings.OPENAI_API_KEY,
                self.settings.OPENAI_EMBEDDING_MODEL
            )
        elif provider == "gemini":
            self.embedder = GeminiEmbedder(
                self.settings.GEMINI_API_KEY,
                self.settings.GEMINI_EMBEDDING_MODEL
            )
        else:
            raise ValueError(f"Unknown embedding provider: {provider}")

        await self.embedder.warmup()
        self._initialized = True

    async def embed(self, text: str) -> list[float]:
        if not self._initialized:
            await self.initialize()
        return await self.embedder.embed(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not self._initialized:
            await self.initialize()
        return await self.embedder.embed_batch(texts)

    @property
    def dimension(self) -> int:
        if self.embedder is None:
            raise RuntimeError("EmbeddingService not initialized")
        return self.embedder.dimension

    async def close(self) -> None:
        if self.embedder:
            await self.embedder.close()


_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


async def close_embedding_service() -> None:
    global _embedding_service
    if _embedding_service:
        await _embedding_service.close()
        _embedding_service = None
