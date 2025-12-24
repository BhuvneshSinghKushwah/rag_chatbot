'use client';

import { MainLayout } from '@/components/layout';
import { DocumentList, UploadForm } from '@/components/documents';
import { useDocuments } from '@/hooks';

export default function DocumentsPage() {
  const { documents, isLoading, error, refetch } = useDocuments();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
              <p className="mt-1 text-gray-500">
                These documents are used by our AI assistant to answer your questions.
              </p>
            </div>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <DocumentList documents={documents} isLoading={isLoading} />
          </div>
          <div className="lg:col-span-1">
            <UploadForm onUploadComplete={refetch} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
