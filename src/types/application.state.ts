// src/types/application.state.ts

export interface ApplicationState {
  // System State
  isInitialized: boolean;
  isActive: boolean;
  currentMode: 'manual' | 'automatic' | 'expert';
  
  // Translation State
  sourceLanguage: string;
  targetLanguage: string;
  isTranslating: boolean;
  translationProgress: number;
  
  // UI State
  isVisible: boolean;
  position: { x: number; y: number };
  theme: 'light' | 'dark' | 'auto';
  
  // Performance State
  isOptimized: boolean;
  processingSpeed: 'fast' | 'balanced' | 'quality';
  
  // Expert System State
  selectedExpert: string | null;
  expertSuggestions: ExpertSuggestion[];
  
  // Storage State
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  
  // Error State
  error: Error | null;
  errorCount: number;
}

export interface ExpertSuggestion {
  id: string;
  type: 'translation' | 'optimization' | 'quality';
  expertId: string;
  confidence: number;
  data: any;
  timestamp: Date;
}

export interface LanguagePair {
  source: string;
  target: string;
}

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  engine: string;
  timestamp: Date;
  duration: number;
}