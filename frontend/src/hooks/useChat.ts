'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, WebSocketMessage, ChatHistoryMessage, ChatError } from '@/types/chat';
import { chatApi } from '@/services/api';
import { useFingerprint } from './useFingerprint';
import { useSession } from './useSession';

export const CONVERSATIONS_UPDATED_EVENT = 'conversations-updated';

const MESSAGES_CACHE_KEY = 'chat_messages_cache';

function getCachedMessages(sessionId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(`${MESSAGES_CACHE_KEY}_${sessionId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.map((msg: ChatMessage) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
    }
  } catch {}
  return [];
}

function setCachedMessages(sessionId: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const toCache = messages.filter(m => !m.isStreaming);
    localStorage.setItem(`${MESSAGES_CACHE_KEY}_${sessionId}`, JSON.stringify(toCache));
  } catch {}
}

export function useChat() {
  const { fingerprint } = useFingerprint();
  const { sessionId, isInitialized } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const currentSessionRef = useRef<string | null>(null);
  const switchIdRef = useRef(0);
  const maxReconnectAttempts = 5;

  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  const fetchHistory = useCallback(async (sid: string, fp: string, switchId: number) => {
    setIsLoadingHistory(true);
    try {
      const response = await chatApi.getHistory(sid, fp);
      if (switchIdRef.current === switchId) {
        const loadedMessages = response.messages.map((msg: ChatHistoryMessage) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          createdAt: new Date(msg.created_at),
        }));
        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
          setCachedMessages(sid, loadedMessages);
        }
      }
    } catch {
    } finally {
      if (switchIdRef.current === switchId) {
        setIsLoadingHistory(false);
      }
    }
  }, []);

  const connectWebSocket = useCallback(async (sid: string, fp: string) => {
    if (isConnectingRef.current ||
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (currentSessionRef.current !== sid) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const ws = await chatApi.createWebSocket(sid, fp);

      if (currentSessionRef.current !== sid) {
        ws.close();
        isConnectingRef.current = false;
        return;
      }

      ws.onopen = () => {
        if (currentSessionRef.current === sid) {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        } else {
          ws.close();
        }
      };

      ws.onclose = () => {
        if (currentSessionRef.current === sid) {
          setIsConnected(false);
          wsRef.current = null;
          isConnectingRef.current = false;

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;
            setTimeout(() => {
              if (currentSessionRef.current === sid) {
                connectWebSocket(sid, fp);
              }
            }, delay);
          }
        }
      };

      ws.onerror = () => {
        if (currentSessionRef.current === sid) {
          setError({ message: 'Connection error. Retrying...', isRetryable: true });
        }
      };

      ws.onmessage = (event) => {
        if (currentSessionRef.current !== sid) return;

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
                const updated = [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    isStreaming: false,
                  },
                ];
                if (currentSessionRef.current) {
                  setCachedMessages(currentSessionRef.current, updated);
                }
                return updated;
              }
              return prev;
            });
            streamingMessageRef.current = '';
            setIsLoading(false);
            window.dispatchEvent(new CustomEvent(CONVERSATIONS_UPDATED_EVENT));
          } else if (data.type === 'error' || data.type === 'rate_limited' || data.type === 'llm_error') {
            const chatError: ChatError = {
              message: data.message || 'An error occurred',
              errorType: data.error_type,
              retryAfter: data.retry_after,
              isRetryable: data.is_retryable ?? (data.type === 'rate_limited'),
            };
            setError(chatError);
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
          setError({ message: 'Failed to parse server response', isRetryable: false });
        }
      };

      wsRef.current = ws;
      isConnectingRef.current = false;
    } catch {
      isConnectingRef.current = false;
      if (currentSessionRef.current === sid) {
        setError({ message: 'Failed to connect to chat server', isRetryable: true });
      }
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !sessionId || !fingerprint) return;

    const currentSwitchId = ++switchIdRef.current;
    currentSessionRef.current = sessionId;

    const cached = getCachedMessages(sessionId);
    setMessages(cached);
    setError(null);
    setIsLoading(false);
    streamingMessageRef.current = '';

    cleanupWebSocket();
    reconnectAttemptsRef.current = 0;

    fetchHistory(sessionId, fingerprint, currentSwitchId);
    connectWebSocket(sessionId, fingerprint);

    return () => {
      cleanupWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, fingerprint, isInitialized]);


  const sendMessage = useCallback(
    (content: string, modelId?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError({ message: 'Not connected to chat server', isRetryable: true });
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

      setMessages((prev) => {
        const updated = [...prev, userMessage, assistantMessage];
        if (currentSessionRef.current) {
          setCachedMessages(currentSessionRef.current, updated);
        }
        return updated;
      });

      const payload: { type: string; content: string; model_id?: string } = { type: 'message', content };
      if (modelId) {
        payload.model_id = modelId;
      }
      wsRef.current.send(JSON.stringify(payload));
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
