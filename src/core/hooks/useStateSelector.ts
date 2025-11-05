// src/core/hooks/useStateSelector.ts

import { useState, useEffect, useCallback } from 'react';
import { ExtensionStateManager } from '@/core/state/StateManager';
import { ApplicationState } from '@/types/application.state';

export function useStateSelector<T>(
  stateManager: ExtensionStateManager<ApplicationState>,
  selector: (state: ApplicationState) => T
): T {
  const [selectedValue, setSelectedValue] = useState<T>(() => 
    selector(stateManager.getState())
  );

  useEffect(() => {
    const unsubscribe = stateManager.subscribe(currentState => {
      const newValue = selector(currentState);
      setSelectedValue(newValue);
    });
    
    return unsubscribe;
  }, [stateManager, selector]);

  return selectedValue;
}

export default useStateSelector;