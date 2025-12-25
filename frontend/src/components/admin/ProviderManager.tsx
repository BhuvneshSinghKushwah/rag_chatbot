'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/hooks';
import { adminApi } from '@/services/api';
import { LLMProvider, LLMProviderCreate, ProviderType } from '@/types/llm';
import { ModelManager } from './ModelManager';

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
];

export function ProviderManager() {
  const { adminKey } = useAdmin();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!adminKey) return;
    setIsLoading(true);
    try {
      const response = await adminApi.getProviders(adminKey);
      setProviders(response.providers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleAddProvider = async (data: LLMProviderCreate) => {
    if (!adminKey) return;
    try {
      await adminApi.createProvider(adminKey, data);
      setShowAddForm(false);
      fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider');
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!adminKey || !confirm('Delete this provider and all its models?')) return;
    try {
      await adminApi.deleteProvider(adminKey, providerId);
      fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  const handleSetDefault = async (providerId: string) => {
    if (!adminKey) return;
    try {
      await adminApi.setDefaultProvider(adminKey, providerId);
      fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleToggleActive = async (provider: LLMProvider) => {
    if (!adminKey) return;
    try {
      await adminApi.updateProvider(adminKey, provider.id, { is_active: !provider.is_active });
      fetchProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update provider');
    }
  };

  const handleTestProvider = async (provider: LLMProvider) => {
    if (!adminKey) return;
    setTestingProvider(provider.id);
    setTestResult(null);
    try {
      const result = await adminApi.testExistingProvider(adminKey, provider.id);
      setTestResult({ id: provider.id, success: result.success, message: result.message });
    } catch (err) {
      setTestResult({ id: provider.id, success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingProvider(null);
    }
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading providers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">LLM Providers</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <AddProviderForm onSubmit={handleAddProvider} onCancel={() => setShowAddForm(false)} />
      )}

      <div className="space-y-4">
        {providers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No providers configured. Add one to get started.
          </div>
        ) : (
          providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-medium text-white">{provider.name}</span>
                    <span className="px-2 py-0.5 text-xs bg-neutral-700 text-gray-300 rounded">
                      {provider.provider_type}
                    </span>
                    {provider.is_default && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                        Default
                      </span>
                    )}
                    {!provider.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestProvider(provider)}
                      disabled={testingProvider === provider.id}
                      className="px-3 py-1.5 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600 disabled:opacity-50"
                    >
                      {testingProvider === provider.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(provider)}
                      className="px-3 py-1.5 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                    >
                      {provider.is_active ? 'Disable' : 'Enable'}
                    </button>
                    {!provider.is_default && (
                      <button
                        onClick={() => handleSetDefault(provider.id)}
                        className="px-3 py-1.5 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
                      className="px-3 py-1.5 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                    >
                      {expandedProvider === provider.id ? 'Hide Models' : 'Show Models'}
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="px-3 py-1.5 text-xs text-red-400 bg-neutral-700 rounded hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-400">
                  {provider.has_api_key && <span>API Key configured</span>}
                  {provider.base_url && <span> | URL: {provider.base_url}</span>}
                  <span> | {provider.models.length} model(s)</span>
                </div>

                {testResult?.id === provider.id && (
                  <div className={`mt-2 p-2 text-sm rounded ${testResult.success ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                    {testResult.message}
                  </div>
                )}
              </div>

              {expandedProvider === provider.id && (
                <div className="border-t border-neutral-700 p-4 bg-neutral-900/50">
                  <ModelManager provider={provider} onUpdate={fetchProviders} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddProviderForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: LLMProviderCreate) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<LLMProviderCreate>({
    provider_type: 'gemini',
    name: '',
    api_key: '',
    base_url: '',
    is_default: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      api_key: formData.api_key || undefined,
      base_url: formData.base_url || undefined,
    });
  };

  const needsApiKey = formData.provider_type !== 'ollama';
  const needsBaseUrl = formData.provider_type === 'ollama';

  return (
    <form onSubmit={handleSubmit} className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Provider Type</label>
          <select
            value={formData.provider_type}
            onChange={(e) => setFormData({ ...formData, provider_type: e.target.value as ProviderType })}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
          >
            {PROVIDER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Production Gemini"
            required
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>
      </div>

      {needsApiKey && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
          <input
            type="password"
            value={formData.api_key || ''}
            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
            placeholder="Enter API key"
            required
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>
      )}

      {needsBaseUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Base URL</label>
          <input
            type="text"
            value={formData.base_url || ''}
            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            placeholder="http://localhost:11434"
            required
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_default"
          checked={formData.is_default}
          onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
          className="rounded border-neutral-700"
        />
        <label htmlFor="is_default" className="text-sm text-gray-300">Set as default provider</label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-300 bg-neutral-700 rounded-lg hover:bg-neutral-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Add Provider
        </button>
      </div>
    </form>
  );
}
