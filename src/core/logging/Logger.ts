// src/core/logging/Logger.ts

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
  correlationId?: string;
  error?: Error;
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private entries: LogEntry[] = [];
  private maxEntries = 1000;
  private listeners: Set<(entry: LogEntry) => void> = new Set();
  private correlationCounter = 0;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  createChildLogger(source: string): Logger {
    const childLogger = new Logger();
    childLogger.setLevel(this.level);
    
    // Override methods to include source
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
      fatal: childLogger.fatal.bind(childLogger)
    };
    
    childLogger.debug = (message: string, data?: any) => 
      originalMethods.debug(message, data, source);
    childLogger.info = (message: string, data?: any) => 
      originalMethods.info(message, data, source);
    childLogger.warn = (message: string, data?: any) => 
      originalMethods.warn(message, data, source);
    childLogger.error = (message: string, data?: any) => 
      originalMethods.error(message, data, source);
    childLogger.fatal = (message: string, data?: any) => 
      originalMethods.fatal(message, data, source);
    
    return childLogger;
  }

  debug(message: string, data?: any, source?: string): void {
    this.log(LogLevel.DEBUG, message, data, source);
  }

  info(message: string, data?: any, source?: string): void {
    this.log(LogLevel.INFO, message, data, source);
  }

  warn(message: string, data?: any, source?: string): void {
    this.log(LogLevel.WARN, message, data, source);
  }

  error(message: string, data?: any, source?: string, error?: Error): void {
    this.log(LogLevel.ERROR, message, data, source, error);
  }

  fatal(message: string, data?: any, source?: string, error?: Error): void {
    this.log(LogLevel.FATAL, message, data, source, error);
  }

  // Structured logging with correlation ID
  logWithContext(
    level: LogLevel,
    message: string,
    context: Record<string, any>,
    source?: string
  ): void {
    const correlationId = this.generateCorrelationId();
    
    this.log(level, message, { ...context, correlationId }, source);
  }

  // Performance logging
  time<T>(label: string, operation: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    const correlationId = this.generateCorrelationId();
    
    try {
      const result = operation();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          this.info(`Operation "${label}" completed`, 
            { duration, correlationId });
        });
      } else {
        const duration = performance.now() - start;
        this.info(`Operation "${label}" completed`, 
          { duration, correlationId });
        return result;
      }
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`Operation "${label}" failed`, 
        { duration, correlationId }, undefined, error as Error);
      throw error;
    }
  }

  // Async performance logging
  async timeAsync<T>(label: string, operation: () => Promise<T>): Promise<T> {
    return this.time(label, operation) as Promise<T>;
  }

  // Memory usage logging
  logMemoryUsage(label?: string): void {
    if (typeof (performance as any).memory !== 'undefined') {
      const memory = (performance as any).memory;
      const data = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
        label
      };
      
      this.debug('Memory usage', data);
    }
  }

  // Log event
  logEvent(eventName: string, data?: any, source?: string): void {
    this.info(`Event: ${eventName}`, data, source);
  }

  // Add log listener
  addListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Remove log listener
  removeListener(listener: (entry: LogEntry) => void): void {
    this.listeners.delete(listener);
  }

  private log(
    level: LogLevel, 
    message: string, 
    data?: any, 
    source?: string, 
    error?: Error
  ): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      source,
      correlationId: this.generateCorrelationId(),
      error
    };

    this.entries.push(entry);
    this.trimEntries();
    this.notifyListeners(entry);
    this.outputToConsole(entry);
  }

  private trimEntries(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    });
  }

  private outputToConsole(entry: LogEntry): void {
    const { level, message, data, source, error } = entry;
    const sourceLabel = source ? `[${source}] ` : '';
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`${sourceLabel}${message}`, data);
        break;
      case LogLevel.INFO:
        console.info(`${sourceLabel}${message}`, data);
        break;
      case LogLevel.WARN:
        console.warn(`${sourceLabel}${message}`, data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(`${sourceLabel}${message}`, data, error);
        break;
    }
  }

  private generateCorrelationId(): string {
    return `log_${Date.now()}_${++this.correlationCounter}`;
  }

  // Query methods
  getEntries(level?: LogLevel): LogEntry[] {
    return level !== undefined 
      ? this.entries.filter(entry => entry.level === level)
      : [...this.entries];
  }

  getEntriesBySource(source: string): LogEntry[] {
    return this.entries.filter(entry => entry.source === source);
  }

  getEntriesByLevel(level: LogLevel, source?: string): LogEntry[] {
    return this.entries.filter(entry => {
      if (entry.level !== level) return false;
      if (source && entry.source !== source) return false;
      return true;
    });
  }

  getRecentEntries(count: number = 10): LogEntry[] {
    return this.entries.slice(-count);
  }

  searchEntries(query: string): LogEntry[] {
    const lowercaseQuery = query.toLowerCase();
    return this.entries.filter(entry => 
      entry.message.toLowerCase().includes(lowercaseQuery) ||
      entry.source?.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Export and clear
  exportLogs(): string {
    return this.entries
      .map(entry => {
        const levelName = Object.keys(LogLevel)[entry.level];
        const source = entry.source ? `[${entry.source}] ` : '';
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
        const error = entry.error ? ` Error: ${entry.error.message}` : '';
        
        return `[${entry.timestamp.toISOString()}] [${levelName}] ${source}${entry.message}${data}${error}`;
      })
      .join('\n');
  }

  exportLogsAsJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  clear(): void {
    this.entries = [];
  }

  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    oldest: Date | null;
    newest: Date | null;
  } {
    const stats = {
      total: this.entries.length,
      byLevel: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      oldest: this.entries[0]?.timestamp || null,
      newest: this.entries[this.entries.length - 1]?.timestamp || null
    };

    this.entries.forEach(entry => {
      const levelName = Object.keys(LogLevel)[entry.level];
      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;
      
      if (entry.source) {
        stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
      }
    });

    return stats;
  }

  // Batch operations
  batchLog(entries: Array<{
    level: LogLevel;
    message: string;
    data?: any;
    source?: string;
  }>): void {
    entries.forEach(entry => {
      this.log(entry.level, entry.message, entry.data, entry.source);
    });
  }

  // Context manager
  withContext(context: Record<string, any>): Logger {
    const contextLogger = this.createChildLogger('context');
    
    const originalLog = contextLogger.log.bind(contextLogger);
    contextLogger.log = (level: LogLevel, message: string, data?: any, source?: string, error?: Error) => {
      const enrichedData = { ...context, ...data };
      originalLog(level, message, enrichedData, source, error);
    };
    
    return contextLogger;
  }
}