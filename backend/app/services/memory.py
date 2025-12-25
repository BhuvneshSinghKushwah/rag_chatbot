import logging
import uuid
from typing import Optional
from datetime import datetime

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    Filter,
    FieldCondition,
    MatchValue,
)

from app.config import Settings, get_settings
from app.services.embedding import get_embedding_service

logger = logging.getLogger(__name__)

MEMORY_COLLECTION = "user_memories"


class MemoryService:

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.client = QdrantClient(
            host=self.settings.QDRANT_HOST,
            port=self.settings.QDRANT_HTTP_PORT,
        )
        self.embedding_service = get_embedding_service()
        self._collection_ensured = False

    async def _ensure_collection(self) -> None:
        if self._collection_ensured:
            return

        if not self.embedding_service._initialized:
            await self.embedding_service.initialize()

        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]

        if MEMORY_COLLECTION not in collection_names:
            self.client.create_collection(
                collection_name=MEMORY_COLLECTION,
                vectors_config=VectorParams(
                    size=self.embedding_service.dimension,
                    distance=Distance.COSINE,
                ),
            )

        self._collection_ensured = True

    async def add_conversation(
        self,
        messages: list[dict],
        user_id: Optional[str] = None,
    ) -> dict:
        await self._ensure_collection()

        conversation_text = ""
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if role == "user":
                conversation_text += f"User: {content}\n"
            elif role == "assistant":
                conversation_text += f"Assistant: {content}\n"

        if not conversation_text.strip():
            return {"status": "empty"}

        embedding = await self.embedding_service.embed(conversation_text)
        memory_id = str(uuid.uuid4())

        point = PointStruct(
            id=memory_id,
            vector=embedding,
            payload={
                "user_id": user_id,
                "content": conversation_text.strip(),
                "created_at": datetime.utcnow().isoformat(),
            },
        )

        self.client.upsert(collection_name=MEMORY_COLLECTION, points=[point])
        logger.info(f"Memory added for user {user_id}: {memory_id}")

        return {"id": memory_id, "status": "added"}

    async def search(
        self,
        query: str,
        user_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[dict]:
        await self._ensure_collection()

        query_vector = await self.embedding_service.embed(query)

        filter_conditions = []
        if user_id:
            filter_conditions.append(
                FieldCondition(key="user_id", match=MatchValue(value=user_id))
            )

        results = self.client.query_points(
            collection_name=MEMORY_COLLECTION,
            query=query_vector,
            query_filter=Filter(must=filter_conditions) if filter_conditions else None,
            limit=limit,
        ).points

        return [
            {
                "id": str(result.id),
                "score": result.score,
                "content": result.payload.get("content"),
                "created_at": result.payload.get("created_at"),
            }
            for result in results
        ]

    async def get_all(self, user_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        await self._ensure_collection()

        filter_conditions = []
        if user_id:
            filter_conditions.append(
                FieldCondition(key="user_id", match=MatchValue(value=user_id))
            )

        results = self.client.scroll(
            collection_name=MEMORY_COLLECTION,
            scroll_filter=Filter(must=filter_conditions) if filter_conditions else None,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )[0]

        return [
            {
                "id": str(point.id),
                "content": point.payload.get("content"),
                "created_at": point.payload.get("created_at"),
            }
            for point in results
        ]

    def delete(self, memory_id: str) -> None:
        self.client.delete(
            collection_name=MEMORY_COLLECTION,
            points_selector=[memory_id],
        )

    def delete_all(self, user_id: Optional[str] = None) -> None:
        if user_id:
            self.client.delete(
                collection_name=MEMORY_COLLECTION,
                points_selector=Filter(
                    must=[
                        FieldCondition(key="user_id", match=MatchValue(value=user_id))
                    ]
                ),
            )
        else:
            self.client.delete_collection(collection_name=MEMORY_COLLECTION)
            self._collection_ensured = False

    async def get_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        limit: int = 5,
    ) -> str:
        search_results = await self.search(
            query=query,
            user_id=user_id,
            limit=limit,
        )
        logger.info(f"Memory search for user {user_id}: {len(search_results)} results")

        if not search_results:
            all_memories = await self.get_all(user_id=user_id, limit=limit)
            logger.info(f"All memories for user {user_id}: {len(all_memories)} total")
            if all_memories:
                search_results = all_memories

        if not search_results:
            return ""

        context_parts = []
        for mem in search_results:
            content = mem.get("content", "")
            if content:
                context_parts.append(f"- {content}")

        return "\n".join(context_parts)


_memory_service: Optional[MemoryService] = None


async def get_memory_service() -> MemoryService:
    global _memory_service
    if _memory_service is None:
        _memory_service = MemoryService()
    return _memory_service
