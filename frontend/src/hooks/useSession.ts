'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateSessionId } from '@/lib/utils';

const SESSION_KEY = 'chat_session_id';
const SESSION_CHANGE_EVENT = 'session-change';

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = generateSessionId();
      localStorage.setItem(SESSION_KEY, id);
    }
    setSessionId(id);

    const handleSessionChange = (event: CustomEvent<string>) => {
      setSessionId(event.detail);
    };

    window.addEventListener(SESSION_CHANGE_EVENT, handleSessionChange as EventListener);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, handleSessionChange as EventListener);
    };
  }, []);

  const resetSession = useCallback(() => {
    const newId = generateSessionId();
    localStorage.setItem(SESSION_KEY, newId);
    setSessionId(newId);
    window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT, { detail: newId }));
    return newId;
  }, []);

  const switchSession = useCallback((newSessionId: string) => {
    localStorage.setItem(SESSION_KEY, newSessionId);
    setSessionId(newSessionId);
    window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT, { detail: newSessionId }));
  }, []);

  return { sessionId, resetSession, switchSession };
}
