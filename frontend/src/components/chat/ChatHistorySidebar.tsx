'use client';

import { useEffect, useMemo } from 'react';
import { useConversations, useSession } from '@/hooks';
import { ConversationSummary } from '@/types/chat';
import { cn, formatRelativeTime, getDateGroup, DateGroup } from '@/lib/utils';

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedConversations {
  group: DateGroup;
  items: ConversationSummary[];
}

export function ChatHistorySidebar({ isOpen, onClose }: ChatHistorySidebarProps) {
  const { conversations, isLoading, refetch } = useConversations();
  const { sessionId, switchSession } = useSession();

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleSelectConversation = (conv: ConversationSummary) => {
    if (conv.session_id !== sessionId) {
      switchSession(conv.session_id);
    }
    onClose();
  };

  const groupedConversations = useMemo(() => {
    const groups: Record<DateGroup, ConversationSummary[]> = {
      'Today': [],
      'Yesterday': [],
      'Last 7 days': [],
      'Older': [],
    };

    conversations.forEach((conv) => {
      const group = getDateGroup(conv.updated_at);
      groups[group].push(conv);
    });

    const result: GroupedConversations[] = [];
    const order: DateGroup[] = ['Today', 'Yesterday', 'Last 7 days', 'Older'];

    order.forEach((group) => {
      if (groups[group].length > 0) {
        result.push({ group, items: groups[group] });
      }
    });

    return result;
  }, [conversations]);

  const getConversationTitle = (conv: ConversationSummary) => {
    if (!conv.preview || conv.preview === 'New conversation') {
      return 'Untitled';
    }
    return conv.preview;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-80 bg-neutral-900 border-l border-neutral-800 z-50 transform transition-transform duration-200 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Chat History</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-neutral-800 text-gray-400 hover:text-white"
            aria-label="Close history"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-neutral-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-neutral-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start chatting to see your history here</p>
            </div>
          ) : (
            <div>
              {groupedConversations.map(({ group, items }) => (
                <div key={group}>
                  <div className="px-4 py-2 bg-neutral-950 text-xs font-medium text-gray-500 uppercase tracking-wide sticky top-0">
                    {group}
                  </div>
                  <div className="divide-y divide-neutral-800">
                    {items.map((conv) => {
                      const title = getConversationTitle(conv);
                      const isActive = conv.session_id === sessionId;
                      const isUntitled = title === 'Untitled';

                      return (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={cn(
                            'w-full p-4 text-left hover:bg-neutral-800 transition-colors',
                            isActive && 'bg-blue-900/30 border-l-2 border-blue-500'
                          )}
                        >
                          <p className={cn(
                            'text-sm line-clamp-2 mb-1',
                            isUntitled ? 'text-gray-500 italic' : 'text-gray-100'
                          )}>
                            {title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'}</span>
                            <span>-</span>
                            <span>{formatRelativeTime(conv.updated_at)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 rounded-lg hover:bg-neutral-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </aside>
    </>
  );
}
