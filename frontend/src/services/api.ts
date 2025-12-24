import { ChatRequest, ChatResponse, ChatHistoryResponse, ConversationsListResponse } from '@/types/chat';
import { DocumentListResponse, Document, DocumentUploadResponse } from '@/types/document';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After');
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data.detail?.error || data.detail || data.message || message;
    } catch {
      message = response.statusText;
    }
    throw new ApiError(
      response.status,
      message,
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }
  return response.json();
}

export const chatApi = {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<ChatResponse>(response);
  },

  async getHistory(sessionId: string, fingerprint: string): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({ fingerprint });
    const response = await fetch(`/api/chat/history/${sessionId}?${params}`);
    return handleResponse<ChatHistoryResponse>(response);
  },

  async getConversations(fingerprint: string): Promise<ConversationsListResponse> {
    const params = new URLSearchParams({ fingerprint });
    const response = await fetch(`/api/chat/conversations?${params}`);
    return handleResponse<ConversationsListResponse>(response);
  },

  async getWsUrl(): Promise<string> {
    const response = await fetch('/api/config');
    const data = await response.json();
    return data.wsUrl;
  },

  async createWebSocket(sessionId: string, fingerprint: string): Promise<WebSocket> {
    const wsUrl = await this.getWsUrl();
    const url = new URL(wsUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ session_id: sessionId, fingerprint });
    return new WebSocket(`${protocol}//${url.host}/api/chat/ws?${params}`);
  },
};

export const documentsApi = {
  async list(): Promise<DocumentListResponse> {
    const response = await fetch('/api/documents', {
      cache: 'no-store',
    });
    return handleResponse<DocumentListResponse>(response);
  },

  async get(documentId: string): Promise<Document> {
    const response = await fetch(`/api/documents/${documentId}`, {
      cache: 'no-store',
    });
    return handleResponse<Document>(response);
  },

  async upload(
    file: File,
    adminKey: string,
    onProgress?: (progress: number) => void
  ): Promise<DocumentUploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let message = 'Upload failed';
          try {
            const data = JSON.parse(xhr.responseText);
            message = data.detail || message;
          } catch {
            message = xhr.statusText;
          }
          reject(new ApiError(xhr.status, message));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError(0, 'Network error'));
      });

      xhr.open('POST', '/api/documents/upload');
      xhr.setRequestHeader('X-Admin-Key', adminKey);
      xhr.send(formData);
    });
  },

  async delete(documentId: string, adminKey: string): Promise<void> {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Key': adminKey },
    });
    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to delete document');
    }
  },
};

export { ApiError };
