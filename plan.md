# Customer Support Chat with RAG + Memory

## Goal

Build a web app that simulates customer support chat where an AI agent answers user questions using RAG (Retrieval Augmented Generation) with persistent memory, backed by company documents.

---

## Tech Stack

### LLM Providers (Configurable)
| Provider | Model | Use Case |
|----------|-------|----------|
| Google Gemini | `gemini-2.0-flash-001` | Primary LLM |
| OpenAI | `gpt-4o` | Fallback/Alternative |
| Anthropic | `claude-sonnet-4-20250514` | Fallback/Alternative |

### Embeddings (Configurable Providers)
| Provider | Model | Dimensions | Context | Use Case |
|----------|-------|------------|---------|----------|
| Ollama | `nomic-embed-text` | 768 | 8192 tokens | Default (local + production) |
| OpenAI | `text-embedding-3-small` | 1536 | 8191 tokens | Alternative |
| Gemini | `text-embedding-004` | 768 | 2048 tokens | Alternative |

**Recommended: `nomic-embed-text`** - Outperforms OpenAI text-embedding-ada-002 and text-embedding-3-small on both short and long context tasks. Ideal for semantic chunking with 1000 token chunks.

Uses async HTTP API with provider abstraction (same pattern as LLM router).
Warmup on startup eliminates first-request latency.

### Memory & RAG Framework
- **Mem0** - Memory layer for conversational context
  - GitHub: https://github.com/mem0ai/mem0
  - Hybrid storage: vector + graph + key-value
  - **User-level memory only** (no session-level memory)
  - Memories persist across sessions for continuity

### Storage (Dockerized)
| Service | Purpose | Port |
|---------|---------|------|
| **Redis** | In-memory cache, session store, fast retrieval | 6379 |
| **Qdrant** | Vector database for embeddings (persistent) | 6333 |
| **PostgreSQL** | Conversation logs, user data, metadata | 5432 |

### Backend
- **Python 3.11+**
- **FastAPI** - REST API framework
- **Mem0** - Memory + RAG orchestration
- **LangChain** (optional) - Document loading/chunking

### Frontend
- **React** or **Next.js**
- **Tailwind CSS** - Styling
- WebSocket or SSE for real-time streaming

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Chat Widget (React/Next.js)                 │    │
│  │  - Message input                                         │    │
│  │  - Chat history display                                  │    │
│  │  - Streaming response support                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Chat API     │  │ Document API │  │ Admin API            │   │
│  │ /chat        │  │ /documents   │  │ /conversations       │   │
│  │ /stream      │  │ /upload      │  │ /analytics           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Mem0 Memory Layer                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              User Memory (user_id based)             │  │  │
│  │  │  - Preferences, past issues, product interests      │  │  │
│  │  │  - Historical summaries (compressed old memories)   │  │  │
│  │  │  - Bounded: max 100 memories per user               │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    LLM Router                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │  │
│  │  │ Gemini  │  │ OpenAI  │  │ Claude  │                    │  │
│  │  └─────────┘  └─────────┘  └─────────┘                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOCKERIZED STORAGE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │    Redis     │  │   Qdrant     │  │    PostgreSQL        │   │
│  │   :6379      │  │   :6333      │  │      :5432           │   │
│  │              │  │              │  │                      │   │
│  │ • Session    │  │ • Document   │  │ • Conversations      │   │
│  │ • Cache      │  │   embeddings │  │ • Users              │   │
│  │ • Fast       │  │ • Semantic   │  │ • Analytics          │   │
│  │   retrieval  │  │   search     │  │ • Audit logs         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core User Flow

```
1. User opens web page → Chat widget loads
                              │
2. User types message ────────┤
   "What's your return policy?"
                              │
3. Frontend sends POST /chat ─┤
   {message, session_id, user_id}
                              │
4. Backend receives request ──┤
   │
   ├─► Mem0: Retrieve relevant memories (user prefs, past context)
   │
   ├─► Qdrant: Semantic search company docs (RAG)
   │
   ├─► Build prompt with:
   │   - System prompt (customer support persona)
   │   - Retrieved documents (context)
   │   - Memory context (past interactions)
   │   - User message
   │
   ├─► LLM API call (Gemini/OpenAI/Claude)
   │
   ├─► Mem0: Store new memories from interaction
   │
   └─► PostgreSQL: Log conversation
                              │
5. Stream response to frontend
                              │
6. Display AI response in chat
```

---

## Mem0 Configuration

**Important:** Embedding provider and LLM provider are configured independently. Once you choose an embedding provider, stick with it - changing requires deleting the Qdrant collection since vector dimensions differ.

| Embedding Provider | Dimensions | Notes |
|-------------------|------------|-------|
| `ollama` (nomic-embed-text) | 768 | Default, local, free |
| `gemini` (text-embedding-004) | 768 | Cloud, requires API key |
| `openai` (text-embedding-3-small) | 1536 | Cloud, requires API key |

```python
from mem0 import Memory

def build_mem0_config(settings) -> dict:
    config = {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "host": settings.QDRANT_HOST,
                "port": settings.QDRANT_HTTP_PORT,
                "collection_name": "customer_support_memories",
            }
        }
    }

    embed_provider = settings.DEFAULT_EMBEDDING_PROVIDER
    if embed_provider == "ollama":
        config["vector_store"]["config"]["embedding_model_dims"] = 768
        config["embedder"] = {
            "provider": "ollama",
            "config": {
                "model": settings.OLLAMA_EMBEDDING_MODEL,
                "ollama_base_url": settings.OLLAMA_BASE_URL,
            }
        }
    elif embed_provider == "gemini":
        config["vector_store"]["config"]["embedding_model_dims"] = 768
        config["embedder"] = {
            "provider": "gemini",
            "config": {
                "model": f"models/{settings.GEMINI_EMBEDDING_MODEL}",
                "api_key": settings.GEMINI_API_KEY,
            }
        }
    elif embed_provider == "openai":
        config["vector_store"]["config"]["embedding_model_dims"] = 1536
        config["embedder"] = {
            "provider": "openai",
            "config": {
                "model": settings.OPENAI_EMBEDDING_MODEL,
                "api_key": settings.OPENAI_API_KEY,
            }
        }

    llm_provider = settings.DEFAULT_LLM_PROVIDER
    if llm_provider == "ollama":
        config["llm"] = {
            "provider": "ollama",
            "config": {
                "model": settings.OLLAMA_MODEL_NAME,
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
                "ollama_base_url": settings.OLLAMA_BASE_URL,
            }
        }
    elif llm_provider == "gemini":
        config["llm"] = {
            "provider": "gemini",
            "config": {
                "model": settings.GEMINI_MODEL_NAME,
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
                "api_key": settings.GEMINI_API_KEY,
            }
        }
    elif llm_provider == "openai":
        config["llm"] = {
            "provider": "openai",
            "config": {
                "model": settings.OPENAI_MODEL_NAME,
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
                "api_key": settings.OPENAI_API_KEY,
            }
        }
    elif llm_provider == "anthropic":
        config["llm"] = {
            "provider": "anthropic",
            "config": {
                "model": settings.ANTHROPIC_MODEL_NAME,
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
                "api_key": settings.ANTHROPIC_API_KEY,
            }
        }

    return config

memory = Memory.from_config(build_mem0_config(settings))
```

### Memory Management Strategy

User-level memory with bounded storage to prevent unbounded growth.

#### Design Principles
- **User-level only**: All memories stored by `user_id`, not `session_id`
- **Cross-session continuity**: User returns next day, bot remembers past interactions
- **Bounded storage**: Max 100 memories per user to control costs

#### Tiered Retention Policy

| Memory Type | Retention | Examples |
|-------------|-----------|----------|
| Preferences | Forever | "Prefers email", "Ships to Canada" |
| Issues/Complaints | 90 days | "Had refund issue in Oct" |
| General Q&A | 30 days | "Asked about return policy" |
| Routine interactions | 7 days | "Asked store hours" |

#### Memory Compaction Process

When user memory count exceeds threshold:

```
1. Check: user_memory_count > MAX_MEMORIES (100)
2. Fetch: Get memories older than 30 days
3. Summarize: LLM compresses old memories into summary
4. Delete: Remove old individual memories
5. Store: Save summary as "historical_summary" type
```

#### Implementation

```python
class MemoryManager:
    MAX_MEMORIES_PER_USER = 100
    COMPACTION_THRESHOLD = 80
    SUMMARY_BATCH_SIZE = 50

    async def compact_user_memory(self, user_id: str):
        memories = self.memory.get_all(user_id=user_id)

        if len(memories) < self.MAX_MEMORIES_PER_USER:
            return

        old_memories = [m for m in memories if self._is_old(m, days=30)]

        if len(old_memories) < self.SUMMARY_BATCH_SIZE:
            return

        summary = await self._summarize_memories(old_memories[:self.SUMMARY_BATCH_SIZE])

        for mem in old_memories[:self.SUMMARY_BATCH_SIZE]:
            self.memory.delete(mem["id"])

        self.memory.add(
            content=summary,
            user_id=user_id,
            metadata={"type": "historical_summary"}
        )
```

#### Session vs Conversation Logging

| Storage | Purpose | Retention |
|---------|---------|-----------|
| Mem0 (Qdrant) | User memories for context | Managed by compaction |
| PostgreSQL | Full conversation logs | Configurable (audit/analytics) |
| Redis | Active session cache | TTL-based expiry |

### Embedding Service (Configurable Providers)

```python
from abc import ABC, abstractmethod
from typing import Optional
import httpx

class BaseEmbedder(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]: ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    async def warmup(self) -> None: ...

class OllamaEmbedder(BaseEmbedder):
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model
        self.client = httpx.AsyncClient(timeout=30.0)

    async def embed(self, text: str) -> list[float]:
        response = await self.client.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text}
        )
        return response.json()["embedding"]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]

    async def warmup(self) -> None:
        await self.embed("warmup")

class OpenAIEmbedder(BaseEmbedder):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(
            base_url="https://api.openai.com/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0
        )

    async def embed(self, text: str) -> list[float]:
        response = await self.client.post(
            "/embeddings",
            json={"model": self.model, "input": text}
        )
        return response.json()["data"][0]["embedding"]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self.client.post(
            "/embeddings",
            json={"model": self.model, "input": texts}
        )
        data = response.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]

    async def warmup(self) -> None:
        pass  # No warmup needed for cloud API

def get_embedder(provider: str, settings) -> BaseEmbedder:
    if provider == "ollama":
        return OllamaEmbedder(settings.OLLAMA_BASE_URL, settings.OLLAMA_EMBEDDING_MODEL)
    elif provider == "openai":
        return OpenAIEmbedder(settings.OPENAI_API_KEY, settings.OPENAI_EMBEDDING_MODEL)
    elif provider == "gemini":
        return GeminiEmbedder(settings.GEMINI_API_KEY, settings.GEMINI_EMBEDDING_MODEL)
    raise ValueError(f"Unknown embedding provider: {provider}")
```

---

## Docker Compose Setup

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: support_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    container_name: support_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: support_postgres
    environment:
      POSTGRES_USER: support_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: support_chat
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis_data:
  qdrant_data:
  postgres_data:
```

---

## API Endpoints

### Chat API
```
WebSocket /api/chat/ws
  Connect: /api/chat/ws?session_id={session_id}&fingerprint={fingerprint}

  Client -> Server:
    { type: "message", content: string }

  Server -> Client:
    { type: "token", content: string }      # Streaming tokens
    { type: "complete", sources: string[] } # End of response
    { type: "error", message: string }      # Error

POST /api/chat
  Body: { message, session_id, fingerprint }
  Response: { response, sources[], user_id, memory_updated }
  Note: Non-streaming fallback, fingerprint required for user_id generation

GET /api/chat/history/{session_id}
  Query: ?fingerprint={fingerprint}
  Response: { messages[] }
```

### Document Management (Current: Shared, Read-Only for Users)
```
POST /api/documents/upload
  Body: multipart/form-data (PDF, TXT, MD, DOCX)
  Auth: Admin only (API key or basic auth)
  Response: { document_id, chunks_created, filename, status }

GET /api/documents
  Auth: Public (all users see same documents)
  Response: { documents[] }

# Future CRUD endpoints (disabled for now)
# PUT /api/documents/{id}        # Update document
# DELETE /api/documents/{id}     # Delete document
# GET /api/documents/{id}/chunks # View document chunks
```

### Admin
```
GET /api/conversations
GET /api/conversations/{id}
GET /api/analytics/usage
```

---

## Project Structure

```
rag_chatbot/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings & env vars
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py          # Chat endpoints
│   │   │   ├── documents.py     # Document management
│   │   │   └── admin.py         # Admin endpoints
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── memory.py        # Mem0 integration
│   │   │   ├── llm.py           # LLM router (Gemini/OpenAI/Claude)
│   │   │   ├── rag.py           # RAG pipeline
│   │   │   └── document.py      # Doc processing
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py          # Pydantic models
│   │   │   └── document.py
│   │   │
│   │   └── db/
│   │       ├── __init__.py
│   │       ├── postgres.py      # SQLAlchemy models
│   │       └── redis.py         # Redis client
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWidget.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   └── TypingIndicator.tsx
│   │   │   │
│   │   │   ├── documents/
│   │   │   │   ├── DocumentList.tsx      # List all uploaded docs
│   │   │   │   ├── DocumentCard.tsx      # Single document display
│   │   │   │   ├── UploadForm.tsx        # File upload (admin only)
│   │   │   │   └── UploadProgress.tsx    # Upload progress indicator
│   │   │   │
│   │   │   └── layout/
│   │   │       ├── Header.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── Navigation.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx              # Main chat interface
│   │   │   ├── DocumentsPage.tsx         # View uploaded documents
│   │   │   └── AdminPage.tsx             # Admin: upload + manage (future)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   ├── useDocuments.ts           # Fetch/manage documents
│   │   │   └── useFingerprint.ts         # Browser fingerprint
│   │   │
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── fingerprint.ts
│   │   │   └── documents.ts              # Document API calls
│   │   │
│   │   ├── types/
│   │   │   ├── chat.ts
│   │   │   └── document.ts
│   │   │
│   │   └── App.tsx
│   │
│   ├── package.json
│   ├── Dockerfile
│   └── tailwind.config.js
│
└── docs/
    └── company_documents/       # Documents to embed
        ├── return_policy.md
        ├── shipping_info.md
        └── faq.md
```

---

## Environment Variables

```bash
# .env

# LLM Providers
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Default LLM (gemini, openai, anthropic)
DEFAULT_LLM_PROVIDER=gemini

# Embeddings (configurable provider)
# nomic-embed-text recommended for both local and production
DEFAULT_EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
GEMINI_EMBEDDING_MODEL=text-embedding-004

# Database
POSTGRES_PASSWORD=secure_password
DATABASE_URL=postgresql://support_user:${POSTGRES_PASSWORD}@localhost:5432/support_chat

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# App
SECRET_KEY=your_secret_key
CORS_ORIGINS=http://localhost:3000
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup
- [D] Create docker-compose.yml with Redis, Qdrant, PostgreSQL
- [D] Set up FastAPI project structure
- [D] Configure environment variables
- [D] Basic health check endpoints

### Phase 2: Document Ingestion Pipeline
- [D] Document upload endpoint
- [D] Text extraction (PDF, DOCX, MD, TXT)
- [D] Chunking strategy (semantic via LangChain RecursiveCharacterTextSplitter)
- [D] Embedding generation (Ollama/OpenAI/Gemini - configurable)
- [D] Store in Qdrant

### Phase 3: Memory Integration
- [D] Initialize Mem0 with Qdrant backend
- [D] Configure LLM provider (Gemini default)
- [D] Implement memory add/search/update
- [D] User-level memory only (no session-level memory)
- [D] Memory compaction service (summarize old memories)
- [D] Tiered retention policy implementation

### Phase 4: Chat API
- [D] Fingerprint-based user_id generation (required)
- [D] WebSocket /chat/ws endpoint with streaming
- [D] POST /chat endpoint (non-streaming fallback)
- [D] RAG retrieval from Qdrant
- [D] Memory context injection
- [D] LLM response generation
- [D] Conversation logging to PostgreSQL

### Phase 5: Frontend
- [ ] React/Next.js chat widget
- [ ] Message list with markdown rendering
- [ ] Streaming response display
- [ ] Session management
- [ ] Mobile responsive design

### Phase 6: Admin & Polish
- [ ] Conversation history viewer
- [ ] Document management UI
- [ ] Usage analytics
- [ ] Rate limiting
- [ ] Error handling & logging

---

## Key Design Decisions

### Why Mem0 over MemoRAG?
- Lighter weight, no dedicated memory model required
- Built-in multi-level memory (user/session/agent)
- Native support for Gemini, OpenAI, Claude
- Hybrid storage architecture matches our Docker setup
- Production-proven (Netflix, Lemonade)

### Why Qdrant for Vector Store?
- Lightweight, fast, purpose-built for embeddings
- Easy Docker deployment
- Native filtering and payload support
- Mem0 has first-class Qdrant integration

### Why Redis?
- Session storage for active conversations
- Cache for frequently accessed data
- Fast retrieval for real-time chat

### LLM Router Strategy
- Default: Gemini (cost-effective, fast)
- Fallback: OpenAI (reliability)
- Optional: Claude (complex reasoning)
- Configurable per-request or globally

---

## Document Management Architecture (Scalable)

### Current Implementation: Shared Knowledge Base
- All users see the same uploaded documents
- Users can **view** documents (read-only)
- Only **admin** can upload new documents
- No user-specific document permissions

### Future-Ready: Multi-Tenant Architecture
The database schema and API are designed to easily enable:
- Per-user document uploads
- User-specific document visibility
- Full CRUD operations
- Document sharing between users

### Database Schema (PostgreSQL)

```sql
-- Documents table (scalable for future multi-tenancy)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- File metadata
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- pdf, txt, md, docx
    file_size_bytes BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,  -- SHA-256 for deduplication

    -- Storage location
    storage_path VARCHAR(512) NOT NULL,  -- Local path or S3 URL
    storage_type VARCHAR(20) DEFAULT 'local',  -- local, s3, gcs

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, ready, failed
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,

    -- Ownership (for future multi-tenancy)
    owner_id UUID,  -- NULL = shared/global document
    visibility VARCHAR(20) DEFAULT 'global',  -- global, private, shared

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,

    -- Soft delete (for future CRUD)
    deleted_at TIMESTAMP,

    CONSTRAINT unique_file_hash UNIQUE (file_hash, owner_id)
);

-- Document chunks (for RAG retrieval tracking)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,

    -- Vector store reference
    vector_id VARCHAR(255),  -- Qdrant point ID

    -- Metadata for retrieval
    start_char INTEGER,
    end_char INTEGER,
    page_number INTEGER,  -- For PDFs

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document access (for future sharing)
CREATE TABLE document_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,  -- Fingerprint-based user_id

    permission VARCHAR(20) DEFAULT 'read',  -- read, write, admin
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID,

    CONSTRAINT unique_doc_user UNIQUE (document_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_visibility ON documents(visibility);
CREATE INDEX idx_documents_deleted ON documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_access_user ON document_access(user_id);
```

### Pydantic Models

```python
# models/document.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid

class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

class DocumentVisibility(str, Enum):
    GLOBAL = "global"      # All users can see
    PRIVATE = "private"    # Only owner can see
    SHARED = "shared"      # Specific users can see

class DocumentBase(BaseModel):
    filename: str
    file_type: str

class DocumentCreate(DocumentBase):
    """For upload requests"""
    pass

class DocumentResponse(DocumentBase):
    """API response"""
    id: uuid.UUID
    original_filename: str
    file_size_bytes: int
    status: DocumentStatus
    chunks_count: int
    visibility: DocumentVisibility
    created_at: datetime
    processed_at: Optional[datetime]

    # Only include if user has permission (future)
    can_edit: bool = False
    can_delete: bool = False

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int

class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: DocumentStatus
    message: str

# For future CRUD operations
class DocumentUpdate(BaseModel):
    filename: Optional[str]
    visibility: Optional[DocumentVisibility]

class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str
    page_number: Optional[int]
```

### Document Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT UPLOAD FLOW                          │
│                                                                  │
│  1. User uploads file via POST /api/documents/upload             │
│                              │                                   │
│  2. Validate file            │                                   │
│     - Check file type (PDF, TXT, MD, DOCX)                      │
│     - Check file size (max 10MB)                                │
│     - Compute SHA-256 hash                                      │
│                              │                                   │
│  3. Check for duplicates     │                                   │
│     - Query by file_hash                                        │
│     - If exists: return existing document                       │
│                              │                                   │
│  4. Save file to storage     │                                   │
│     - Local: /data/documents/{uuid}.{ext}                       │
│     - S3 (future): s3://bucket/documents/{uuid}.{ext}          │
│                              │                                   │
│  5. Create DB record         │                                   │
│     - status = "pending"                                        │
│     - owner_id = NULL (global) or user_id (future)             │
│                              │                                   │
│  6. Queue processing job     │                                   │
│     - Return immediately with document_id                       │
│     - Background worker processes                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKGROUND PROCESSING                            │
│                                                                  │
│  1. Extract text from file                                       │
│     - PDF: PyMuPDF / pdfplumber                                 │
│     - DOCX: python-docx                                         │
│     - TXT/MD: direct read                                       │
│                              │                                   │
│  2. Chunk text               │                                   │
│     - Strategy: semantic (LangChain RecursiveCharacterTextSplitter)
│     - Chunk size: 1000 tokens (~4000 chars)                     │
│     - Overlap: 200 tokens (~800 chars)                          │
│     - Separators: ["\n\n", "\n", ". ", " ", ""]                 │
│                              │                                   │
│  3. Generate embeddings      │                                   │
│     - Batch process chunks via async HTTP API                   │
│     - Default: Ollama nomic-embed-text (768 dims, 8k context)   │
│     - Alternatives: OpenAI / Gemini (configurable)              │
│     - Warmup on startup for Ollama to eliminate cold start      │
│                              │                                   │
│  4. Store in Qdrant          │                                   │
│     - Collection: "documents" (or per-user future)              │
│     - Payload: document_id, chunk_index, metadata               │
│                              │                                   │
│  5. Update DB                │                                   │
│     - status = "ready"                                          │
│     - chunks_count = N                                          │
│     - processed_at = now()                                      │
└─────────────────────────────────────────────────────────────────┘
```

### API Implementation

```python
# api/documents.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List
import hashlib

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Current: Shared documents (no auth required for viewing)
@router.get("", response_model=DocumentListResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db)
):
    """List all documents (global visibility only for now)"""
    query = select(Document).where(
        Document.visibility == DocumentVisibility.GLOBAL,
        Document.deleted_at.is_(None),
        Document.status == DocumentStatus.READY
    ).order_by(Document.created_at.desc())

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentResponse.from_orm(d) for d in documents],
        total=len(documents)
    )

# Admin only: Upload new document
@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    admin_key: str = Depends(verify_admin_key),  # Simple API key auth
    db: AsyncSession = Depends(get_db)
):
    """Upload a new document (admin only)"""

    # Validate file type
    allowed_types = {"pdf", "txt", "md", "docx"}
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(400, f"File type not allowed: {file_ext}")

    # Validate file size (10MB max)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")

    # Compute hash for deduplication
    file_hash = hashlib.sha256(content).hexdigest()

    # Check for duplicate
    existing = await db.execute(
        select(Document).where(Document.file_hash == file_hash)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Document already exists")

    # Save file
    doc_id = uuid.uuid4()
    storage_path = f"/data/documents/{doc_id}.{file_ext}"
    async with aiofiles.open(storage_path, "wb") as f:
        await f.write(content)

    # Create DB record
    document = Document(
        id=doc_id,
        filename=file.filename,
        original_filename=file.filename,
        file_type=file_ext,
        file_size_bytes=len(content),
        file_hash=file_hash,
        storage_path=storage_path,
        status=DocumentStatus.PENDING,
        visibility=DocumentVisibility.GLOBAL,
        owner_id=None  # Global document
    )
    db.add(document)
    await db.commit()

    # Queue background processing
    await process_document.delay(str(doc_id))

    return DocumentUploadResponse(
        id=doc_id,
        filename=file.filename,
        status=DocumentStatus.PENDING,
        message="Document uploaded, processing in background"
    )


# ============================================
# FUTURE CRUD ENDPOINTS (currently disabled)
# ============================================

# @router.put("/{document_id}", response_model=DocumentResponse)
# async def update_document(
#     document_id: uuid.UUID,
#     update: DocumentUpdate,
#     user_id: str = Depends(get_user_from_fingerprint),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Update document metadata (owner only)"""
#     document = await get_document_or_404(document_id, db)
#
#     # Check permission
#     if document.owner_id != user_id:
#         raise HTTPException(403, "Not authorized")
#
#     # Update fields
#     if update.filename:
#         document.filename = update.filename
#     if update.visibility:
#         document.visibility = update.visibility
#
#     document.updated_at = datetime.utcnow()
#     await db.commit()
#
#     return DocumentResponse.from_orm(document)


# @router.delete("/{document_id}")
# async def delete_document(
#     document_id: uuid.UUID,
#     user_id: str = Depends(get_user_from_fingerprint),
#     db: AsyncSession = Depends(get_db)
# ):
#     """Soft delete document (owner only)"""
#     document = await get_document_or_404(document_id, db)
#
#     # Check permission
#     if document.owner_id != user_id:
#         raise HTTPException(403, "Not authorized")
#
#     # Soft delete
#     document.deleted_at = datetime.utcnow()
#     await db.commit()
#
#     # Remove from Qdrant (background task)
#     await remove_document_vectors.delay(str(document_id))
#
#     return {"message": "Document deleted"}
```

### Frontend: Documents Page

```tsx
// pages/DocumentsPage.tsx
import { useDocuments } from '../hooks/useDocuments';
import { DocumentList } from '../components/documents/DocumentList';

export function DocumentsPage() {
  const { documents, isLoading, error } = useDocuments();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Knowledge Base</h1>

      <p className="text-gray-600 mb-4">
        These documents are used by our AI assistant to answer your questions.
      </p>

      {isLoading && <div>Loading documents...</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}

      {documents && (
        <DocumentList
          documents={documents}
          readOnly={true}  // No CRUD for regular users
        />
      )}
    </div>
  );
}
```

```tsx
// components/documents/DocumentCard.tsx
import { Document } from '../../types/document';
import { formatBytes, formatDate } from '../../utils/format';

interface DocumentCardProps {
  document: Document;
  readOnly?: boolean;
  onEdit?: () => void;    // Future: enable editing
  onDelete?: () => void;  // Future: enable deletion
}

export function DocumentCard({
  document,
  readOnly = true,
  onEdit,
  onDelete
}: DocumentCardProps) {
  const fileIcon = getFileIcon(document.file_type);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{fileIcon}</div>

        <div className="flex-1">
          <h3 className="font-medium">{document.filename}</h3>

          <div className="text-sm text-gray-500 mt-1">
            <span>{formatBytes(document.file_size_bytes)}</span>
            <span className="mx-2">•</span>
            <span>{document.chunks_count} chunks</span>
            <span className="mx-2">•</span>
            <span>Uploaded {formatDate(document.created_at)}</span>
          </div>

          <div className="mt-2">
            <span className={`
              inline-block px-2 py-1 text-xs rounded
              ${document.status === 'ready'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'}
            `}>
              {document.status}
            </span>
          </div>
        </div>

        {/* Future: CRUD buttons (hidden when readOnly) */}
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="text-blue-500 hover:text-blue-700">
              Edit
            </button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-700">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getFileIcon(fileType: string): string {
  const icons: Record<string, string> = {
    pdf: '📄',
    txt: '📝',
    md: '📋',
    docx: '📃',
  };
  return icons[fileType] || '📁';
}
```

### Qdrant Collection Schema

```python
# Scalable collection design for future multi-tenancy
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PayloadSchemaType

def setup_qdrant_collection(client: QdrantClient):
    """Create document collection with filterable payload"""

    client.create_collection(
        collection_name="documents",
        vectors_config=VectorParams(
            size=768,  # text-embedding-004 dimension
            distance=Distance.COSINE
        )
    )

    # Create payload indexes for efficient filtering
    client.create_payload_index(
        collection_name="documents",
        field_name="document_id",
        field_schema=PayloadSchemaType.UUID
    )

    # For future multi-tenancy filtering
    client.create_payload_index(
        collection_name="documents",
        field_name="owner_id",
        field_schema=PayloadSchemaType.UUID
    )

    client.create_payload_index(
        collection_name="documents",
        field_name="visibility",
        field_schema=PayloadSchemaType.KEYWORD
    )


# RAG retrieval with visibility filter
async def search_documents(
    query_vector: List[float],
    user_id: Optional[str] = None,  # For future per-user filtering
    limit: int = 5
) -> List[dict]:
    """Search documents respecting visibility rules"""

    # Current: only global documents
    filter_condition = {
        "must": [
            {"key": "visibility", "match": {"value": "global"}}
        ]
    }

    # Future: include user's private docs
    # if user_id:
    #     filter_condition = {
    #         "should": [
    #             {"key": "visibility", "match": {"value": "global"}},
    #             {"key": "owner_id", "match": {"value": user_id}}
    #         ]
    #     }

    results = qdrant_client.search(
        collection_name="documents",
        query_vector=query_vector,
        query_filter=filter_condition,
        limit=limit
    )

    return results
```

### Migration Path: Enabling User CRUD

When ready to enable per-user document management:

1. **Enable fingerprint-based user identification**
   ```python
   user_id = rate_limiter.generate_user_id(fingerprint, request)
   ```

2. **Update upload endpoint**
   ```python
   # Change owner_id from None to user_id
   document = Document(
       ...
       owner_id=user_id,  # Now linked to user
       visibility=DocumentVisibility.PRIVATE  # Default to private
   )
   ```

3. **Uncomment CRUD endpoints in api/documents.py**

4. **Update frontend**
   ```tsx
   // Change readOnly to check ownership
   <DocumentCard
     document={doc}
     readOnly={doc.owner_id !== currentUserId}
     onEdit={() => handleEdit(doc.id)}
     onDelete={() => handleDelete(doc.id)}
   />
   ```

5. **Update Qdrant filter**
   ```python
   # Include user's private documents in search
   filter_condition["should"].append(
       {"key": "owner_id", "match": {"value": user_id}}
   )
   ```

---

## Security: Rate Limiting & Anonymous User Identification

### Problem
- No sign-up/sign-in required
- Need to prevent API abuse and overbilling
- Must fairly rate-limit each unique user
- Users may try to circumvent limits (incognito, VPN, etc.)

### Solution: Multi-Signal Device Fingerprinting

Generate a unique `user_id` by hashing multiple browser/device signals. No single signal is reliable alone, but combined they create a robust identifier.

### Fingerprint Signals

#### Frontend (Browser) Signals
| Signal | Description | Evasion Difficulty |
|--------|-------------|-------------------|
| Canvas fingerprint | Renders hidden canvas, hashes pixel data | Hard |
| WebGL fingerprint | GPU renderer info + hash | Hard |
| Audio fingerprint | AudioContext oscillator hash | Hard |
| Screen resolution | `screen.width`, `screen.height`, `devicePixelRatio` | Easy |
| Timezone | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Medium |
| Language | `navigator.language`, `navigator.languages` | Easy |
| User Agent | `navigator.userAgent` | Easy |
| Platform | `navigator.platform` | Easy |
| Hardware concurrency | `navigator.hardwareConcurrency` (CPU cores) | Medium |
| Device memory | `navigator.deviceMemory` (GB RAM) | Medium |
| Touch support | `navigator.maxTouchPoints` | Medium |
| Color depth | `screen.colorDepth` | Easy |
| Installed plugins | `navigator.plugins` (limited in modern browsers) | N/A |

#### Backend (Server) Signals
| Signal | Description | Evasion Difficulty |
|--------|-------------|-------------------|
| IP Address | Client IP (with X-Forwarded-For handling) | Medium (VPN) |
| TLS Fingerprint (JA3) | SSL/TLS handshake hash | Hard |
| Accept-Language | HTTP header | Easy |
| Accept-Encoding | HTTP header | Easy |

### Fingerprint Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                                                                  │
│  1. On page load, collect browser signals:                       │
│     - Canvas hash                                                │
│     - WebGL hash                                                 │
│     - Audio hash                                                 │
│     - Screen/hardware info                                       │
│                                                                  │
│  2. Combine into fingerprint object                              │
│                                                                  │
│  3. Hash with SHA-256 → client_fingerprint                       │
│                                                                  │
│  4. Send with every /chat request                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                                                                  │
│  1. Extract server signals:                                      │
│     - IP address (handle proxies)                                │
│     - TLS fingerprint (if available)                             │
│     - HTTP headers                                               │
│                                                                  │
│  2. Combine: client_fingerprint + server_signals                 │
│                                                                  │
│  3. Hash with SHA-256 + secret salt → user_id                    │
│                                                                  │
│  4. Check rate limits in Redis                                   │
│                                                                  │
│  5. If under limit → process request                             │
│     If over limit → return 429 Too Many Requests                 │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Fingerprint Implementation

```typescript
// services/fingerprint.ts
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface BrowserFingerprint {
  visitorId: string;        // FingerprintJS visitor ID
  canvas: string;           // Canvas hash
  webgl: string;            // WebGL renderer info
  audio: string;            // Audio fingerprint
  screen: string;           // Screen info hash
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number | undefined;
  touchPoints: number;
}

export async function generateFingerprint(): Promise<string> {
  // Use FingerprintJS for robust fingerprinting
  const fp = await FingerprintJS.load();
  const result = await fp.get();

  // Collect additional signals
  const signals: BrowserFingerprint = {
    visitorId: result.visitorId,
    canvas: await getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    audio: await getAudioFingerprint(),
    screen: `${screen.width}x${screen.height}x${window.devicePixelRatio}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    touchPoints: navigator.maxTouchPoints,
  };

  // Hash all signals
  const signalString = JSON.stringify(signals);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signalString));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCanvasFingerprint(): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw unique pattern
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('fingerprint', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('fingerprint', 4, 17);

  return canvas.toDataURL();
}

function getWebGLFingerprint(): string {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return '';

  const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return '';

  const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return `${vendor}~${renderer}`;
}

async function getAudioFingerprint(): Promise<string> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    gain.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.connect(analyser);
    analyser.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(0);

    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    oscillator.stop();
    audioContext.close();

    return data.slice(0, 30).join(',');
  } catch {
    return '';
  }
}
```

### Backend Rate Limiting Implementation

```python
# services/rate_limiter.py
import hashlib
import redis
from fastapi import Request, HTTPException
from datetime import datetime
from typing import Optional

class RateLimiter:
    def __init__(self, redis_client: redis.Redis, secret_salt: str):
        self.redis = redis_client
        self.salt = secret_salt

        # Rate limit tiers
        self.limits = {
            "per_minute": 10,      # Max 10 requests per minute
            "per_hour": 100,       # Max 100 requests per hour
            "per_day": 500,        # Max 500 requests per day
        }

    def generate_user_id(
        self,
        client_fingerprint: str,
        request: Request
    ) -> str:
        """Generate unique user_id from fingerprint + server signals"""

        # Extract server-side signals
        ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        accept_lang = request.headers.get("accept-language", "")

        # Combine all signals
        combined = f"{client_fingerprint}|{ip}|{user_agent}|{accept_lang}|{self.salt}"

        # Hash to create user_id
        user_id = hashlib.sha256(combined.encode()).hexdigest()[:32]
        return user_id

    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP, handling proxies"""
        # Check common proxy headers
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    async def check_rate_limit(self, user_id: str) -> dict:
        """Check if user is within rate limits"""
        now = datetime.utcnow()

        results = {
            "allowed": True,
            "user_id": user_id,
            "limits": {}
        }

        # Check each time window
        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        for limit_name, window_seconds in windows:
            key = f"ratelimit:{user_id}:{limit_name}"
            current = self.redis.get(key)
            current_count = int(current) if current else 0
            max_allowed = self.limits[limit_name]

            results["limits"][limit_name] = {
                "current": current_count,
                "max": max_allowed,
                "remaining": max(0, max_allowed - current_count)
            }

            if current_count >= max_allowed:
                results["allowed"] = False
                results["retry_after"] = self.redis.ttl(key)

        return results

    async def increment(self, user_id: str):
        """Increment rate limit counters"""
        windows = [
            ("per_minute", 60),
            ("per_hour", 3600),
            ("per_day", 86400),
        ]

        pipe = self.redis.pipeline()
        for limit_name, window_seconds in windows:
            key = f"ratelimit:{user_id}:{limit_name}"
            pipe.incr(key)
            pipe.expire(key, window_seconds)
        pipe.execute()


# FastAPI dependency
async def rate_limit_dependency(
    request: Request,
    fingerprint: str,  # From request body/header
    rate_limiter: RateLimiter
):
    user_id = rate_limiter.generate_user_id(fingerprint, request)
    result = await rate_limiter.check_rate_limit(user_id)

    if not result["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "retry_after": result.get("retry_after", 60),
                "limits": result["limits"]
            },
            headers={"Retry-After": str(result.get("retry_after", 60))}
        )

    # Increment counters
    await rate_limiter.increment(user_id)

    return user_id
```

### Updated API Request Schema

```python
# models/chat.py
from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    session_id: str
    fingerprint: str  # Required: client-side fingerprint hash

class ChatResponse(BaseModel):
    response: str
    sources: list[str]
    session_id: str
    rate_limit: dict  # Include remaining limits in response
```

### Rate Limit Response Headers

Every response includes rate limit info:
```
X-RateLimit-Limit-Minute: 10
X-RateLimit-Remaining-Minute: 7
X-RateLimit-Limit-Hour: 100
X-RateLimit-Remaining-Hour: 95
X-RateLimit-Limit-Day: 500
X-RateLimit-Remaining-Day: 498
```

### Anti-Circumvention Strategies

| Attack Vector | Mitigation |
|--------------|------------|
| Incognito mode | Canvas/WebGL/Audio fingerprints persist |
| Clear cookies | Fingerprint is cookie-independent |
| VPN/Proxy | Fingerprint still identifies device |
| User Agent spoofing | Other signals compensate |
| Multiple browsers | Different fingerprints = different limits (acceptable) |
| Bot/automation | Add CAPTCHA after suspicious patterns |
| Fingerprint replay | Server-side signals (IP) must also match |

### Suspicious Activity Detection

```python
# services/abuse_detector.py

class AbuseDetector:
    """Detect suspicious patterns beyond simple rate limiting"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def check_suspicious(self, user_id: str, request: Request) -> bool:
        """Returns True if activity is suspicious"""

        checks = [
            self._check_burst_pattern(user_id),
            self._check_fingerprint_ip_mismatch(user_id, request),
            self._check_known_datacenter_ip(request),
        ]

        return any(await asyncio.gather(*checks))

    async def _check_burst_pattern(self, user_id: str) -> bool:
        """Detect rapid-fire requests (bot behavior)"""
        key = f"burst:{user_id}"
        timestamps = self.redis.lrange(key, 0, 9)

        if len(timestamps) >= 5:
            # 5+ requests in under 2 seconds = suspicious
            oldest = float(timestamps[-1])
            newest = float(timestamps[0])
            if newest - oldest < 2.0:
                return True
        return False

    async def _check_fingerprint_ip_mismatch(
        self, user_id: str, request: Request
    ) -> bool:
        """Same fingerprint from many different IPs = suspicious"""
        # Implementation: track IP history per fingerprint
        pass

    async def _check_known_datacenter_ip(self, request: Request) -> bool:
        """Block known datacenter/hosting IPs (likely bots)"""
        # Use IP reputation database
        pass
```

### Cost Protection: Hard Limits

```python
# config.py

class CostProtection:
    # Daily spending cap (USD)
    DAILY_BUDGET_USD = 50.0

    # Estimated cost per request (adjust based on your LLM pricing)
    ESTIMATED_COST_PER_REQUEST = 0.002  # ~$0.002 per chat

    # Max requests before hitting budget
    MAX_DAILY_REQUESTS = int(DAILY_BUDGET_USD / ESTIMATED_COST_PER_REQUEST)

    # Emergency shutoff
    ENABLE_EMERGENCY_SHUTOFF = True
```

### Updated Project Structure

```
backend/
├── app/
│   ├── services/
│   │   ├── fingerprint.py     # Server-side fingerprint handling
│   │   ├── rate_limiter.py    # Rate limiting logic
│   │   ├── abuse_detector.py  # Suspicious activity detection
│   │   └── ...
│   │
│   ├── middleware/
│   │   └── rate_limit.py      # FastAPI middleware
│   │
│   └── ...

frontend/
├── src/
│   ├── services/
│   │   ├── fingerprint.ts     # Browser fingerprint collection
│   │   └── ...
```

### Environment Variables (Updated)

```bash
# Rate Limiting
RATE_LIMIT_SALT=your_random_secret_salt_here
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100
RATE_LIMIT_PER_DAY=500

# Cost Protection
DAILY_BUDGET_USD=50
ENABLE_EMERGENCY_SHUTOFF=true
```

### Recommended: FingerprintJS

For production, use [FingerprintJS](https://fingerprint.com/) (open-source version):

```bash
npm install @fingerprintjs/fingerprintjs
```

Benefits:
- Handles edge cases across browsers
- 99.5% accuracy for returning visitors
- MIT licensed (free tier available)
- Actively maintained

---

## Sources

- [Mem0 GitHub](https://github.com/mem0ai/mem0)
- [Mem0 Documentation](https://docs.mem0.ai/)
- [Mem0 Google AI Integration](https://docs.mem0.ai/components/llms/models/google_AI)
- [Mem0 Gemini Configuration](https://docs.mem0.ai/components/llms/models/gemini)
- [MemoRAG GitHub](https://github.com/qhjqhj00/MemoRAG)
- [Best RAG Frameworks 2025](https://www.firecrawl.dev/blog/best-open-source-rag-frameworks)
