'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConversationSummary } from '@/types/chat';
import { chatApi } from '@/services/api';
import { useFingerprint } from './useFingerprint';
import { CONVERSATIONS_UPDATED_EVENT } from './useChat';

export function useConversations() {
  const { fingerprint } = useFingerprint();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!fingerprint) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await chatApi.getConversations(fingerprint);
      setConversations(response.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [fingerprint]);

  useEffect(() => {
    if (fingerprint) {
      fetchConversations();
    }
  }, [fingerprint, fetchConversations]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchConversations();
    };

    window.addEventListener(CONVERSATIONS_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(CONVERSATIONS_UPDATED_EVENT, handleUpdate);
    };
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
  };
}
