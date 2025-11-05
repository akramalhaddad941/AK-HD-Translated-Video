// src/core/hooks/useExtensionState.ts

import { useState, useEffect, useCallback } from 'react';
import { ApplicationState } from '@/types/application.state';
import { ExtensionStateManager } from '@/core/state/StateManager';

export const useExtensionState = (
  stateManager: ExtensionStateManager<ApplicationState>
) => {
  const [state, setState] = useState<ApplicationState>(stateManager.getState());

  useEffect(() => {
    const unsubscribe = stateManager.subscribe(setState);
    return unsubscribe;
  }, [stateManager]);

  const updateState = useCallback((
    updater: Partial<ApplicationState> | ((prev: ApplicationState) => ApplicationState)
  ) => {
    stateManager.setState(updater);
  }, [stateManager]);

  const reset = useCallback(() => {
    stateManager.reset();
  }, [stateManager]);

  const canUndo = useCallback(() => {
    return stateManager.canUndo();
  }, [stateManager]);

  const undo = useCallback(() => {
    stateManager.undo();
  }, [stateManager]);

  return {
    state,
    updateState,
    reset,
    canUndo,
    undo
  };
};

export default useExtensionState;