import logging
from typing import Optional, AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm import get_llm_service
from app.services.memory import get_memory_service
from app.services.qdrant import get_qdrant_service
from app.db.postgres import Conversation, Message

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """
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


class ChatService:
    def __init__(self):
        self.llm = get_llm_service()
        self.memory = None
        self.qdrant = get_qdrant_service()

    async def _get_memory(self):
        if self.memory is None:
            self.memory = await get_memory_service()
        return self.memory

    async def _get_rag_context(self, query: str, limit: int = 5) -> str:
        results = await self.qdrant.search(query=query, limit=limit)

        if not results:
            return ""

        context_parts = []
        for result in results:
            content = result.get("content", "")
            if content:
                context_parts.append(content)

        return "\n\n".join(context_parts)

    async def _get_memory_context(self, query: str, user_id: str) -> str:
        memory = await self._get_memory()
        context = await memory.get_context(
            query=query,
            user_id=user_id,
            limit=5,
        )
        logger.info(f"Memory context for user {user_id}: {context[:200] if context else 'empty'}")
        return context

    def _build_system_prompt(self, rag_context: str, memory_context: str) -> str:
        return SYSTEM_PROMPT.format(
            rag_context=rag_context if rag_context else "No relevant information.",
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
    ) -> tuple[str, bool]:
        rag_context = await self._get_rag_context(message)
        memory_context = await self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(rag_context, memory_context)

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

        return response, memory_updated

    async def chat_stream(
        self,
        db: AsyncSession,
        message: str,
        session_id: str,
        user_id: str,
        model_id: Optional[UUID] = None,
    ) -> AsyncIterator[str]:
        rag_context = await self._get_rag_context(message)
        memory_context = await self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(rag_context, memory_context)

        chat_history = await self.get_chat_history(db, session_id, limit=10)

        messages = self.llm.create_messages(
            user_message=message,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        full_response = ""

        async for chunk in self.llm.stream(db, messages, model_id):
            full_response += chunk
            yield chunk

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
