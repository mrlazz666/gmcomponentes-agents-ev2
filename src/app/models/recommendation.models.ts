import { ProductLite } from './ai-core.models';

export type RecommendationStep = 'initial' | 'category' | 'brand' | 'use' | 'priority' | 'done';

export interface RecommendationState {
  baseRequest: string;
  budget?: number;
  category?: string;
  preferredBrand?: string;
  anyBrand?: boolean;
  useCase?: string;
  priority?: string;
}

export interface RecommendationRequest {
  message: string;
  budget?: number;
  step?: RecommendationStep;
  state?: RecommendationState;
  productos: ProductLite[];
}

export interface RecommendationResponse {
  mode: 'question' | 'result';
  answer: string;
  suggestions: ProductLite[];
  nextStep?: RecommendationStep;
  quickOptions?: string[];
  state: RecommendationState;
  confidence?: number;
  aiContext?: {
    llmUsed?: boolean;
  };
}
