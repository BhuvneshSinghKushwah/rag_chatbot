'use client';

import { useState } from 'react';
import { Document } from '@/types/document';
import { DocumentCard } from './DocumentCard';
import { DocumentViewer } from './DocumentViewer';

interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
}

export function DocumentList({ documents, isLoading }: DocumentListProps) {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const handleView = (doc: Document) => {
    setSelectedDoc(doc);
  };

  const handleCloseViewer = () => {
    setSelectedDoc(null);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-neutral-700 rounded-lg p-4 bg-neutral-900 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-neutral-800 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800 rounded w-1/2" />
                <div className="h-5 bg-neutral-800 rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl text-gray-500">?</span>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No documents yet</h3>
        <p className="text-gray-400">
          Documents will appear here once they are uploaded by an administrator.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} onView={handleView} />
        ))}
      </div>
      <DocumentViewer
        doc={selectedDoc}
        isOpen={selectedDoc !== null}
        onClose={handleCloseViewer}
      />
    </>
  );
}
