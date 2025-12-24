from typing import Optional
from datetime import datetime
from enum import Enum
from mem0 import Memory

from app.config import Settings, get_settings


class MemoryType(str, Enum):
    PREFERENCE = "preference"
    ISSUE = "issue"
    GENERAL = "general"
    ROUTINE = "routine"
    HISTORICAL_SUMMARY = "historical_summary"


MEMORY_COLLECTION = "customer_support_memories"


class MemoryService:

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.memory: Optional[Memory] = None
        self._initialize()

    def _initialize(self) -> None:
        config = self._build_config()
        self.memory = Memory.from_config(config)

    def _build_config(self) -> dict:
        config = {
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "host": self.settings.QDRANT_HOST,
                    "port": self.settings.QDRANT_HTTP_PORT,
                    "collection_name": MEMORY_COLLECTION,
                }
            }
        }

        embed_provider = self.settings.DEFAULT_EMBEDDING_PROVIDER
        if embed_provider == "ollama":
            config["vector_store"]["config"]["embedding_model_dims"] = 768
            config["embedder"] = {
                "provider": "ollama",
                "config": {
                    "model": self.settings.OLLAMA_EMBEDDING_MODEL,
                    "ollama_base_url": self.settings.OLLAMA_BASE_URL,
                }
            }
        elif embed_provider == "gemini":
            config["vector_store"]["config"]["embedding_model_dims"] = 768
            config["embedder"] = {
                "provider": "gemini",
                "config": {
                    "model": f"models/{self.settings.GEMINI_EMBEDDING_MODEL}",
                    "api_key": self.settings.GEMINI_API_KEY,
                }
            }
        elif embed_provider == "openai":
            config["vector_store"]["config"]["embedding_model_dims"] = 1536
            config["embedder"] = {
                "provider": "openai",
                "config": {
                    "model": self.settings.OPENAI_EMBEDDING_MODEL,
                    "api_key": self.settings.OPENAI_API_KEY,
                }
            }

        llm_provider = self.settings.DEFAULT_LLM_PROVIDER
        if llm_provider == "ollama" or (not llm_provider and self.settings.OLLAMA_BASE_URL):
            config["llm"] = {
                "provider": "ollama",
                "config": {
                    "model": self.settings.OLLAMA_MODEL_NAME,
                    "temperature": self.settings.LLM_TEMPERATURE,
                    "max_tokens": self.settings.LLM_MAX_TOKENS,
                    "ollama_base_url": self.settings.OLLAMA_BASE_URL,
                }
            }
        elif llm_provider == "gemini" or (not llm_provider and self.settings.GEMINI_API_KEY):
            config["llm"] = {
                "provider": "gemini",
                "config": {
                    "model": self.settings.GEMINI_MODEL_NAME,
                    "temperature": self.settings.LLM_TEMPERATURE,
                    "max_tokens": self.settings.LLM_MAX_TOKENS,
                    "api_key": self.settings.GEMINI_API_KEY,
                }
            }
        elif llm_provider == "openai" or (not llm_provider and self.settings.OPENAI_API_KEY):
            config["llm"] = {
                "provider": "openai",
                "config": {
                    "model": self.settings.OPENAI_MODEL_NAME,
                    "temperature": self.settings.LLM_TEMPERATURE,
                    "max_tokens": self.settings.LLM_MAX_TOKENS,
                    "api_key": self.settings.OPENAI_API_KEY,
                }
            }
        elif llm_provider == "anthropic" or (not llm_provider and self.settings.ANTHROPIC_API_KEY):
            config["llm"] = {
                "provider": "anthropic",
                "config": {
                    "model": self.settings.ANTHROPIC_MODEL_NAME,
                    "temperature": self.settings.LLM_TEMPERATURE,
                    "max_tokens": self.settings.LLM_MAX_TOKENS,
                    "api_key": self.settings.ANTHROPIC_API_KEY,
                }
            }

        return config

    def add(
        self,
        content: str,
        user_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        kwargs = {}
        if user_id:
            kwargs["user_id"] = user_id
        if metadata:
            kwargs["metadata"] = metadata

        result = self.memory.add(content, **kwargs)
        return result

    def search(
        self,
        query: str,
        user_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[dict]:
        kwargs = {"limit": limit}
        if user_id:
            kwargs["user_id"] = user_id

        results = self.memory.search(query, **kwargs)
        return results.get("results", []) if isinstance(results, dict) else results

    def get_all(self, user_id: Optional[str] = None) -> list[dict]:
        kwargs = {}
        if user_id:
            kwargs["user_id"] = user_id

        results = self.memory.get_all(**kwargs)
        return results.get("results", []) if isinstance(results, dict) else results

    def get(self, memory_id: str) -> Optional[dict]:
        try:
            return self.memory.get(memory_id)
        except Exception:
            return None

    def update(self, memory_id: str, content: str) -> dict:
        return self.memory.update(memory_id, content)

    def delete(self, memory_id: str) -> None:
        self.memory.delete(memory_id)

    def delete_all(self, user_id: Optional[str] = None) -> None:
        kwargs = {}
        if user_id:
            kwargs["user_id"] = user_id

        self.memory.delete_all(**kwargs)

    def add_conversation(
        self,
        messages: list[dict],
        user_id: Optional[str] = None,
    ) -> dict:
        kwargs = {}
        if user_id:
            kwargs["user_id"] = user_id

        return self.memory.add(messages, **kwargs)

    def get_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        limit: int = 5,
    ) -> str:
        search_results = self.search(
            query=query,
            user_id=user_id,
            limit=limit,
        )

        all_memories = []
        if user_id:
            all_memories = self.get_all(user_id=user_id)

        seen_ids = set()
        combined = []

        for mem in search_results:
            mem_id = mem.get("id")
            if mem_id and mem_id not in seen_ids:
                seen_ids.add(mem_id)
                combined.append(mem)

        for mem in all_memories:
            mem_id = mem.get("id")
            if mem_id and mem_id not in seen_ids:
                seen_ids.add(mem_id)
                combined.append(mem)
            if len(combined) >= limit * 2:
                break

        if not combined:
            return ""

        context_parts = []
        for mem in combined:
            memory_text = mem.get("memory", mem.get("text", ""))
            if memory_text:
                context_parts.append(f"- Customer said: {memory_text}")

        return "\n".join(context_parts)


SUMMARIZE_PROMPT = """Summarize the following user interaction memories into a concise paragraph.
Focus on:
- User preferences and communication style
- Key issues or complaints they had
- Products or topics they were interested in
- Any important context for future conversations

Memories to summarize:
{memories}

Write a brief summary (2-3 sentences) that captures the essential information:"""


class MemoryManager:

    def __init__(
        self,
        memory_service: Optional[MemoryService] = None,
        settings: Optional[Settings] = None,
    ):
        self.memory = memory_service or get_memory_service()
        self.settings = settings or get_settings()

    def get_user_memory_count(self, user_id: str) -> int:
        memories = self.memory.get_all(user_id=user_id)
        return len(memories)

    def needs_compaction(self, user_id: str) -> bool:
        count = self.get_user_memory_count(user_id)
        return count >= self.settings.MEMORY_COMPACTION_THRESHOLD

    def _get_memory_age_days(self, memory: dict) -> int:
        created_at = memory.get("created_at")
        if not created_at:
            return 0

        if isinstance(created_at, str):
            try:
                created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except ValueError:
                return 0
        elif isinstance(created_at, datetime):
            created_dt = created_at
        else:
            return 0

        now = datetime.now(created_dt.tzinfo) if created_dt.tzinfo else datetime.now()
        return (now - created_dt).days

    def _get_memory_type(self, memory: dict) -> MemoryType:
        metadata = memory.get("metadata", {}) or {}
        mem_type = metadata.get("type")

        if mem_type:
            try:
                return MemoryType(mem_type)
            except ValueError:
                pass

        return MemoryType.GENERAL

    def _get_retention_days(self, memory_type: MemoryType) -> int:
        if memory_type == MemoryType.PREFERENCE:
            return 999999
        elif memory_type == MemoryType.ISSUE:
            return self.settings.MEMORY_RETENTION_DAYS_ISSUES
        elif memory_type == MemoryType.ROUTINE:
            return self.settings.MEMORY_RETENTION_DAYS_ROUTINE
        elif memory_type == MemoryType.HISTORICAL_SUMMARY:
            return 999999
        else:
            return self.settings.MEMORY_RETENTION_DAYS_GENERAL

    def _is_expired(self, memory: dict) -> bool:
        mem_type = self._get_memory_type(memory)
        retention_days = self._get_retention_days(mem_type)
        age_days = self._get_memory_age_days(memory)
        return age_days > retention_days

    def get_expired_memories(self, user_id: str) -> list[dict]:
        memories = self.memory.get_all(user_id=user_id)
        return [m for m in memories if self._is_expired(m)]

    def get_old_memories(self, user_id: str, older_than_days: int = 30) -> list[dict]:
        memories = self.memory.get_all(user_id=user_id)
        old = []
        for m in memories:
            mem_type = self._get_memory_type(m)
            if mem_type in (MemoryType.PREFERENCE, MemoryType.HISTORICAL_SUMMARY):
                continue
            if self._get_memory_age_days(m) > older_than_days:
                old.append(m)
        return old

    async def summarize_memories(self, memories: list[dict]) -> str:
        from app.services.llm import get_llm_service

        if not memories:
            return ""

        memory_texts = []
        for m in memories:
            text = m.get("memory", m.get("text", ""))
            if text:
                memory_texts.append(f"- {text}")

        if not memory_texts:
            return ""

        memories_str = "\n".join(memory_texts)
        prompt = SUMMARIZE_PROMPT.format(memories=memories_str)

        llm = get_llm_service()
        messages = llm.create_messages(user_message=prompt)

        try:
            summary, _ = await llm.invoke_with_fallback(messages)
            return summary.strip()
        except Exception:
            return ""

    async def compact_user_memory(self, user_id: str) -> dict:
        result = {
            "user_id": user_id,
            "memories_before": 0,
            "memories_deleted": 0,
            "summary_created": False,
            "expired_deleted": 0,
        }

        memories = self.memory.get_all(user_id=user_id)
        result["memories_before"] = len(memories)

        if len(memories) < self.settings.MEMORY_COMPACTION_THRESHOLD:
            return result

        expired = self.get_expired_memories(user_id)
        for m in expired:
            mem_id = m.get("id")
            if mem_id:
                try:
                    self.memory.delete(mem_id)
                    result["expired_deleted"] += 1
                except Exception:
                    pass

        if len(memories) - result["expired_deleted"] < self.settings.MEMORY_MAX_PER_USER:
            return result

        old_memories = self.get_old_memories(
            user_id,
            older_than_days=self.settings.MEMORY_RETENTION_DAYS_GENERAL,
        )

        if len(old_memories) < self.settings.MEMORY_SUMMARY_BATCH_SIZE:
            return result

        batch = old_memories[: self.settings.MEMORY_SUMMARY_BATCH_SIZE]
        summary = await self.summarize_memories(batch)

        if summary:
            self.memory.add(
                content=summary,
                user_id=user_id,
                metadata={"type": MemoryType.HISTORICAL_SUMMARY.value},
            )
            result["summary_created"] = True

            for m in batch:
                mem_id = m.get("id")
                if mem_id:
                    try:
                        self.memory.delete(mem_id)
                        result["memories_deleted"] += 1
                    except Exception:
                        pass

        return result

    async def cleanup_expired(self, user_id: str) -> int:
        expired = self.get_expired_memories(user_id)
        deleted = 0

        for m in expired:
            mem_id = m.get("id")
            if mem_id:
                try:
                    self.memory.delete(mem_id)
                    deleted += 1
                except Exception:
                    pass

        return deleted


_memory_service: Optional[MemoryService] = None
_memory_manager: Optional[MemoryManager] = None


def get_memory_service() -> MemoryService:
    global _memory_service
    if _memory_service is None:
        _memory_service = MemoryService()
    return _memory_service


def get_memory_manager() -> MemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager
