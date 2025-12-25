'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { DocumentList } from '@/components/documents';
import { useDocuments } from '@/hooks';

export default function DocumentsPage() {
  const { documents, isLoading, error, refetch } = useDocuments();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
              <p className="mt-1 text-gray-400">
                These documents are used by our AI assistant to answer your questions.
              </p>
            </div>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <DocumentList documents={documents} isLoading={isLoading} />

        <div className="mt-8 p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
          <p className="text-sm text-gray-400">
            Need to upload documents?{' '}
            <Link href="/admin" className="text-blue-400 hover:text-blue-300 font-medium">
              Go to Admin Panel
            </Link>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
