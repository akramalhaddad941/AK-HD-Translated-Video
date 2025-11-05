// src/core/engine/CoreEngine.ts

import { EventSystem } from '@/events/EventSystem';
import { ExtensionStateManager } from '@/state/StateManager';
import { PluginManager, Plugin } from '@/plugins/PluginManager';
import { Logger } from '@/logging/Logger';
import { PerformanceMonitor } from '@/performance/PerformanceMonitor';
import { ApplicationState } from '@/types/application.state';
import { initializeCoreEvents, CoreEvents, createEventHelpers } from '@/events/coreEvents';

export interface CoreEngineConfig {
  version: string;
  debugMode: boolean;
  enablePerformanceMonitoring: boolean;
  enablePluginSystem: boolean;
  maxLogEntries: number;
  performanceThresholds: {
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface EngineStatus {
  isInitialized: boolean;
  isActive: boolean;
  version: string;
  uptime: number;
  loadedPlugins: number;
  totalEvents: number;
  memoryUsage: number;
  performance: {
    status: 'good' | 'warning' | 'critical';
    issues: number;
    recommendations: number;
  };
}

export class CoreEngine {
  private eventSystem: EventSystem;
  private stateManager: ExtensionStateManager<ApplicationState>;
  private pluginManager?: PluginManager;
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private config: CoreEngineConfig;
  private eventHelpers: ReturnType<typeof createEventHelpers>;
  private startTime: number;
  private isShuttingDown = false;

  constructor(config: CoreEngineConfig) {
    this.config = config;
    this.startTime = Date.now();
    
    // Initialize core components
    this.logger = new Logger();
    this.logger.setLevel(config.debugMode ? 0 : 1); // DEBUG or INFO
    
    this.eventSystem = new EventSystem();
    this.stateManager = new ExtensionStateManager<ApplicationState>({
      isInitialized: false,
      isActive: false,
      currentMode: 'manual',
      sourceLanguage: 'auto',
      targetLanguage: 'en',
      isTranslating: false,
      translationProgress: 0,
      isVisible: false,
      position: { x: 100, y: 100 },
      theme: 'auto',
      isOptimized: false,
      processingSpeed: 'balanced',
      selectedExpert: null,
      expertSuggestions: [],
      hasUnsavedChanges: false,
      lastSavedAt: null,
      error: null,
      errorCount: 0
    });
    
    this.performanceMonitor = new PerformanceMonitor();
    this.eventHelpers = createEventHelpers(this.eventSystem);
    
    // Initialize plugin manager if enabled
    if (config.enablePluginSystem) {
      this.pluginManager = new PluginManager(
        this.eventSystem,
        this.stateManager,
        this.logger.createChildLogger('PluginManager')
      );
    }
    
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot initialize while shutting down');
    }
    
    this.logger.info('Initializing Core Engine...');
    
    try {
      // Start performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.startTimer('engine_initialization');
        this.performanceMonitor.startContinuousMonitoring(60000); // Monitor every minute
        this.performanceMonitor.monitorNetworkRequests();
      }
      
      // Initialize core events
      initializeCoreEvents(this.eventSystem);
      
      // Set up event listeners
      this.setupCoreEventHandlers();
      
      // Mark as initialized
      this.stateManager.setState({
        isInitialized: true
      });
      
      // Emit initialization event
      await this.eventHelpers.initialize(this.config.version);
      
      this.performanceMonitor.endTimer('engine_initialization');
      
      this.logger.info(`Core Engine initialized successfully (v${this.config.version})`);
      
    } catch (error) {
      this.logger.error('Failed to initialize Core Engine', null, 'CoreEngine', error as Error);
      throw error;
    }
  }

  async activate(mode: ApplicationState['currentMode'] = 'manual'): Promise<void> {
    if (!this.stateManager.getState().isInitialized) {
      throw new Error('Engine must be initialized before activation');
    }
    
    this.logger.info(`Activating Core Engine in ${mode} mode...`);
    
    try {
      // Update state
      this.stateManager.setState({
        isActive: true,
        currentMode: mode
      });
      
      // Emit activation event
      await this.eventHelpers.activate(mode);
      
      // Load essential plugins
      if (this.pluginManager) {
        await this.loadEssentialPlugins();
      }
      
      this.logger.info('Core Engine activated successfully');
      
    } catch (error) {
      this.logger.error('Failed to activate Core Engine', null, 'CoreEngine', error as Error);
      throw error;
    }
  }

  async deactivate(reason: string = 'manual'): Promise<void> {
    if (!this.stateManager.getState().isActive) {
      return; // Already deactivated
    }
    
    this.logger.info(`Deactivating Core Engine: ${reason}`);
    
    try {
      // Update state
      this.stateManager.setState({
        isActive: false
      });
      
      // Emit deactivation event
      await this.eventHelpers.deactivate(reason);
      
      // Unload non-essential plugins
      if (this.pluginManager) {
        await this.unloadNonEssentialPlugins();
      }
      
      this.logger.info('Core Engine deactivated successfully');
      
    } catch (error) {
      this.logger.error('Failed to deactivate Core Engine', null, 'CoreEngine', error as Error);
      // Don't throw - deactivation should be graceful
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return; // Already shutting down
    }
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down Core Engine...');
    
    try {
      // Deactivate first
      await this.deactivate('shutdown');
      
      // Clear all events
      this.eventSystem.clear();
      
      // Dispose performance monitor
      this.performanceMonitor.dispose();
      
      // Emit shutdown event
      await this.eventSystem.emit(CoreEvents.SHUTDOWN, {
        reason: 'engine_shutdown',
        uptime: Date.now() - this.startTime
      });
      
      // Clear logs
      this.logger.clear();
      
      this.logger.info('Core Engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during Core Engine shutdown', null, 'CoreEngine', error as Error);
      // Continue shutdown even if there are errors
    }
  }

  // Plugin management
  async loadPlugin(plugin: Plugin): Promise<void> {
    if (!this.pluginManager) {
      throw new Error('Plugin system is not enabled');
    }
    
    this.logger.info(`Loading plugin: ${plugin.name}`);
    await this.pluginManager.loadPlugin(plugin);
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    if (!this.pluginManager) {
      throw new Error('Plugin system is not enabled');
    }
    
    this.logger.info(`Unloading plugin: ${pluginName}`);
    await this.pluginManager.unloadPlugin(pluginName);
  }

  getPluginManager(): PluginManager | undefined {
    return this.pluginManager;
  }

  // State management
  getStateManager(): ExtensionStateManager<ApplicationState> {
    return this.stateManager;
  }

  // Event system
  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  // Logger
  getLogger(): Logger {
    return this.logger;
  }

  // Performance monitoring
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  // Status and health
  getStatus(): EngineStatus {
    const state = this.stateManager.getState();
    const performance = this.performanceMonitor.analyzePerformance(this.config.performanceThresholds);
    const pluginCount = this.pluginManager?.getAllPlugins().length || 0;
    const eventStats = this.eventSystem.getEventStats();
    
    return {
      isInitialized: state.isInitialized,
      isActive: state.isActive,
      version: this.config.version,
      uptime: Date.now() - this.startTime,
      loadedPlugins: pluginCount,
      totalEvents: Object.values(eventStats).reduce((sum: number, stats: any) => sum + (stats?.count || 0), 0),
      memoryUsage: this.performanceMonitor.getMemoryUsage().percentage,
      performance: {
        status: performance.status,
        issues: performance.issues.length,
        recommendations: performance.suggestions.length
      }
    };
  }

  getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical';
    details: {
      initialization: boolean;
      activation: boolean;
      memory: { usage: number; status: 'good' | 'warning' | 'critical' };
      performance: { status: 'good' | 'warning' | 'critical'; issues: number };
      plugins: { loaded: number; errors: number };
      errors: { total: number; recent: number };
    };
    recommendations: string[];
  } {
    const state = this.stateManager.getState();
    const memoryUsage = this.performanceMonitor.getMemoryUsage();
    const performance = this.performanceMonitor.analyzePerformance(this.config.performanceThresholds);
    const pluginCount = this.pluginManager?.getAllPlugins().length || 0;
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    
    // Check initialization
    if (!state.isInitialized) {
      overallStatus = 'critical';
      recommendations.push('Engine is not initialized');
    }
    
    // Check memory usage
    let memoryStatus: 'good' | 'warning' | 'critical' = 'good';
    if (memoryUsage.percentage > 90) {
      memoryStatus = 'critical';
      overallStatus = 'critical';
      recommendations.push('Memory usage is critically high');
    } else if (memoryUsage.percentage > 75) {
      memoryStatus = 'warning';
      if (overallStatus === 'healthy') overallStatus = 'warning';
      recommendations.push('Memory usage is high');
    }
    
    // Check performance
    if (performance.status === 'critical') {
      overallStatus = 'critical';
      recommendations.push(...performance.suggestions);
    } else if (performance.status === 'warning' && overallStatus === 'healthy') {
      overallStatus = 'warning';
      recommendations.push(...performance.suggestions);
    }
    
    // Check errors
    if (state.errorCount > 10) {
      overallStatus = 'warning';
      recommendations.push('High number of errors detected');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is running optimally');
    }
    
    return {
      status: overallStatus,
      details: {
        initialization: state.isInitialized,
        activation: state.isActive,
        memory: {
          usage: memoryUsage.percentage,
          status: memoryStatus
        },
        performance: {
          status: performance.status,
          issues: performance.issues.length
        },
        plugins: {
          loaded: pluginCount,
          errors: 0 // Would need plugin error tracking
        },
        errors: {
          total: state.errorCount,
          recent: 0 // Would need recent error tracking
        }
      },
      recommendations
    };
  }

  // Configuration
  updateConfig(newConfig: Partial<CoreEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update logger level if debug mode changed
    if (newConfig.debugMode !== undefined) {
      this.logger.setLevel(newConfig.debugMode ? 0 : 1);
    }
  }

  getConfig(): CoreEngineConfig {
    return { ...this.config };
  }

  private setupEventListeners(): void {
    // Listen for system events
    this.eventSystem.on(CoreEvents.INITIALIZE, (data) => {
      this.logger.info('Engine initialization completed', data);
    });
    
    this.eventSystem.on(CoreEvents.TRANSLATION_ERROR, (data) => {
      this.performanceMonitor.countError('translation_error');
      this.stateManager.setState(prev => ({
        error: data.error,
        errorCount: prev.errorCount + 1
      }));
    });
    
    this.eventSystem.on(CoreEvents.PERFORMANCE_METRIC, (data) => {
      // Handle performance metrics
      this.logger.debug('Performance metric recorded', data);
    });
  }

  private setupCoreEventHandlers(): void {
    // Handle initialization
    this.eventSystem.on(CoreEvents.INITIALIZE, async (data) => {
      this.logger.info('Core initialization event received', data);
    });
    
    // Handle activation
    this.eventSystem.on(CoreEvents.ACTIVATE, async (data) => {
      this.logger.info('Core activation event received', data);
    });
    
    // Handle deactivation
    this.eventSystem.on(CoreEvents.DEACTIVATE, async (data) => {
      this.logger.info('Core deactivation event received', data);
    });
  }

  private async loadEssentialPlugins(): Promise<void> {
    // This would load essential plugins for basic functionality
    // Implementation depends on the plugin architecture
    this.logger.debug('Loading essential plugins...');
  }

  private async unloadNonEssentialPlugins(): Promise<void> {
    // This would unload plugins that aren't essential for basic operation
    this.logger.debug('Unloading non-essential plugins...');
  }

  // Public API for plugin and extension developers
  public getPublicAPI() {
    return {
      // Event system
      on: <T>(eventName: string, handler: (data: T) => void) => 
        this.eventSystem.on(eventName, handler),
      
      emit: <T>(eventName: string, data: T) => 
        this.eventSystem.emit(eventName, data),
      
      // State management
      getState: () => this.stateManager.getState(),
      setState: (updater: Partial<ApplicationState>) => 
        this.stateManager.setState(updater),
      
      // Performance monitoring
      recordMetric: (metric: any) => 
        this.performanceMonitor.recordMetric(metric),
      
      // Logging
      log: (level: string, message: string, data?: any) => {
        const logLevel = level.toLowerCase();
        if (logLevel === 'debug') this.logger.debug(message, data, 'Plugin');
        else if (logLevel === 'info') this.logger.info(message, data, 'Plugin');
        else if (logLevel === 'warn') this.logger.warn(message, data, 'Plugin');
        else if (logLevel === 'error') this.logger.error(message, data, 'Plugin');
      }
    };
  }
}