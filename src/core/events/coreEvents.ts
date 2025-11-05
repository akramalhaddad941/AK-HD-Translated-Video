// src/core/events/coreEvents.ts

import { EventDefinition } from '@/types/events';
import { EventSystem } from './EventSystem';

// Core Events Definition
export const CoreEvents = {
  // System Events
  INITIALIZE: 'core.initialize',
  ACTIVATE: 'core.activate',
  DEACTIVATE: 'core.deactivate',
  SHUTDOWN: 'core.shutdown',
  
  // Translation Events
  TRANSLATION_START: 'translation.start',
  TRANSLATION_COMPLETE: 'translation.complete',
  TRANSLATION_ERROR: 'translation.error',
  TRANSLATION_PROGRESS: 'translation.progress',
  
  // UI Events
  UI_SHOW: 'ui.show',
  UI_HIDE: 'ui.hide',
  UI_UPDATE_POSITION: 'ui.updatePosition',
  UI_THEME_CHANGE: 'ui.themeChange',
  
  // Expert System Events
  EXPERT_SELECT: 'expert.select',
  EXPERT_SUGGEST: 'expert.suggest',
  EXPERT_APPLY: 'expert.apply',
  
  // Storage Events
  DATA_SAVE: 'storage.save',
  DATA_LOAD: 'storage.load',
  DATA_DELETE: 'storage.delete',
  
  // Performance Events
  PERFORMANCE_METRIC: 'performance.metric',
  OPTIMIZE_START: 'optimize.start',
  OPTIMIZE_COMPLETE: 'optimize.complete'
} as const;

// Event Definitions
export const CoreEventDefinitions: EventDefinition[] = [
  // System Events
  {
    name: CoreEvents.INITIALIZE,
    description: 'System initialization event'
  },
  {
    name: CoreEvents.ACTIVATE,
    description: 'System activation event'
  },
  {
    name: CoreEvents.DEACTIVATE,
    description: 'System deactivation event'
  },
  {
    name: CoreEvents.SHUTDOWN,
    description: 'System shutdown event'
  },
  
  // Translation Events
  {
    name: CoreEvents.TRANSLATION_START,
    description: 'Translation process started'
  },
  {
    name: CoreEvents.TRANSLATION_COMPLETE,
    description: 'Translation process completed'
  },
  {
    name: CoreEvents.TRANSLATION_ERROR,
    description: 'Translation process failed'
  },
  {
    name: CoreEvents.TRANSLATION_PROGRESS,
    description: 'Translation progress update'
  },
  
  // UI Events
  {
    name: CoreEvents.UI_SHOW,
    description: 'Show user interface'
  },
  {
    name: CoreEvents.UI_HIDE,
    description: 'Hide user interface'
  },
  {
    name: CoreEvents.UI_UPDATE_POSITION,
    description: 'Update UI position'
  },
  {
    name: CoreEvents.UI_THEME_CHANGE,
    description: 'Change UI theme'
  },
  
  // Expert System Events
  {
    name: CoreEvents.EXPERT_SELECT,
    description: 'Expert selection event'
  },
  {
    name: CoreEvents.EXPERT_SUGGEST,
    description: 'Expert suggestion event'
  },
  {
    name: CoreEvents.EXPERT_APPLY,
    description: 'Expert suggestion applied'
  },
  
  // Storage Events
  {
    name: CoreEvents.DATA_SAVE,
    description: 'Data save event'
  },
  {
    name: CoreEvents.DATA_LOAD,
    description: 'Data load event'
  },
  {
    name: CoreEvents.DATA_DELETE,
    description: 'Data delete event'
  },
  
  // Performance Events
  {
    name: CoreEvents.PERFORMANCE_METRIC,
    description: 'Performance metric event'
  },
  {
    name: CoreEvents.OPTIMIZE_START,
    description: 'Optimization started'
  },
  {
    name: CoreEvents.OPTIMIZE_COMPLETE,
    description: 'Optimization completed'
  }
];

// Initialize Core Events
export const initializeCoreEvents = (eventSystem: EventSystem): void => {
  CoreEventDefinitions.forEach(definition => {
    eventSystem.registerEvent(definition);
  });
  
  console.log(`Initialized ${CoreEventDefinitions.length} core events`);
};