'use client';

import { useEffect } from 'react';
import { useConversations, useSession } from '@/hooks';
import { ConversationSummary } from '@/types/chat';
import { cn, formatRelativeTime } from '@/lib/utils';

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatHistorySidebar({ isOpen, onClose }: ChatHistorySidebarProps) {
  const { conversations, isLoading, refetch } = useConversations();
  const { sessionId, resetSession, switchSession } = useSession();

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleNewChat = async () => {
    resetSession();
    onClose();
    await new Promise(resolve => setTimeout(resolve, 100));
    refetch();
  };

  const handleSelectConversation = (conv: ConversationSummary) => {
    if (conv.session_id !== sessionId) {
      switchSession(conv.session_id);
    }
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-80 bg-white border-l z-50 transform transition-transform duration-200 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Chat History</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Close history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start chatting to see your history here</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    'w-full p-4 text-left hover:bg-gray-50 transition-colors',
                    conv.session_id === sessionId && 'bg-blue-50'
                  )}
                >
                  <p className="text-sm text-gray-900 line-clamp-2 mb-1">
                    {conv.preview}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{conv.message_count} messages</span>
                    <span>-</span>
                    <span>{formatRelativeTime(conv.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </aside>
    </>
  );
}
