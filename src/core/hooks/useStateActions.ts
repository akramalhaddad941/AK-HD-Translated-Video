// src/core/hooks/useStateActions.ts

import { useCallback } from 'react';
import { ExtensionStateManager } from '@/core/state/StateManager';
import { ApplicationState } from '@/types/application.state';
import { stateHelpers } from '@/core/state/application-state';

export const useStateActions = (
  stateManager: ExtensionStateManager<ApplicationState>
) => {
  // Create action creators that use the state helpers but can access current state
  const actions = {
    // System state actions
    initialize: useCallback(() => {
      stateHelpers.initialize();
    }, []),
    
    setActive: useCallback((active: boolean) => {
      stateHelpers.setActive(active);
    }, []),
    
    setMode: useCallback((mode: ApplicationState['currentMode']) => {
      stateHelpers.setMode(mode);
    }, []),
    
    // Translation state actions
    startTranslation: useCallback(() => {
      stateHelpers.startTranslation();
    }, []),
    
    completeTranslation: useCallback(() => {
      stateHelpers.completeTranslation();
    }, []),
    
    updateTranslationProgress: useCallback((progress: number) => {
      stateHelpers.updateTranslationProgress(progress);
    }, []),
    
    // Language actions
    setSourceLanguage: useCallback((language: string) => {
      stateHelpers.setSourceLanguage(language);
    }, []),
    
    setTargetLanguage: useCallback((language: string) => {
      stateHelpers.setTargetLanguage(language);
    }, []),
    
    // UI actions
    showUI: useCallback(() => {
      stateHelpers.showUI();
    }, []),
    
    hideUI: useCallback(() => {
      stateHelpers.hideUI();
    }, []),
    
    updatePosition: useCallback((x: number, y: number) => {
      stateHelpers.updatePosition(x, y);
    }, []),
    
    setTheme: useCallback((theme: ApplicationState['theme']) => {
      stateHelpers.setTheme(theme);
    }, []),
    
    // Expert system actions
    selectExpert: useCallback((expertId: string | null) => {
      stateHelpers.selectExpert(expertId);
    }, []),
    
    addExpertSuggestion: useCallback((suggestion: any) => {
      stateHelpers.addExpertSuggestion(suggestion);
    }, []),
    
    clearExpertSuggestions: useCallback(() => {
      stateHelpers.clearExpertSuggestions();
    }, []),
    
    // Error handling
    setError: useCallback((error: Error | null) => {
      stateHelpers.setError(error);
    }, []),
    
    // Performance actions
    setOptimizationMode: useCallback((optimized: boolean) => {
      stateHelpers.setOptimizationMode(optimized);
    }, []),
    
    setProcessingSpeed: useCallback((speed: ApplicationState['processingSpeed']) => {
      stateHelpers.setProcessingSpeed(speed);
    }, []),
    
    // Storage actions
    markAsModified: useCallback(() => {
      stateHelpers.markAsModified();
    }, []),
    
    markAsSaved: useCallback(() => {
      stateHelpers.markAsSaved();
    }, []),
    
    // Reset
    reset: useCallback(() => {
      stateHelpers.reset();
    }, [])
  };

  return actions;
};

export default useStateActions;