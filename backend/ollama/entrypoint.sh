#!/bin/bash

ollama serve &

echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done

MODEL_NAME=${OLLAMA_MODEL_NAME:-llama3.2}

echo "Pulling model: $MODEL_NAME"
ollama pull "$MODEL_NAME"

echo "Pulling embedding model: nomic-embed-text"
ollama pull nomic-embed-text

echo "Ollama ready with $MODEL_NAME and nomic-embed-text"

wait
