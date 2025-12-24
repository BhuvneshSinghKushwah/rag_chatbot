'use client';

import { useState, useRef, useCallback } from 'react';
import { documentsApi } from '@/services/api';
import { cn } from '@/lib/utils';

interface UploadFormProps {
  onUploadComplete?: () => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const ALLOWED_TYPES = ['pdf', 'txt', 'md', 'docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
        if (err.message.includes('403') || err.message.includes('Invalid admin key')) {
          setError('Invalid admin key');
          setIsAuthenticated(false);
        } else {
          setError(err.message);
        }
      } else {
        setError('Upload failed');
      }
    }
  };

  const handleAuthenticate = () => {
    if (adminKey.trim()) {
      setIsAuthenticated(true);
      setError(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="border rounded-lg p-6 bg-white">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Upload</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter your admin API key to upload documents.
        </p>
        <div className="space-y-4">
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin API Key"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleAuthenticate}
            disabled={!adminKey.trim()}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Upload Document</h3>
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setAdminKey('');
            setFile(null);
            setError(null);
            setSuccessMessage(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Logout
        </button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          uploadState === 'uploading' && 'pointer-events-none opacity-50'
        )}
      >
        {file ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">
                {file.name.endsWith('.pdf') ? 'PDF' :
                 file.name.endsWith('.docx') ? 'DOCX' :
                 file.name.endsWith('.md') ? 'MD' : 'TXT'}
              </span>
              <span className="font-medium text-gray-900">{file.name}</span>
            </div>
            <p className="text-sm text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={() => setFile(null)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl text-gray-400">+</div>
            <p className="text-gray-600">
              Drag and drop a file here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-medium"
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
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Uploading...</span>
            <span className="text-gray-900 font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploadState === 'uploading'}
        className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploadState === 'uploading' ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
}
