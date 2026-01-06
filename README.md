# RAG Chatbot

A production-ready customer support chatbot powered by RAG (Retrieval Augmented Generation) with persistent memory. Upload your company documents and let AI answer questions with context-aware, accurate responses.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Real-time Streaming** - WebSocket-powered chat with token-by-token streaming
- **RAG Pipeline** - Answers grounded in your uploaded documents (PDF, DOCX, MD, TXT)
- **Web Search Fallback** - Automatically searches the web via SearXNG when documents lack relevant content
- **Persistent Memory** - Remembers user context across sessions using Mem0
- **Multi-LLM Support** - Switch between Gemini, OpenAI, Anthropic, Groq, or Ollama
- **Local Embeddings** - Privacy-first with nomic-embed-text running locally
- **Admin Dashboard** - Manage documents, view analytics, configure providers
- **Rate Limiting** - Fingerprint-based user identification and throttling

## Architecture

```
                    +------------------+
                    |   Next.js App    |
                    |   (Frontend)     |
                    +--------+---------+
                             |
                             | WebSocket / REST
                             v
                    +--------+---------+
                    |    FastAPI       |
                    |    (Backend)     |
                    +--------+---------+
                             |
    +------------+-----------+-----------+------------+
    |            |           |           |            |
    v            v           v           v            v
+---+---+  +-----+-----+ +---+---+ +-----+-----+ +----+----+
| Redis |  |   Qdrant  | |SearXNG| | PostgreSQL| |  LLM    |
|(Cache)|  | (Vectors) | | (Web) | |  (Data)   | |Provider |
+-------+  +-----------+ +-------+ +-----------+ +---------+
```

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/BhuvneshSinghKushwah/rag_chatbot.git
cd rag_chatbot

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| SearXNG | http://localhost:8080 |

### Configure LLM

1. Go to Admin Panel > Settings
2. Add your LLM provider credentials
3. Add models and set a default

> First startup downloads the embedding model (~250MB) which runs locally.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, WebSockets |
| LLM Providers | Gemini, OpenAI, Anthropic, Groq, Ollama |
| Embeddings | nomic-embed-text-v1.5 (local) |
| Vector Store | Qdrant |
| Web Search | SearXNG (self-hosted metasearch) |
| Database | PostgreSQL |
| Cache | Redis |
| Memory | Mem0 |
| Deployment | Docker, Docker Compose |

## Project Structure

```
rag_chatbot/
├── backend/
│   ├── app/
│   │   ├── api/           # REST & WebSocket endpoints
│   │   ├── services/      # RAG, LLM, Memory services
│   │   ├── models/        # Pydantic schemas
│   │   └── db/            # Database connections
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Next.js pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API clients
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## API Reference

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| WebSocket | `/api/chat/ws` | Real-time streaming chat |
| POST | `/api/chat` | Non-streaming fallback |
| GET | `/api/chat/history/{session_id}` | Retrieve chat history |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List all documents |
| POST | `/api/documents/upload` | Upload document (admin) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations |
| GET | `/api/analytics/usage` | Usage statistics |

## Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Configuration

LLM providers and API keys are managed through the Admin Panel at runtime - no redeployment needed.

See `.env.example` for infrastructure settings.

### Web Search

The chatbot automatically falls back to web search when uploaded documents don't contain relevant answers. This uses SearXNG, a privacy-respecting metasearch engine that aggregates results from Google, Bing, DuckDuckGo, and more.

| Setting | Default | Description |
|---------|---------|-------------|
| `WEB_SEARCH_ENABLED` | `true` | Enable/disable web search fallback |
| `RAG_RELEVANCE_THRESHOLD` | `0.65` | Minimum RAG score to use documents (0-1) |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Number of web results to fetch |

**How it works:**
1. User sends a question
2. RAG and web search run in parallel
3. If RAG score >= threshold, use document results
4. If RAG score < threshold, use web search results
5. LLM generates response from the selected context

## License

MIT

---

### Connect

[![GitHub](https://img.shields.io/badge/GitHub-BhuvneshSinghKushwah-181717?logo=github&logoColor=white)](https://github.com/BhuvneshSinghKushwah)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Bhuvnesh_Singh_Kushwah-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/bhuvnesh-singh-kushwah/)
