'use client';

import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatWidget() {
  const { messages, isConnected, isLoading, error, sendMessage } = useChat();

  return (
    <div className="flex flex-col h-full bg-black">
      <MessageList messages={messages} isLoading={isLoading} />
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <MessageInput
        onSend={sendMessage}
        disabled={!isConnected || isLoading}
        placeholder={isConnected ? 'Type your message...' : 'Connecting...'}
      />
    </div>
  );
}
