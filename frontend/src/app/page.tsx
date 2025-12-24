'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { ChatWidget, ChatHistorySidebar } from '@/components/chat';

export default function ChatPage() {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <MainLayout>
      <div className="relative h-full">
        <button
          onClick={() => setHistoryOpen(true)}
          className="absolute top-4 right-4 z-10 p-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50"
          aria-label="Open chat history"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <ChatWidget />
        <ChatHistorySidebar isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      </div>
    </MainLayout>
  );
}
