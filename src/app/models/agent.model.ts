import { ProductLite, AiUserContext } from './ai-core.models';

export type AgentIntent = 'faq' | 'recommendation' | 'catalog' | 'general';

export interface AgentStep {
  name: string;
  description: string;
  status: 'planned' | 'completed' | 'skipped';
}

export interface AgentChatRequest {
  session_id: string;
  message: string;
  user?: AiUserContext;
  products: ProductLite[];
}

export interface AgentChatResponse {
  session_id: string;
  intent: AgentIntent;
  answer: string;
  plan: AgentStep[];
  memory_messages: number;
  used_tools: string[];
  data: {
    source?: string;
    integration_status?: string;
    productoDestacado?: ProductLite | null;
    productosRelacionados?: ProductLite[];
    sugerencias?: string[];
    normalized_question?: string;
    error?: string;
    detail?: string;
    [key: string]: unknown;
  };
}
