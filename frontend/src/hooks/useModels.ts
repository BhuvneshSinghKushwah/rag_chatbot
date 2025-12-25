'use client';

import { useState, useEffect, useCallback } from 'react';
import { AvailableModel } from '@/types/llm';
import { modelsApi } from '@/services/api';

const SELECTED_MODEL_KEY = 'selected_model_id';

export function useModels() {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await modelsApi.getAvailableModels();
      setModels(response.models);
      setDefaultModelId(response.default_model_id);

      const stored = localStorage.getItem(SELECTED_MODEL_KEY);
      if (stored && response.models.some(m => m.id === stored)) {
        setSelectedModelId(stored);
      } else if (response.default_model_id) {
        setSelectedModelId(response.default_model_id);
      } else if (response.models.length > 0) {
        setSelectedModelId(response.models[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const selectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem(SELECTED_MODEL_KEY, modelId);
  }, []);

  const selectedModel = models.find(m => m.id === selectedModelId) || null;

  return {
    models,
    selectedModel,
    selectedModelId,
    defaultModelId,
    isLoading,
    error,
    selectModel,
    refetch: fetchModels,
  };
}
