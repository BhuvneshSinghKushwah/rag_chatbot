'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConversationSummary } from '@/types/chat';
import { chatApi } from '@/services/api';
import { useFingerprint } from './useFingerprint';
import { CONVERSATIONS_UPDATED_EVENT } from './useChat';

export function useConversations() {
  const { fingerprint } = useFingerprint();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const lastFetchRef = useRef<number>(0);

  const fetchConversations = useCallback(async (force = false) => {
    if (!fingerprint) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < 500) {
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatApi.getConversations(fingerprint);
      if (fetchId === fetchIdRef.current) {
        const uniqueConversations = response.conversations.filter(
          (conv, index, self) =>
            index === self.findIndex((c) => c.session_id === conv.session_id)
        );
        setConversations(uniqueConversations);
        lastFetchRef.current = Date.now();
      }
    } catch (err) {
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [fingerprint]);

  useEffect(() => {
    if (fingerprint) {
      fetchConversations(true);
    }
  }, [fingerprint, fetchConversations]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchConversations(true);
    };

    window.addEventListener(CONVERSATIONS_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(CONVERSATIONS_UPDATED_EVENT, handleUpdate);
    };
  }, [fetchConversations]);

  const refetch = useCallback(() => {
    return fetchConversations(true);
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    refetch,
  };
}
