export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type DocumentVisibility = 'global' | 'private' | 'shared';

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  status: DocumentStatus;
  chunks_count: number;
  visibility: DocumentVisibility;
  created_at: string;
  processed_at?: string;
  can_edit: boolean;
  can_delete: boolean;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface DocumentUploadResponse {
  id: string;
  filename: string;
  status: DocumentStatus;
  message: string;
}
