'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, WebSocketMessage, ChatHistoryMessage } from '@/types/chat';
import { chatApi } from '@/services/api';
import { useFingerprint } from './useFingerprint';
import { useSession } from './useSession';

export const CONVERSATIONS_UPDATED_EVENT = 'conversations-updated';

export function useChat() {
  const { fingerprint } = useFingerprint();
  const { sessionId } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const currentSessionRef = useRef<string | null>(null);
  const maxReconnectAttempts = 5;

  const fetchHistory = useCallback(async (sid: string, fp: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await chatApi.getHistory(sid, fp);
      if (currentSessionRef.current === sid) {
        setMessages(
          response.messages.map((msg: ChatHistoryMessage) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createdAt: new Date(msg.created_at),
          }))
        );
      }
    } catch {
      if (currentSessionRef.current === sid) {
        setMessages([]);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (!sessionId || !fingerprint) return;

    if (isConnectingRef.current ||
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const ws = await chatApi.createWebSocket(sessionId, fingerprint);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        isConnectingRef.current = false;

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          setTimeout(connectWebSocket, delay);
        }
      };

      ws.onerror = () => {
        setError('Connection error. Retrying...');
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          if (data.type === 'token' && data.content) {
            streamingMessageRef.current += data.content;
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: streamingMessageRef.current },
                ];
              }
              return prev;
            });
          } else if (data.type === 'complete') {
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    isStreaming: false,
                  },
                ];
              }
              return prev;
            });
            streamingMessageRef.current = '';
            setIsLoading(false);
            window.dispatchEvent(new CustomEvent(CONVERSATIONS_UPDATED_EVENT));
          } else if (data.type === 'error' || data.type === 'rate_limited') {
            setError(data.message || 'An error occurred');
            setIsLoading(false);
            setMessages((prev) => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage?.isStreaming) {
                return prev.slice(0, -1);
              }
              return prev;
            });
          }
        } catch {
          setError('Failed to parse server response');
        }
      };

      wsRef.current = ws;
      isConnectingRef.current = false;
    } catch {
      isConnectingRef.current = false;
      setError('Failed to connect to chat server');
    }
  }, [sessionId, fingerprint]);

  useEffect(() => {
    if (sessionId && fingerprint) {
      currentSessionRef.current = sessionId;
      setMessages([]);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      isConnectingRef.current = false;

      fetchHistory(sessionId, fingerprint);
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [sessionId, fingerprint, fetchHistory, connectWebSocket]);


  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected to chat server');
        return;
      }

      setError(null);
      setIsLoading(true);
      streamingMessageRef.current = '';

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    },
    []
  );

  return {
    messages,
    isConnected,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
  };
}
