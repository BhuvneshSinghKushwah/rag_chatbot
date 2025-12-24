'use client';

import { Document } from '@/types/document';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const fileIcon = getFileIcon(document.file_type);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-xs font-bold text-gray-600">{fileIcon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate" title={document.filename}>
            {document.filename}
          </h3>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
            <span>{formatBytes(document.file_size_bytes)}</span>
            <span>{document.chunks_count} chunks</span>
            <span>Uploaded {formatDate(document.created_at)}</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'inline-block px-2 py-1 text-xs rounded font-medium',
                document.status === 'ready'
                  ? 'bg-green-100 text-green-800'
                  : document.status === 'processing'
                  ? 'bg-yellow-100 text-yellow-800'
                  : document.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {document.status}
            </span>
            {document.status === 'ready' && (
              <a
                href={`/api/documents/${document.id}/content`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 text-xs rounded font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
              >
                View
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
