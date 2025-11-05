// src/core/state/application-state.ts

import { ExtensionStateManager } from './StateManager';
import { ApplicationState, ExpertSuggestion } from '@/types/application.state';

// Default application state
const defaultState: ApplicationState = {
  // System State
  isInitialized: false,
  isActive: false,
  currentMode: 'manual',
  
  // Translation State
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  isTranslating: false,
  translationProgress: 0,
  
  // UI State
  isVisible: false,
  position: { x: 100, y: 100 },
  theme: 'auto',
  
  // Performance State
  isOptimized: false,
  processingSpeed: 'balanced',
  
  // Expert System State
  selectedExpert: null,
  expertSuggestions: [],
  
  // Storage State
  hasUnsavedChanges: false,
  lastSavedAt: null,
  
  // Error State
  error: null,
  errorCount: 0
};

// Create and export the state manager instance
export const stateManager = new ExtensionStateManager<ApplicationState>(defaultState);

// State update helpers
export const stateHelpers = {
  // System state helpers
  initialize: () => {
    stateManager.setState({ 
      isInitialized: true,
      error: null,
      errorCount: 0
    });
  },
  
  setActive: (active: boolean) => {
    stateManager.setState({ isActive: active });
  },
  
  setMode: (mode: ApplicationState['currentMode']) => {
    stateManager.setState({ currentMode: mode });
  },
  
  // Translation state helpers
  startTranslation: () => {
    stateManager.setState({
      isTranslating: true,
      translationProgress: 0,
      error: null
    });
  },
  
  completeTranslation: () => {
    stateManager.setState({
      isTranslating: false,
      translationProgress: 100
    });
  },
  
  updateTranslationProgress: (progress: number) => {
    stateManager.setState({
      translationProgress: Math.min(100, Math.max(0, progress))
    });
  },
  
  // Language helpers
  setSourceLanguage: (language: string) => {
    stateManager.setState({ sourceLanguage: language });
  },
  
  setTargetLanguage: (language: string) => {
    stateManager.setState({ targetLanguage: language });
  },
  
  // UI state helpers
  showUI: () => {
    stateManager.setState({ isVisible: true });
  },
  
  hideUI: () => {
    stateManager.setState({ isVisible: false });
  },
  
  updatePosition: (x: number, y: number) => {
    stateManager.setState({ position: { x, y } });
  },
  
  setTheme: (theme: ApplicationState['theme']) => {
    stateManager.setState({ theme });
  },
  
  // Expert system helpers
  selectExpert: (expertId: string | null) => {
    stateManager.setState({ selectedExpert: expertId });
  },
  
  addExpertSuggestion: (suggestion: ExpertSuggestion) => {
    stateManager.setState(prev => ({
      expertSuggestions: [...prev.expertSuggestions, suggestion]
    }));
  },
  
  clearExpertSuggestions: () => {
    stateManager.setState({ expertSuggestions: [] });
  },
  
  // Error handling
  setError: (error: Error | null) => {
    stateManager.setState({ 
      error,
      errorCount: error ? stateManager.getState().errorCount + 1 : 0
    });
  },
  
  // Performance helpers
  setOptimizationMode: (optimized: boolean) => {
    stateManager.setState({ isOptimized: optimized });
  },
  
  setProcessingSpeed: (speed: ApplicationState['processingSpeed']) => {
    stateManager.setState({ processingSpeed: speed });
  },
  
  // Storage helpers
  markAsModified: () => {
    stateManager.setState({ 
      hasUnsavedChanges: true,
      lastSavedAt: null
    });
  },
  
  markAsSaved: () => {
    stateManager.setState({ 
      hasUnsavedChanges: false,
      lastSavedAt: new Date()
    });
  },
  
  // Reset to default state
  reset: () => {
    stateManager.reset();
  }
};

// React hook for accessing state
export { default as useExtensionState } from '../hooks/useExtensionState';
export { default as useStateSelector } from '../hooks/useStateSelector';
export { default as useStateActions } from '../hooks/useStateActions';