'use client';

import { useCallback, ReactNode } from 'react';
import { useChat } from '@/hooks/useChat';
import { useModels } from '@/hooks/useModels';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ErrorBanner } from './ErrorBanner';
import { ModelSelector } from './ModelSelector';

export function ChatWidget() {
  const { messages, isConnected, isLoading, error, sendMessage } = useChat();
  const { models, selectedModel, selectedModelId, selectModel, isLoading: modelsLoading } = useModels();

  const handleSend = useCallback((content: string) => {
    sendMessage(content, selectedModelId || undefined);
  }, [sendMessage, selectedModelId]);

  const modelSelector: ReactNode = !modelsLoading && models.length > 0 ? (
    <ModelSelector
      models={models}
      selectedModel={selectedModel}
      onSelect={selectModel}
      disabled={isLoading}
    />
  ) : null;

  return (
    <div className="flex flex-col h-full bg-black">
      <MessageList messages={messages} isLoading={isLoading} />
      {error && <ErrorBanner error={error} />}
      <MessageInput
        onSend={handleSend}
        disabled={!isConnected || isLoading}
        placeholder={isConnected ? 'Type your message...' : 'Connecting...'}
        modelSelector={modelSelector}
      />
    </div>
  );
}
