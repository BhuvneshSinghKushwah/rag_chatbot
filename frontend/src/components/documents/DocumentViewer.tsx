'use client';

import { useState, useEffect } from 'react';
import { Document } from '@/types/document';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
  doc: Document | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewer({ doc, isOpen, onClose }: DocumentViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !doc) {
      setContent(null);
      setError(null);
      return;
    }

    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/documents/${doc.id}/content`);
        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/pdf')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setContent(url);
        } else {
          const text = await response.text();
          setContent(text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();

    return () => {
      if (content && doc?.file_type === 'pdf') {
        URL.revokeObjectURL(content);
      }
    };
  }, [isOpen, doc]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const isPdf = doc.file_type === 'pdf';
  const isMarkdown = doc.file_type === 'md';

  const handleOpenInNewTab = () => {
    window.open(`/api/documents/${doc.id}/content`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl h-[90vh] mx-4 bg-neutral-900 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-neutral-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold text-gray-400 uppercase">
                {doc.file_type}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white truncate">
                {doc.filename}
              </h2>
              <p className="text-sm text-gray-400">
                {doc.chunks_count} chunks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="px-3 py-2 text-sm font-medium text-gray-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700"
            >
              Open in New Tab
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-neutral-800 rounded-lg"
              aria-label="Close viewer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-neutral-900">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Failed to load document</h3>
                <p className="text-gray-400 mb-4">{error}</p>
                <button
                  onClick={handleOpenInNewTab}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Try opening in new tab
                </button>
              </div>
            </div>
          ) : isPdf && content ? (
            <iframe
              src={content}
              className="w-full h-full border-0"
              title={doc.filename}
            />
          ) : content ? (
            <div className={cn(
              'p-6 h-full overflow-auto',
              isMarkdown ? 'prose prose-invert prose-sm max-w-none' : ''
            )}>
              <pre className={cn(
                'whitespace-pre-wrap font-mono text-sm text-gray-200',
                isMarkdown && 'font-sans'
              )}>
                {content}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
