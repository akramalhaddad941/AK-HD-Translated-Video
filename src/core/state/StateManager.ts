// src/core/state/StateManager.ts

import { EventHandler } from '@/types/events';

export interface StateManager<T> {
  getState(): T;
  setState(updater: Partial<T> | ((prev: T) => T)): void;
  subscribe(listener: (state: T) => void): () => void;
  reset(): void;
  getStateSnapshot(): T;
}

export class ExtensionStateManager<T extends Record<string, any>> 
  implements StateManager<T> {
  private state: T;
  private listeners: Set<(state: T) => void> = new Set();
  private changeHistory: Array<{
    timestamp: Date;
    previousState: T;
    newState: T;
    changes: Partial<T>;
  }> = [];
  private readonly maxHistorySize = 50;
  
  constructor(initialState: T) {
    this.state = { ...initialState };
  }

  getState(): T {
    return { ...this.state };
  }

  getStateSnapshot(): T {
    // Return reference to current state (for performance-critical scenarios)
    return this.state;
  }

  setState(updater: Partial<T> | ((prev: T) => T)): void {
    const prevState = this.state;
    const newState = typeof updater === 'function' 
      ? updater(prevState) 
      : { ...prevState, ...updater };
    
    // Only update if state has actually changed
    if (this.shallowEqual(prevState, newState)) {
      return;
    }
    
    this.state = newState;
    this.addToHistory(prevState, newState, typeof updater === 'object' ? updater : {});
    this.notifyListeners(newState);
  }

  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current state
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  reset(): void {
    const currentState = this.state;
    this.state = { ...currentState };
    this.notifyListeners(this.state);
  }

  private notifyListeners(state: T): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  private addToHistory(
    previousState: T, 
    newState: T, 
    changes: Partial<T>
  ): void {
    this.changeHistory.push({
      timestamp: new Date(),
      previousState: { ...previousState },
      newState: { ...newState },
      changes: { ...changes }
    });

    // Trim history to prevent memory issues
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory = this.changeHistory.slice(-this.maxHistorySize);
    }
  }

  private shallowEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (a[key] !== b[key]) return false;
    }
    
    return true;
  }

  // Debug methods
  getChangeHistory() {
    return [...this.changeHistory];
  }

  undo(): void {
    if (this.changeHistory.length < 2) return;
    
    const previous = this.changeHistory[this.changeHistory.length - 2];
    this.state = { ...previous.previousState };
    this.notifyListeners(this.state);
  }

  canUndo(): boolean {
    return this.changeHistory.length > 1;
  }

  // Batch update support
  batchUpdate(updates: Array<Partial<T> | ((prev: T) => T)>): void {
    const prevState = this.state;
    let newState = { ...prevState };
    
    for (const update of updates) {
      if (typeof update === 'function') {
        newState = update(newState);
      } else {
        newState = { ...newState, ...update };
      }
    }
    
    this.setState(newState);
  }

  // Subscribe to specific state changes
  subscribeTo<K extends keyof T>(
    key: K, 
    listener: (value: T[K], previousValue: T[K]) => void
  ): () => void {
    let previousValue: T[K] = this.state[key];
    
    return this.subscribe(currentState => {
      const currentValue = currentState[key];
      if (currentValue !== previousValue) {
        listener(currentValue, previousValue);
        previousValue = currentValue;
      }
    });
  }
}