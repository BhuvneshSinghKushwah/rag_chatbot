'use client';

import { useState, useRef, useCallback } from 'react';
import { useAdmin } from '@/hooks';
import { documentsApi } from '@/services/api';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const ALLOWED_TYPES = ['pdf', 'txt', 'md', 'docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const { adminKey } = useAdmin();
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_TYPES.includes(ext)) {
      return `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 10MB';
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(selectedFile);
    setError(null);
    setSuccessMessage(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!file || !adminKey) return;

    setUploadState('uploading');
    setProgress(0);
    setError(null);

    try {
      const result = await documentsApi.upload(file, adminKey, setProgress);
      setUploadState('success');
      setSuccessMessage(result.message);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete?.();
    } catch (err) {
      setUploadState('error');
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Upload failed');
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Upload Document</h3>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors bg-neutral-800',
          isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-neutral-600',
          uploadState === 'uploading' && 'pointer-events-none opacity-50'
        )}
      >
        {file ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl text-gray-400">
                {file.name.endsWith('.pdf') ? 'PDF' :
                 file.name.endsWith('.docx') ? 'DOCX' :
                 file.name.endsWith('.md') ? 'MD' : 'TXT'}
              </span>
              <span className="font-medium text-white">{file.name}</span>
            </div>
            <p className="text-sm text-gray-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={() => setFile(null)}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl text-gray-500">+</div>
            <p className="text-gray-300">
              Drag and drop a file here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-gray-500">
              Supported: PDF, TXT, MD, DOCX (max 10MB)
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
      </div>

      {uploadState === 'uploading' && (
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">Uploading...</span>
            <span className="text-white font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-neutral-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
          <p className="text-sm text-green-400">{successMessage}</p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploadState === 'uploading'}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploadState === 'uploading' ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
}
