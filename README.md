# Customer Support Chat with RAG + Memory

A web app that simulates customer support chat where an AI agent answers user questions using RAG (Retrieval Augmented Generation) with persistent memory, backed by company documents.

## Features

- Real-time chat with streaming responses via WebSocket
- RAG-powered answers from uploaded company documents
- Persistent user memory across sessions (Mem0)
- Multiple LLM provider support (Ollama, Gemini, OpenAI, Anthropic)
- Document upload and management (PDF, DOCX, MD, TXT)
- Rate limiting with fingerprint-based user identification
- Fully containerized with Docker

## Architecture

```
Frontend (Next.js)  -->  Backend (FastAPI)  -->  LLM Router
                              |
                    +---------+---------+
                    |         |         |
                  Redis    Qdrant   PostgreSQL
                 (cache)  (vectors)   (data)
                              |
                           Ollama
                        (embeddings)
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM for Ollama

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd rag_chatbot
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start all services:
```bash
docker-compose up -d
```

4. Access the app:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

First startup takes a few minutes as Ollama downloads the embedding model.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | Python 3.11+, FastAPI |
| LLM | Ollama (default), Gemini, OpenAI, Anthropic |
| Embeddings | nomic-embed-text (Ollama) |
| Vector DB | Qdrant |
| Database | PostgreSQL |
| Cache | Redis |
| Memory | Mem0 |

## Project Structure

```
rag_chatbot/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── models/        # Pydantic models
│   │   └── db/            # Database connections
│   ├── ollama/            # Ollama Dockerfile
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Next.js pages
│   │   ├── hooks/         # Custom hooks
│   │   └── services/      # API clients
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── plan.md               # Detailed implementation plan
```

## API Endpoints

### Chat
- `WebSocket /api/chat/ws` - Real-time chat with streaming
- `POST /api/chat` - Non-streaming chat fallback
- `GET /api/chat/history/{session_id}` - Get chat history

### Documents
- `GET /api/documents` - List all documents
- `POST /api/documents/upload` - Upload document (admin only)

### Admin
- `GET /api/conversations` - List all conversations
- `GET /api/analytics/usage` - Usage statistics

## Configuration

Key environment variables (see `.env.example` for full list):

```bash
# LLM Provider
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_MODEL_NAME=llama3.2

# Embeddings
DEFAULT_EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Security
ADMIN_API_KEY=your-admin-key
RATE_LIMIT_SALT=random-string
```

## Development

### Backend only
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend only
```bash
cd frontend
npm install
npm run dev
```

## License

MIT
