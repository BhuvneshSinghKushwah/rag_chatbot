export type ContextSourceType = 'documents' | 'web' | 'none';

export interface SourceInfo {
  source_type: ContextSourceType;
  sources: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  sourceInfo?: SourceInfo;
}

export interface ChatRequest {
  message: string;
  session_id: string;
  fingerprint: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  user_id: string;
  memory_updated: boolean;
}

export interface ChatHistoryMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatHistoryMessage[];
}

export interface WebSocketMessage {
  type: 'token' | 'complete' | 'error' | 'rate_limited' | 'llm_error';
  content?: string;
  message?: string;
  retry_after?: number;
  limits?: Record<string, RateLimitInfo>;
  error_type?: string;
  is_retryable?: boolean;
  source_info?: SourceInfo;
}

export interface ChatError {
  message: string;
  errorType?: string;
  retryAfter?: number;
  isRetryable?: boolean;
}

export interface RateLimitInfo {
  current: number;
  max: number;
  remaining: number;
}

export interface RateLimits {
  per_minute: RateLimitInfo;
  per_hour: RateLimitInfo;
  per_day: RateLimitInfo;
}

export interface ConversationSummary {
  id: string;
  session_id: string;
  preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationsListResponse {
  conversations: ConversationSummary[];
  total: number;
}
