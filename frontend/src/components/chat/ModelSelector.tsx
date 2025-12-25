'use client';

import { useState, useRef, useEffect } from 'react';
import { AvailableModel } from '@/types/llm';

interface ModelSelectorProps {
  models: AvailableModel[];
  selectedModel: AvailableModel | null;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, selectedModel, onSelect, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (models.length === 0) {
    return null;
  }

  const groupedModels = models.reduce((acc, model) => {
    const key = model.provider_name;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(model);
    return acc;
  }, {} as Record<string, AvailableModel[]>);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-gray-300 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="max-w-[150px] truncate">
          {selectedModel?.display_name || 'Select Model'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1 w-56 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedModels).map(([providerName, providerModels]) => (
              <div key={providerName}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-neutral-900">
                  {providerName}
                </div>
                {providerModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 ${
                      selectedModel?.id === model.id
                        ? 'bg-neutral-700 text-white'
                        : 'text-gray-300'
                    }`}
                  >
                    {model.display_name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
