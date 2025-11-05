// src/core/performance/PerformanceMonitor.ts

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  category: 'timing' | 'memory' | 'network' | 'custom';
  tags?: Record<string, string | number>;
}

interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    averageTimings: Record<string, number>;
    memoryUsage: MemoryUsage;
    renderPerformance: RenderMetrics;
    networkMetrics: NetworkMetrics;
    errorRates: Record<string, number>;
  };
  recommendations: string[];
}

interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface RenderMetrics {
  averageFrameTime: number;
  fps: number;
  droppedFrames: number;
  paintTiming: PaintTiming;
  layoutMetrics: LayoutMetrics;
}

interface PaintTiming {
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
}

interface LayoutMetrics {
  reflows: number;
  layoutShifts: number;
  elementCount: number;
}

interface NetworkMetrics {
  averageRequestTime: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseSize: number;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private timers: Map<string, number> = new Map();
  private startTime = Date.now();
  private maxMetrics = 1000;
  private eventCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  // Timing measurements
  startTimer(name: string): void {
    performance.mark(`${name}_start`);
    this.timers.set(name, performance.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer "${name}" was not started`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    performance.mark(`${name}_end`);
    performance.measure(name, `${name}_start`, `${name}_end`);
    
    this.recordMetric({
      name,
      value: duration,
      timestamp: new Date(),
      unit: 'ms',
      category: 'timing'
    });

    this.timers.delete(name);
    return duration;
  }

  // Memory monitoring
  getMemoryUsage(): MemoryUsage {
    if (typeof (performance as any).memory !== 'undefined') {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.totalJSHeapSize;
      
      return {
        used,
        total,
        percentage: Math.round((used / total) * 100),
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: memory.external || 0,
        arrayBuffers: memory.arrayBuffers || 0
      };
    }
    
    return { 
      used: 0, 
      total: 0, 
      percentage: 0, 
      heapUsed: 0, 
      heapTotal: 0, 
      external: 0, 
      arrayBuffers: 0 
    };
  }

  // Memory metrics recording
  recordMemoryMetrics(): void {
    const usage = this.getMemoryUsage();
    
    this.recordMetric({
      name: 'memory_used',
      value: usage.used,
      timestamp: new Date(),
      unit: 'bytes',
      category: 'memory',
      tags: { percentage: usage.percentage }
    });

    this.recordMetric({
      name: 'memory_percentage',
      value: usage.percentage,
      timestamp: new Date(),
      unit: 'percentage',
      category: 'memory'
    });
  }

  // Network monitoring
  monitorNetworkRequests(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.recordMetric({
            name: `network_${this.extractResourceType(entry.name)}`,
            value: entry.duration,
            timestamp: new Date(entry.startTime),
            unit: 'ms',
            category: 'network',
            tags: {
              url: entry.name,
              size: (entry as any).transferSize || 0
            }
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['resource'] });
    this.observers.set('network', observer);
  }

  // User timing monitoring
  measureUserTiming(name: string, startMark: string, endMark: string): void {
    const measureName = `${name}_measurement`;
    
    try {
      performance.measure(measureName, startMark, endMark);
      const measure = performance.getEntriesByName(measureName, 'measure')[0];
      
      if (measure) {
        this.recordMetric({
          name,
          value: measure.duration,
          timestamp: new Date(),
          unit: 'ms',
          category: 'timing'
        });
      }
    } catch (error) {
      console.warn(`Failed to measure user timing "${name}":`, error);
    }
  }

  // Custom metrics
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last maxMetrics to prevent memory issues
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Event counting
  countEvent(eventName: string, count: number = 1): void {
    const current = this.eventCounts.get(eventName) || 0;
    this.eventCounts.set(eventName, current + count);
    
    this.recordMetric({
      name: `event_${eventName}`,
      value: current + count,
      timestamp: new Date(),
      unit: 'count',
      category: 'custom'
    });
  }

  // Error tracking
  countError(errorType: string, count: number = 1): void {
    const current = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, current + count);
    
    this.recordMetric({
      name: `error_${errorType}`,
      value: current + count,
      timestamp: new Date(),
      unit: 'count',
      category: 'custom'
    });
  }

  // Reporting
  generateReport(): PerformanceReport {
    const memoryUsage = this.getMemoryUsage();
    const timingMetrics = this.getTimingMetrics();
    const renderMetrics = this.calculateRenderMetrics();
    const networkMetrics = this.calculateNetworkMetrics();
    const errorRates = this.calculateErrorRates();
    const recommendations = this.generateRecommendations(memoryUsage, timingMetrics, networkMetrics);

    return {
      metrics: [...this.metrics],
      summary: {
        averageTimings: timingMetrics,
        memoryUsage,
        renderPerformance: renderMetrics,
        networkMetrics,
        errorRates
      },
      recommendations
    };
  }

  // Performance analysis
  analyzePerformance(thresholds?: {
    memoryUsage?: number;
    responseTime?: number;
    errorRate?: number;
  }): {
    status: 'good' | 'warning' | 'critical';
    issues: Array<{ type: string; message: string; value: number; threshold: number }>;
    suggestions: string[];
  } {
    const issues: Array<{ type: string; message: string; value: number; threshold: number }> = [];
    const suggestions: string[] = [];
    let status: 'good' | 'warning' | 'critical' = 'good';

    const memoryUsage = this.getMemoryUsage();
    const thresholds = {
      memoryUsage: thresholds?.memoryUsage || 80, // 80% memory usage
      responseTime: thresholds?.responseTime || 1000, // 1 second
      errorRate: thresholds?.errorRate || 5 // 5% error rate
    };

    // Check memory usage
    if (memoryUsage.percentage > thresholds.memoryUsage) {
      issues.push({
        type: 'memory',
        message: `High memory usage: ${memoryUsage.percentage}%`,
        value: memoryUsage.percentage,
        threshold: thresholds.memoryUsage
      });
      status = 'warning';
      suggestions.push('Consider implementing memory cleanup or optimization');
    }

    // Check average response times
    const avgTimings = this.getAverageTimings();
    for (const [operation, time] of Object.entries(avgTimings)) {
      if (time > thresholds.responseTime) {
        issues.push({
          type: 'performance',
          message: `Slow operation "${operation}": ${time.toFixed(2)}ms`,
          value: time,
          threshold: thresholds.responseTime
        });
        status = 'critical';
        suggestions.push(`Optimize "${operation}" operation`);
      }
    }

    // Check error rates
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    const totalEvents = Array.from(this.eventCounts.values()).reduce((a, b) => a + b, 0);
    const errorRate = totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0;

    if (errorRate > thresholds.errorRate) {
      issues.push({
        type: 'errors',
        message: `High error rate: ${errorRate.toFixed(2)}%`,
        value: errorRate,
        threshold: thresholds.errorRate
      });
      status = 'warning';
      suggestions.push('Review error handling and improve robustness');
    }

    if (issues.length === 0) {
      suggestions.push('Performance is within acceptable ranges');
    }

    return { status, issues, suggestions };
  }

  // Utility methods
  private getTimingMetrics(): Record<string, number> {
    const timingMetrics = this.metrics
      .filter(m => m.category === 'timing')
      .reduce((acc, metric) => {
        if (!acc[metric.name]) {
          acc[metric.name] = [];
        }
        acc[metric.name].push(metric.value);
        return acc;
      }, {} as Record<string, number[]>);

    const averageTimings: Record<string, number> = {};
    for (const [name, values] of Object.entries(timingMetrics)) {
      averageTimings[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    return averageTimings;
  }

  private getAverageTimings(): Record<string, number> {
    return this.getTimingMetrics();
  }

  private calculateRenderMetrics(): RenderMetrics {
    // This is a simplified calculation
    // In a real implementation, you would monitor frame rates and dropped frames
    return {
      averageFrameTime: 16.67, // 60 FPS target
      fps: 60,
      droppedFrames: 0,
      paintTiming: {
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0
      },
      layoutMetrics: {
        reflows: 0,
        layoutShifts: 0,
        elementCount: 0
      }
    };
  }

  private calculateNetworkMetrics(): NetworkMetrics {
    const networkMetrics = this.metrics.filter(m => m.category === 'network');
    
    if (networkMetrics.length === 0) {
      return {
        averageRequestTime: 0,
        totalRequests: 0,
        failedRequests: 0,
        averageResponseSize: 0,
        cacheHitRate: 0
      };
    }

    const averageRequestTime = networkMetrics.reduce((sum, m) => sum + m.value, 0) / networkMetrics.length;
    
    return {
      averageRequestTime,
      totalRequests: networkMetrics.length,
      failedRequests: networkMetrics.filter(m => m.value === 0).length,
      averageResponseSize: networkMetrics.reduce((sum, m) => sum + (m.tags?.size || 0), 0) / networkMetrics.length,
      cacheHitRate: 0 // Would need additional logic to calculate
    };
  }

  private calculateErrorRates(): Record<string, number> {
    const errorRates: Record<string, number> = {};
    
    for (const [errorType, count] of this.errorCounts.entries()) {
      const eventCount = this.eventCounts.get(errorType) || 1;
      errorRates[errorType] = (count / eventCount) * 100;
    }
    
    return errorRates;
  }

  private generateRecommendations(
    memoryUsage: MemoryUsage,
    timingMetrics: Record<string, number>,
    networkMetrics: NetworkMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (memoryUsage.percentage > 70) {
      recommendations.push('Consider implementing memory optimization');
    }

    // Performance recommendations
    const slowOperations = Object.entries(timingMetrics)
      .filter(([_, time]) => time > 500)
      .map(([operation, _]) => operation);
    
    if (slowOperations.length > 0) {
      recommendations.push(`Optimize slow operations: ${slowOperations.join(', ')}`);
    }

    // Network recommendations
    if (networkMetrics.averageRequestTime > 1000) {
      recommendations.push('Consider implementing request caching');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal');
    }

    return recommendations;
  }

  private extractResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const resourceTypes: Record<string, string> = {
      'js': 'script',
      'css': 'stylesheet',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'json': 'json',
      'xml': 'xml'
    };
    
    return extension && resourceTypes[extension] ? resourceTypes[extension] : 'other';
  }

  // Cleanup
  dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics = [];
    this.timers.clear();
    this.eventCounts.clear();
    this.errorCounts.clear();
  }

  // Export methods
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  exportReport(): string {
    return JSON.stringify(this.generateReport(), null, 2);
  }

  // Real-time monitoring
  startContinuousMonitoring(intervalMs: number = 60000): void {
    setInterval(() => {
      this.recordMemoryMetrics();
      this.countEvent('monitoring_tick');
    }, intervalMs);
  }
}