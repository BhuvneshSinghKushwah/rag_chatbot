'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { useAdmin } from '@/hooks';
import {
  AdminLogin,
  AnalyticsDashboard,
  ConversationBrowser,
  DocumentUpload,
  TopUsersTable,
  ProviderManager,
} from '@/components/admin';

type Tab = 'analytics' | 'conversations' | 'documents' | 'settings';

export default function AdminPage() {
  const { isAdmin, logout } = useAdmin();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');

  if (!isAdmin) {
    return (
      <MainLayout>
        <AdminLogin />
      </MainLayout>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'documents', label: 'Documents' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1 hidden sm:block">Manage your application</p>
          </div>
          <button
            onClick={logout}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors flex-shrink-0"
          >
            Logout
          </button>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-neutral-800">
          <div className="border-b border-neutral-800 overflow-x-auto">
            <nav className="flex -mb-px min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-neutral-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                <AnalyticsDashboard />
                <TopUsersTable />
              </div>
            )}
            {activeTab === 'conversations' && <ConversationBrowser />}
            {activeTab === 'documents' && (
              <div className="max-w-2xl">
                <DocumentUpload />
              </div>
            )}
            {activeTab === 'settings' && <ProviderManager />}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
