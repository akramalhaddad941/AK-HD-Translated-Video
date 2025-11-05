// src/types/events.ts

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventDefinition {
  name: string;
  type?: string;
  description?: string;
}

export interface CoreEvents {
  // System Events
  INITIALIZE: 'core.initialize';
  ACTIVATE: 'core.activate';
  DEACTIVATE: 'core.deactivate';
  SHUTDOWN: 'core.shutdown';
  
  // Translation Events
  TRANSLATION_START: 'translation.start';
  TRANSLATION_COMPLETE: 'translation.complete';
  TRANSLATION_ERROR: 'translation.error';
  TRANSLATION_PROGRESS: 'translation.progress';
  
  // UI Events
  UI_SHOW: 'ui.show';
  UI_HIDE: 'ui.hide';
  UI_UPDATE_POSITION: 'ui.updatePosition';
  UI_THEME_CHANGE: 'ui.themeChange';
  
  // Expert System Events
  EXPERT_SELECT: 'expert.select';
  EXPERT_SUGGEST: 'expert.suggest';
  EXPERT_APPLY: 'expert.apply';
  
  // Storage Events
  DATA_SAVE: 'storage.save';
  DATA_LOAD: 'storage.load';
  DATA_DELETE: 'storage.delete';
  
  // Performance Events
  PERFORMANCE_METRIC: 'performance.metric';
  OPTIMIZE_START: 'optimize.start';
  OPTIMIZE_COMPLETE: 'optimize.complete';
}

export interface TranslationStartEvent {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  engine: string;
}

export interface TranslationCompleteEvent {
  id: string;
  result: TranslationResult;
  duration: number;
}

export interface TranslationErrorEvent {
  error: Error;
  context: string;
  text: string;
}