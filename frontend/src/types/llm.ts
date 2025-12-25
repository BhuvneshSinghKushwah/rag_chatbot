export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'ollama';

export interface LLMModel {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string | null;
  is_active: boolean;
  is_default: boolean;
  max_tokens: number;
  temperature: number;
  created_at: string;
}

export interface LLMProvider {
  id: string;
  provider_type: ProviderType;
  name: string;
  base_url: string | null;
  is_active: boolean;
  is_default: boolean;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
  models: LLMModel[];
}

export interface LLMProviderListResponse {
  providers: LLMProvider[];
  total: number;
}

export interface LLMProviderCreate {
  provider_type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  is_default?: boolean;
}

export interface LLMProviderUpdate {
  name?: string;
  api_key?: string;
  base_url?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface LLMModelCreate {
  model_name: string;
  display_name?: string;
  max_tokens?: number;
  temperature?: number;
  is_default?: boolean;
}

export interface LLMModelUpdate {
  model_name?: string;
  display_name?: string;
  max_tokens?: number;
  temperature?: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface AvailableModel {
  id: string;
  provider_id: string;
  provider_type: ProviderType;
  provider_name: string;
  model_name: string;
  display_name: string;
}

export interface AvailableModelsResponse {
  models: AvailableModel[];
  default_model_id: string | null;
}

export interface TestProviderRequest {
  provider_type: ProviderType;
  api_key?: string;
  base_url?: string;
  model_name?: string;
}

export interface TestProviderResponse {
  success: boolean;
  message: string;
  provider_type: ProviderType;
}
