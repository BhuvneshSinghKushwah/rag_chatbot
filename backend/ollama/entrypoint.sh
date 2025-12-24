#!/bin/bash

ollama serve &

echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done

echo "Pulling nomic-embed-text model..."
ollama pull nomic-embed-text

echo "Ollama ready with nomic-embed-text"

wait
