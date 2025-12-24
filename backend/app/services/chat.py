from typing import Optional, AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm import get_llm_service
from app.services.memory import get_memory_service, get_memory_manager
from app.services.qdrant import get_qdrant_service
from app.db.postgres import Conversation, Message


SYSTEM_PROMPT = """

Role: You are a friendly, helpful, and concise customer support representative.

Perspective:
- You represent our team: always use "we", "our", and "us".
- Address the user directly: always use "you" and "your".
- Prohibited Terms: Never use the phrases "the company" or "the customer".

Strict Response Guidelines:
1. Exact Accuracy: State facts exactly as written in the <knowledge_base>. 
2. No Modification: Do not infer, combine, or rephrase facts. If the information is not present, politely state that we do not have that information.
3. Date/Year Protocol: If asked about a specific date or year, quote only the text associated with that date/year verbatim.
4. History Access: You are permitted to share details from the <customer_history> with the user if they ask about information they have previously shared.

Context:
<knowledge_base>
{rag_context}
</knowledge_base>

<customer_history>
{memory_context}
</customer_history>

Execution: Process the user's request by strictly following the rules above.

"""


class ChatService:
    def __init__(self):
        self.llm = get_llm_service()
        self.memory = get_memory_service()
        self.qdrant = get_qdrant_service()

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

    def _get_memory_context(self, query: str, user_id: str) -> str:
        return self.memory.get_context(
            query=query,
            user_id=user_id,
            limit=5,
        )

    def _build_system_prompt(self, rag_context: str, memory_context: str) -> str:
        return SYSTEM_PROMPT.format(
            rag_context=rag_context if rag_context else "No relevant information.",
            memory_context=memory_context if memory_context else "No previous interactions.",
        )

    async def _update_memory(self, user_id: str, message: str, response: str) -> bool:
        try:
            self.memory.add_conversation(
                messages=[
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": response},
                ],
                user_id=user_id,
            )

            manager = get_memory_manager()
            if manager.needs_compaction(user_id):
                await manager.compact_user_memory(user_id)

            return True
        except Exception:
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
        provider: Optional[str] = None,
    ) -> tuple[str, bool]:
        rag_context = await self._get_rag_context(message)
        memory_context = self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(rag_context, memory_context)

        chat_history = await self.get_chat_history(db, session_id, limit=10)

        messages = self.llm.create_messages(
            user_message=message,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        response, used_provider = await self.llm.invoke_with_fallback(messages, provider)

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
        provider: Optional[str] = None,
    ) -> AsyncIterator[str]:
        rag_context = await self._get_rag_context(message)
        memory_context = self._get_memory_context(message, user_id)
        system_prompt = self._build_system_prompt(rag_context, memory_context)

        chat_history = await self.get_chat_history(db, session_id, limit=10)

        messages = self.llm.create_messages(
            user_message=message,
            system_prompt=system_prompt,
            chat_history=chat_history,
        )

        full_response = ""

        async for chunk in self.llm.stream(messages, provider):
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
