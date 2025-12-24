'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, DocumentListResponse } from '@/types/document';
import { documentsApi } from '@/services/api';

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response: DocumentListResponse = await documentsApi.list();
      setDocuments(response.documents);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    total,
    isLoading,
    error,
    refetch: fetchDocuments,
  };
}
