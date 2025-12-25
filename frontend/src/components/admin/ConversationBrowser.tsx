'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks';
import { adminApi, AdminConversation, ConversationDetail } from '@/services/api';

export function ConversationBrowser() {
  const { adminKey } = useAdmin();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 20;

  useEffect(() => {
    if (!adminKey) return;

    const fetchConversations = async () => {
      setIsLoading(true);
      setError('');
      try {
        const result = await adminApi.getConversations(adminKey, limit, offset);
        setConversations(result.conversations);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      }
      setIsLoading(false);
    };

    fetchConversations();
  }, [adminKey, offset]);

  useEffect(() => {
    if (!adminKey || !selectedId) {
      setDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const result = await adminApi.getConversation(adminKey, selectedId);
        setDetail(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
      setDetailLoading(false);
    };

    fetchDetail();
  }, [adminKey, selectedId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-neutral-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Conversations</h3>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      {selectedId && detail ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to list
          </button>

          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
            <div className="mb-4 pb-4 border-b border-neutral-700">
              <h4 className="font-medium text-white">Session: {detail.session_id.slice(0, 8)}...</h4>
              <p className="text-sm text-gray-400">
                User: {detail.user_id.slice(0, 8)}... | Created: {new Date(detail.created_at).toLocaleString()}
              </p>
            </div>

            {detailLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-neutral-700 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {detail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user' ? 'bg-blue-900/30 ml-8' : 'bg-neutral-700 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-400 uppercase">{msg.role}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className="w-full text-left p-4 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-blue-500 hover:bg-neutral-750 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">{conv.preview.slice(0, 50) || 'New conversation'}...</h4>
                    <p className="text-sm text-gray-400">
                      User: {conv.user_id.slice(0, 8)}... | {conv.message_count} messages
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                    <svg className="w-5 h-5 text-gray-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
