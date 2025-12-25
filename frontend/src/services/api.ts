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

  async createConversation(sessionId: string, fingerprint: string): Promise<{ id: string; session_id: string; created: boolean }> {
    const params = new URLSearchParams({ session_id: sessionId, fingerprint });
    const response = await fetch(`/api/chat/conversations?${params}`, {
      method: 'POST',
    });
    return handleResponse(response);
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

export interface AnalyticsResponse {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    total_conversations: number;
    total_messages: number;
    unique_users: number;
    avg_messages_per_conversation: number;
  };
  documents: {
    total: number;
    ready: number;
  };
  daily: Array<{
    date: string;
    conversations: number;
    messages: number;
    unique_users: number;
  }>;
}

export interface TopUsersResponse {
  period_days: number;
  users: Array<{
    user_id: string;
    conversation_count: number;
    message_count: number;
  }>;
}

export interface AdminConversation {
  id: string;
  session_id: string;
  user_id: string;
  preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources: unknown[] | null;
    created_at: string;
  }>;
}

export const adminApi = {
  async verifyKey(key: string): Promise<boolean> {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': key,
      },
    });
    return response.ok;
  },

  async getAnalytics(adminKey: string, days: number = 30): Promise<AnalyticsResponse> {
    const params = new URLSearchParams({ days: days.toString() });
    const response = await fetch(`/api/admin/analytics/usage?${params}`, {
      headers: { 'X-Admin-Key': adminKey },
    });
    return handleResponse<AnalyticsResponse>(response);
  },

  async getTopUsers(adminKey: string, days: number = 30, limit: number = 10): Promise<TopUsersResponse> {
    const params = new URLSearchParams({ days: days.toString(), limit: limit.toString() });
    const response = await fetch(`/api/admin/analytics/top-users?${params}`, {
      headers: { 'X-Admin-Key': adminKey },
    });
    return handleResponse<TopUsersResponse>(response);
  },

  async getConversations(
    adminKey: string,
    limit: number = 50,
    offset: number = 0,
    userId?: string
  ): Promise<{ conversations: AdminConversation[]; total: number }> {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    if (userId) params.append('user_id', userId);
    const response = await fetch(`/api/admin/conversations?${params}`, {
      headers: { 'X-Admin-Key': adminKey },
    });
    return handleResponse<{ conversations: AdminConversation[]; total: number }>(response);
  },

  async getConversation(adminKey: string, id: string): Promise<ConversationDetail> {
    const response = await fetch(`/api/admin/conversations/${id}`, {
      headers: { 'X-Admin-Key': adminKey },
    });
    return handleResponse<ConversationDetail>(response);
  },
};

export { ApiError };
