// src/core/events/EventSystem.ts

import { EventHandler, EventDefinition } from '@/types/events';

export class EventSystem {
  private events: Map<string, Set<EventHandler>> = new Map();
  private eventDefinitions: Map<string, EventDefinition> = new Map();
  private eventQueue: Array<{ name: string; data: any; timestamp: number }> = [];
  private isProcessing = false;
  private maxQueueSize = 1000;
  private eventStats = new Map<string, {
    count: number;
    lastTriggered: number;
    averageDelay: number;
  }>();

  // Register Event Definition
  registerEvent(definition: EventDefinition): void {
    this.eventDefinitions.set(definition.name, definition);
    
    if (!this.events.has(definition.name)) {
      this.events.set(definition.name, new Set());
    }
  }

  // Subscribe to Event
  on<T>(eventName: string, handler: EventHandler<T>): () => void {
    this.ensureEventRegistered(eventName);
    
    const handlers = this.events.get(eventName)!;
    handlers.add(handler as EventHandler);
    
    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler);
    };
  }

  // Subscribe once (auto-unsubscribe after first call)
  once<T>(eventName: string, handler: EventHandler<T>): () => void {
    this.ensureEventRegistered(eventName);
    
    let active = true;
    const wrappedHandler: EventHandler<T> = (data: T) => {
      if (!active) return;
      active = false;
      
      try {
        return handler(data);
      } finally {
        this.off(eventName, wrappedHandler);
      }
    };
    
    return this.on(eventName, wrappedHandler);
  }

  // Emit Event
  async emit<T>(eventName: string, data: T): Promise<void> {
    this.ensureEventRegistered(eventName);
    
    const startTime = performance.now();
    const handlers = this.events.get(eventName);
    
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    
    handlers.forEach(handler => {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for "${eventName}":`, error);
      }
    });

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
    
    // Update statistics
    this.updateEventStats(eventName, startTime);
  }

  // Emit Event with debouncing
  emitDebounced<T>(eventName: string, data: T, delay: number = 100): void {
    const existingIndex = this.eventQueue.findIndex(
      event => event.name === eventName
    );
    
    if (existingIndex !== -1) {
      // Update existing queued event
      this.eventQueue[existingIndex].data = data;
      this.eventQueue[existingIndex].timestamp = performance.now();
    } else {
      // Add new queued event
      this.eventQueue.push({
        name: eventName,
        data,
        timestamp: performance.now()
      });
      
      // Trim queue if needed
      if (this.eventQueue.length > this.maxQueueSize) {
        this.eventQueue = this.eventQueue.slice(-this.maxQueueSize);
      }
    }
    
    // Process queue after delay
    setTimeout(() => {
      this.processEventQueue();
    }, delay);
  }

  // Batch Emit Events
  async emitBatch(events: Array<{ name: string; data: any }>): Promise<void> {
    const promises = events.map(({ name, data }) => this.emit(name, data));
    await Promise.allSettled(promises);
  }

  // Remove Event
  off(eventName: string, handler?: EventHandler): void {
    if (handler) {
      this.events.get(eventName)?.delete(handler);
    } else {
      this.events.delete(eventName);
    }
  }

  // Clear All Events
  clear(): void {
    this.events.clear();
    this.eventDefinitions.clear();
    this.eventQueue = [];
    this.eventStats.clear();
  }

  private ensureEventRegistered(eventName: string): void {
    if (!this.eventDefinitions.has(eventName)) {
      console.warn(`Event "${eventName}" is not registered. Auto-registering...`);
      this.registerEvent({
        name: eventName,
        description: `Auto-registered event: ${eventName}`
      });
    }
  }

  private updateEventStats(eventName: string, startTime: number): void {
    const delay = performance.now() - startTime;
    const stats = this.eventStats.get(eventName) || {
      count: 0,
      lastTriggered: 0,
      averageDelay: 0
    };
    
    stats.count += 1;
    stats.lastTriggered = performance.now();
    stats.averageDelay = (stats.averageDelay * (stats.count - 1) + delay) / stats.count;
    
    this.eventStats.set(eventName, stats);
  }

  private processEventQueue(): void {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      const emitPromises = events.map(({ name, data }) => 
        this.emit(name, data)
      );
      
      Promise.allSettled(emitPromises).finally(() => {
        this.isProcessing = false;
      });
    } catch (error) {
      console.error('Error processing event queue:', error);
      this.isProcessing = false;
    }
  }
}