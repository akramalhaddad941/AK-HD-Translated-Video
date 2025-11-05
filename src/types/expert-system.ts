// src/types/expert-system.ts

import { TranslationResult } from './application.state';

export interface ExpertSystem {
  id: string;
  name: string;
  type: 'translation' | 'optimization' | 'quality' | 'context';
  description: string;
  capabilities: string[];
  supportedLanguages: string[];
  accuracy: number;
  speed: 'fast' | 'balanced' | 'quality';
  cost: 'free' | 'low' | 'medium' | 'high';
  quality: number;
  isActive: boolean;
  lastUsed: Date | null;
  usageCount: number;
}

export interface ExpertSelection {
  experts: string[];
  strategy: 'best_accuracy' | 'fastest' | 'cheapest' | 'balanced' | 'custom';
  confidence: number;
  reasoning: string;
}

export interface ExpertPerformance {
  expertId: string;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  accuracyScore: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface TranslationRequest {
  id: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: {
    domain?: string;
    tone?: string;
    formality?: string;
    audience?: string;
  };
  constraints?: {
    maxTime?: number;
    maxCost?: number;
    quality?: number;
  };
  timestamp: Date;
}

export interface TranslationResponse {
  requestId: string;
  expertId: string;
  result: TranslationResult;
  performance: {
    responseTime: number;
    confidence: number;
    quality: number;
  };
  suggestions: ExpertSuggestion[];
}