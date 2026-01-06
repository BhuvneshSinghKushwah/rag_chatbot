import logging
import asyncio
from typing import Optional, AsyncIterator
from uuid import UUID
from enum import Enum
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.llm import get_llm_service
from app.services.memory import get_memory_service
from app.services.qdrant import get_qdrant_service
from app.services.web_search import get_web_search_service
from app.db.postgres import Conversation, Message

logger = logging.getLogger(__name__)
settings = get_settings()


class ContextSource(str, Enum):
    DOCUMENTS = "documents"
    WEB = "web"
    NONE = "none"


@dataclass
class ContextResult:
    source: ContextSource
    content: str
    sources: list[str]


SYSTEM_PROMPT_DOCUMENTS = """
You are a friendly customer support assistant. Talk like a helpful friend, not a salesman.

Keep responses brief. Only answer what was asked. No promotions or upselling.

Use "we", "our", "us" when referring to the company. Use "you", "your" for the customer.

You have access to the customer's previous conversations shown below. When they ask about past interactions, their name, or previous questions, refer to this history directly.

Previous Conversations:
{memory_context}

Product Information:
{rag_context}

Important:
- You MUST ONLY answer based on the Product Information provided above. Do not answer from your general knowledge.
- If Product Information contains relevant content, use ONLY that to answer. Never add information beyond what is provided.
- If the Product Information does not contain the answer, respond with: "I don't have information about that in our knowledge base. Is there something else I can help you with?"
- For questions about previous conversations or the customer's name, refer to the Previous Conversations section.
- Be direct and concise.
"""

SYSTEM_PROMPT_WEB = """
You are a friendly customer support assistant. Talk like a helpful friend, not a salesman.

Keep responses brief. Only answer what was asked. No promotions or upselling.

Use "we", "our", "us" when referring to the company. Use "you", "your" for the customer.

You have access to the customer's previous conversations shown below. When they ask about past interactions, their name, or previous questions, refer to this history directly.

Previous Conversations:
{memory_context}

IMPORTANT: The answer was not found in our company documents, so I searched the web for you.

Web Search Results:
{rag_context}

Important:
- Use the web search results above to answer the question.
- Always mention that this information comes from web search, not our official documents.
- Web results may not reflect official company policies.
- If the web results don't contain a good answer, say so clearly.
- Be direct and concise.
"""

SYSTEM_PROMPT_NONE = """
You are a friendly customer support assistant. Talk like a helpful friend, not a salesman.

Keep responses brief. Only answer what was asked. No promotions or upselling.

Use "we", "our", "us" when referring to the company. Use "you", "your" for the customer.

You have access to the customer's previous conversations shown below. When they ask about past interactions, their name, or previous questions, refer to this history directly.

Previous Conversations:
{memory_context}

No relevant information found:
{rag_context}

Important:
- I could not find relevant information in our documents or on the web.
- Politely explain that you don't have information about this topic.
- Suggest the customer contact support directly or ask a different question.
- Be direct and concise.
"""


class ChatService:
    def __init__(self):
        self.llm = get_llm_service()
        self.memory = None
        self.qdrant = get_qdrant_service()
        self.web_search = get_web_search_service()
        self.relevance_threshold = settings.RAG_RELEVANCE_THRESHOLD
        self.web_search_enabled = settings.WEB_SEARCH_ENABLED

    async def _get_memory(self):
        if self.memory is None:
            self.memory = await get_memory_service()
        return self.memory

    async def _get_rag_context(self, query: str, limit: int = 5) -> tuple[str, float]:
        results = await self.qdrant.search(query=query, limit=limit)

        if not results:
            return "", 0.0

        top_score = results[0].get("score", 0.0) if results else 0.0

        context_parts = []
        for result in results:
            content = result.get("content", "")
            if content:
                context_parts.append(content)

        return "\n\n".join(context_parts), top_score

    async def _get_context_with_fallback(self, query: str) -> ContextResult:
        if self.web_search_enabled:
            rag_task = self._get_rag_context(query)
            web_task = self.web_search.search(
                query=query,
                num_results=settings.WEB_SEARCH_MAX_RESULTS
            )
            (rag_context, top_score), web_results = await asyncio.gather(
                rag_task, web_task
            )
        else:
            rag_context, top_score = await self._get_rag_context(query)
            web_results = []

        if rag_context and top_score >= self.relevance_threshold:
            logger.info(f"Using RAG context (score: {top_score:.3f})")
            return ContextResult(
                source=ContextSource.DOCUMENTS,
                content=rag_context,
                sources=[]
            )

        if web_results:
            logger.info(f"RAG score too low ({top_score:.3f}), using web search results")
            return ContextResult(
                source=ContextSource.WEB,
                content=self.web_search.format_results(web_results),
                sources=self.web_search.get_source_urls(web_results)
            )

        if rag_context:
            return ContextResult(
                source=ContextSource.DOCUMENTS,
                content=rag_context,
                sources=[]
            )

        return ContextResult(
            source=ContextSource.NONE,
            content="No relevant information found.",
            sources=[]
        )

    async def _get_memory_context(self, query: str, user_id: str) -> str:
        memory = await self._get_memory()
        context = await memory.get_context(
            query=query,
            user_id=user_id,
            limit=5,
        )
        logger.info(f"Memory context for user {user_id}: {context[:200] if context else 'empty'}")
        return context

    def _build_system_prompt(
        self,
        context_result: ContextResult,
        memory_context: str
    ) -> str:
        if context_result.source == ContextSource.DOCUMENTS:
            template = SYSTEM_PROMPT_DOCUMENTS
        elif context_result.source == ContextSource.WEB:
            template = SYSTEM_PROMPT_WEB
        else:
            template = SYSTEM_PROMPT_NONE

        return template.format(
            rag_context=context_result.content if context_result.content else "No relevant information.",
            memory_context=memory_context if memory_context else "No previous interactions.",
        )

    async def _update_memory(self, user_id: str, message: str, response: str) -> bool:
        try:
            memory = await self._get_memory()
            await memory.add_conversation(
                messages=[
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": response},
                ],
                user_id=user_id,
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to update memory for user {user_id}: {e}")
            return False

    async def get_or_create_conversation(
        self,
        db: AsyncSession,
        session_id: str,
        user_id: str,
    ) -> Conversation:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            conversation = Conversation(session_id=session_id, user_id=user_id)
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)

        return conversation

    async def save_message(
        self,
        db: AsyncSession,
        conversation_id,
        role: str,
        content: str,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    async def get_chat_history(
        self,
        db: AsyncSession,
        session_id: str,
        limit: int = 20,
    ) -> list[dict]:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            return []

        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()

        return [
            {
                "role": msg.role,
                "content": msg.content,
            }
            for msg in reversed(messages)
        ]

    async def chat(
        self,
        db: AsyncSession,
        message: str,
        session_id: str,
        user_id: str,
        model_id: Optional[UUID] = None,
    ) -> tuple[str, bool, ContextResult]:
        context_result = await self._get_context_with_fallback(message)
        memory_context = await self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(context_result, memory_context)

        chat_history = await self.get_chat_history(db, session_id, limit=10)

        messages = self.llm.create_messages(
            user_message=message,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        response = await self.llm.invoke(db, messages, model_id)

        conversation = await self.get_or_create_conversation(db, session_id, user_id)
        await self.save_message(db, conversation.id, "user", message)
        await self.save_message(db, conversation.id, "assistant", response)

        memory_updated = await self._update_memory(user_id, message, response)

        return response, memory_updated, context_result

    async def chat_stream(
        self,
        db: AsyncSession,
        message: str,
        session_id: str,
        user_id: str,
        model_id: Optional[UUID] = None,
    ) -> AsyncIterator[tuple[str, Optional[ContextResult]]]:
        context_result = await self._get_context_with_fallback(message)
        memory_context = await self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(context_result, memory_context)

        chat_history = await self.get_chat_history(db, session_id, limit=10)

        messages = self.llm.create_messages(
            user_message=message,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        full_response = ""
        first_chunk = True

        async for chunk in self.llm.stream(db, messages, model_id):
            full_response += chunk
            if first_chunk:
                yield chunk, context_result
                first_chunk = False
            else:
                yield chunk, None

        conversation = await self.get_or_create_conversation(db, session_id, user_id)
        await self.save_message(db, conversation.id, "user", message)
        await self.save_message(db, conversation.id, "assistant", full_response)

        await self._update_memory(user_id, message, full_response)


_chat_service: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
