import uuid
from typing import Optional

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


COLLECTION_NAME = "documents"


class QdrantService:

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

        if COLLECTION_NAME not in collection_names:
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=self.embedding_service.dimension,
                    distance=Distance.COSINE,
                ),
            )

        self._collection_ensured = True

    async def add_chunks(
        self,
        document_id: str,
        chunks: list[dict],
        visibility: str = "global",
        owner_id: Optional[str] = None,
    ) -> list[str]:
        if not chunks:
            return []

        await self._ensure_collection()

        texts = [chunk["content"] for chunk in chunks]
        embeddings = await self.embedding_service.embed_batch(texts)

        points = []
        vector_ids = []

        for chunk, embedding in zip(chunks, embeddings):
            vector_id = str(uuid.uuid4())
            vector_ids.append(vector_id)

            points.append(PointStruct(
                id=vector_id,
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "content_hash": chunk["content_hash"],
                    "start_char": chunk.get("start_char"),
                    "end_char": chunk.get("end_char"),
                    "page_number": chunk.get("page_number"),
                    "visibility": visibility,
                    "owner_id": owner_id,
                },
            ))

        self.client.upsert(collection_name=COLLECTION_NAME, points=points)
        return vector_ids

    async def search(
        self,
        query: str,
        limit: int = 5,
        visibility: str = "global",
        owner_id: Optional[str] = None,
    ) -> list[dict]:
        await self._ensure_collection()

        query_vector = await self.embedding_service.embed(query)

        filter_conditions = [
            FieldCondition(key="visibility", match=MatchValue(value=visibility))
        ]

        if owner_id:
            filter_conditions.append(
                FieldCondition(key="owner_id", match=MatchValue(value=owner_id))
            )

        results = self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=Filter(must=filter_conditions) if filter_conditions else None,
            limit=limit,
        ).points

        return [
            {
                "id": result.id,
                "score": result.score,
                "document_id": result.payload.get("document_id"),
                "chunk_index": result.payload.get("chunk_index"),
                "content": result.payload.get("content"),
                "page_number": result.payload.get("page_number"),
            }
            for result in results
        ]

    def delete_by_document(self, document_id: str) -> None:
        self.client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id),
                    )
                ]
            ),
        )

    def get_collection_info(self) -> dict:
        info = self.client.get_collection(collection_name=COLLECTION_NAME)
        return {
            "name": COLLECTION_NAME,
            "vectors_count": info.vectors_count,
            "points_count": info.points_count,
        }


_qdrant_service: Optional[QdrantService] = None


def get_qdrant_service() -> QdrantService:
    global _qdrant_service
    if _qdrant_service is None:
        _qdrant_service = QdrantService()
    return _qdrant_service
