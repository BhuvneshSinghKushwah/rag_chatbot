'use client';

import { Document } from '@/types/document';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  document: Document;
  onView?: (doc: Document) => void;
}

export function DocumentCard({ document, onView }: DocumentCardProps) {
  const fileIcon = getFileIcon(document.file_type);

  const handleView = () => {
    if (onView) {
      onView(document);
    }
  };

  return (
    <div className="border border-neutral-700 rounded-lg p-4 hover:border-neutral-600 transition-all bg-neutral-900">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center">
          <span className="text-xs font-bold text-gray-400">{fileIcon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate" title={document.filename}>
            {document.filename}
          </h3>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400 mt-1">
            <span>{formatBytes(document.file_size_bytes)}</span>
            <span>{document.chunks_count} chunks</span>
            <span>Uploaded {formatDate(document.created_at)}</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'inline-block px-2 py-1 text-xs rounded font-medium',
                document.status === 'ready'
                  ? 'bg-green-900/30 text-green-400'
                  : document.status === 'processing'
                  ? 'bg-yellow-900/30 text-yellow-400'
                  : document.status === 'failed'
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-neutral-800 text-gray-400'
              )}
            >
              {document.status}
            </span>
            {document.status === 'ready' && (
              <button
                onClick={handleView}
                className="px-2 py-1 text-xs rounded font-medium bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 transition-colors"
              >
                View
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
