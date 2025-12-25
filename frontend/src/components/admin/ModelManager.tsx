'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks';
import { adminApi } from '@/services/api';
import { LLMProvider, LLMModel, LLMModelCreate } from '@/types/llm';

interface ModelManagerProps {
  provider: LLMProvider;
  onUpdate: () => void;
}

export function ModelManager({ provider, onUpdate }: ModelManagerProps) {
  const { adminKey } = useAdmin();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddModel = async (data: LLMModelCreate) => {
    if (!adminKey) return;
    try {
      await adminApi.createModel(adminKey, provider.id, data);
      setShowAddForm(false);
      setError(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add model');
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!adminKey || !confirm('Delete this model?')) return;
    try {
      await adminApi.deleteModel(adminKey, modelId);
      setError(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const handleSetDefault = async (modelId: string) => {
    if (!adminKey) return;
    try {
      await adminApi.setDefaultModel(adminKey, modelId);
      setError(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const handleToggleActive = async (model: LLMModel) => {
    if (!adminKey) return;
    try {
      await adminApi.updateModel(adminKey, model.id, { is_active: !model.is_active });
      setError(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  const handleUpdateModel = async (modelId: string, data: Partial<LLMModelCreate>) => {
    if (!adminKey) return;
    try {
      await adminApi.updateModel(adminKey, modelId, data);
      setEditingModel(null);
      setError(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">Models</h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Model'}
        </button>
      </div>

      {error && (
        <div className="p-2 text-xs text-red-400 bg-red-900/20 border border-red-800 rounded">
          {error}
        </div>
      )}

      {showAddForm && (
        <AddModelForm onSubmit={handleAddModel} onCancel={() => setShowAddForm(false)} />
      )}

      {provider.models.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500">
          No models configured for this provider.
        </div>
      ) : (
        <div className="space-y-2">
          {provider.models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between p-3 bg-neutral-800 border border-neutral-700 rounded-lg"
            >
              {editingModel === model.id ? (
                <EditModelForm
                  model={model}
                  onSave={(data) => handleUpdateModel(model.id, data)}
                  onCancel={() => setEditingModel(null)}
                />
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-white">{model.display_name || model.model_name}</span>
                    <span className="text-xs text-gray-500">{model.model_name}</span>
                    {model.is_default && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">Default</span>
                    )}
                    {!model.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">Inactive</span>
                    )}
                    <span className="text-xs text-gray-500">
                      temp: {model.temperature} | tokens: {model.max_tokens}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingModel(model.id)}
                      className="px-2 py-1 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(model)}
                      className="px-2 py-1 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                    >
                      {model.is_active ? 'Disable' : 'Enable'}
                    </button>
                    {!model.is_default && (
                      <button
                        onClick={() => handleSetDefault(model.id)}
                        className="px-2 py-1 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      className="px-2 py-1 text-xs text-red-400 bg-neutral-700 rounded hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddModelForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: LLMModelCreate) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<LLMModelCreate>({
    model_name: '',
    display_name: '',
    max_tokens: 4096,
    temperature: 0.7,
    is_default: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      display_name: formData.display_name || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Model Name</label>
          <input
            type="text"
            value={formData.model_name}
            onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
            placeholder="e.g., gpt-4o"
            required
            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g., GPT-4o"
            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded text-white placeholder-gray-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Max Tokens</label>
          <input
            type="number"
            value={formData.max_tokens}
            onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
            min={1}
            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Temperature</label>
          <input
            type="number"
            value={formData.temperature}
            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
            min={0}
            max={2}
            step={0.1}
            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded text-white"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded border-neutral-700"
            />
            Set as default
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Add Model
        </button>
      </div>
    </form>
  );
}

function EditModelForm({
  model,
  onSave,
  onCancel,
}: {
  model: LLMModel;
  onSave: (data: Partial<LLMModelCreate>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    display_name: model.display_name || '',
    max_tokens: model.max_tokens,
    temperature: model.temperature,
  });

  return (
    <div className="flex items-center gap-3 flex-1">
      <input
        type="text"
        value={formData.display_name}
        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
        placeholder="Display name"
        className="px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded text-white w-32"
      />
      <input
        type="number"
        value={formData.max_tokens}
        onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
        className="px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded text-white w-20"
      />
      <input
        type="number"
        value={formData.temperature}
        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
        step={0.1}
        min={0}
        max={2}
        className="px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded text-white w-16"
      />
      <button
        onClick={() => onSave(formData)}
        className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-xs text-gray-300 bg-neutral-700 rounded hover:bg-neutral-600"
      >
        Cancel
      </button>
    </div>
  );
}
