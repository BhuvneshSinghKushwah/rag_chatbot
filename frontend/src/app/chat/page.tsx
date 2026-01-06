'use client';

import { MainLayout } from '@/components/layout';
import { ChatWidget } from '@/components/chat';
import { useSession } from '@/hooks';
import { chatApi } from '@/services/api';
import { useFingerprint } from '@/hooks/useFingerprint';
import { CONVERSATIONS_UPDATED_EVENT } from '@/hooks/useChat';

export default function ChatPage() {
  const { resetSession } = useSession();
  const { fingerprint } = useFingerprint();

  const handleNewChat = async () => {
    const newSessionId = resetSession();
    if (fingerprint) {
      try {
        await chatApi.createConversation(newSessionId, fingerprint);
        window.dispatchEvent(new CustomEvent(CONVERSATIONS_UPDATED_EVENT));
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    }
  };

  return (
    <MainLayout>
      <div className="relative h-full">
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            aria-label="Start new chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        <ChatWidget />
      </div>
    </MainLayout>
  );
}
