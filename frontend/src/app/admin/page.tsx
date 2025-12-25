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
} from '@/components/admin';

type Tab = 'analytics' | 'conversations' | 'documents';

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
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your application</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-neutral-800">
          <div className="border-b border-neutral-800">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
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

          <div className="p-6">
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
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
