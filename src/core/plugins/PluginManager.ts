// src/core/plugins/PluginManager.ts

import { EventSystem } from '@/events/EventSystem';
import { ExtensionStateManager } from '@/state/StateManager';
import { Logger } from '@/logging/Logger';

export interface Plugin {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  initialize: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
  onLoad?: (context: PluginContext) => Promise<void> | void;
  onUnload?: (context: PluginContext) => Promise<void> | void;
  onError?: (error: Error, context: PluginContext) => Promise<void> | void;
}

export interface PluginContext {
  eventSystem: EventSystem;
  stateManager: ExtensionStateManager<any>;
  logger: Logger;
  config: PluginConfig;
  utils: PluginUtils;
}

export interface PluginConfig {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  getAll(): Record<string, any>;
  clear(): void;
}

export interface PluginUtils {
  createStorage: (namespace: string) => PluginStorage;
  createTimer: (callback: () => void, interval: number) => PluginTimer;
  createEventEmitter: <T = any>() => PluginEventEmitter<T>;
}

export interface PluginStorage {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
  keys(): string[];
}

export interface PluginTimer {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface PluginEventEmitter<T = any> {
  on(handler: (data: T) => void): () => void;
  emit(data: T): void;
  once(handler: (data: T) => void): () => void;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: Set<string> = new Set();
  private pluginConfigs: Map<string, PluginConfig> = new Map();
  private pluginUtils: Map<string, PluginUtils> = new Map();
  private loadingOrder: string[] = [];
  private context: PluginContext;

  constructor(
    private eventSystem: EventSystem,
    private stateManager: ExtensionStateManager<any>,
    private logger: Logger
  ) {
    this.context = this.createContext();
  }

  async loadPlugin(plugin: Plugin): Promise<void> {
    if (this.loadedPlugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already loaded`);
    }

    this.logger.info(`Loading plugin: ${plugin.name} v${plugin.version}`);

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.loadedPlugins.has(dep)) {
          throw new Error(
            `Plugin "${plugin.name}" requires "${dep}" to be loaded first`
          );
        }
      }
    }

    try {
      // Create plugin-specific config and utils
      const config = this.createPluginConfig(plugin.name);
      const utils = this.createPluginUtils(plugin.name);
      
      this.pluginConfigs.set(plugin.name, config);
      this.pluginUtils.set(plugin.name, utils);

      // Call initialize
      await plugin.initialize(this.context);
      
      // Call onLoad if defined
      if (plugin.onLoad) {
        await plugin.onLoad(this.context);
      }

      this.plugins.set(plugin.name, plugin);
      this.loadedPlugins.add(plugin.name);
      this.loadingOrder.push(plugin.name);

      this.logger.info(`Plugin "${plugin.name}" loaded successfully`);
      
      // Emit plugin loaded event
      this.eventSystem.emit('plugin.loaded', {
        pluginName: plugin.name,
        version: plugin.version
      });
      
    } catch (error) {
      this.logger.error(`Failed to load plugin "${plugin.name}":`, error);
      
      // Clean up failed plugin
      this.pluginConfigs.delete(plugin.name);
      this.pluginUtils.delete(plugin.name);
      
      // Call onError if defined
      if (plugin.onError && error instanceof Error) {
        await plugin.onError(error, this.context);
      }
      
      throw error;
    }
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" is not loaded`);
    }

    this.logger.info(`Unloading plugin: ${pluginName}`);

    try {
      // Check for dependent plugins
      const dependents = this.getDependentPlugins(pluginName);
      if (dependents.length > 0) {
        throw new Error(
          `Cannot unload "${pluginName}" because it has dependents: ${dependents.join(', ')}`
        );
      }

      // Call onUnload if defined
      if (plugin.onUnload) {
        await plugin.onUnload(this.context);
      }

      // Call destroy if defined
      if (plugin.destroy) {
        await plugin.destroy(this.context);
      }

      this.plugins.delete(pluginName);
      this.loadedPlugins.delete(pluginName);
      this.loadingOrder = this.loadingOrder.filter(name => name !== pluginName);
      this.pluginConfigs.delete(pluginName);
      this.pluginUtils.delete(pluginName);

      this.logger.info(`Plugin "${pluginName}" unloaded successfully`);
      
      // Emit plugin unloaded event
      this.eventSystem.emit('plugin.unloaded', {
        pluginName
      });
      
    } catch (error) {
      this.logger.error(`Failed to unload plugin "${pluginName}":`, error);
      throw error;
    }
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  isPluginLoaded(pluginName: string): boolean {
    return this.loadedPlugins.has(pluginName);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getLoadedPlugins(): Plugin[] {
    return this.getAllPlugins().filter(plugin => 
      this.loadedPlugins.has(plugin.name)
    );
  }

  getPluginConfig(pluginName: string): PluginConfig | undefined {
    return this.pluginConfigs.get(pluginName);
  }

  getPluginUtils(pluginName: string): PluginUtils | undefined {
    return this.pluginUtils.get(pluginName);
  }

  getLoadingOrder(): string[] {
    return [...this.loadingOrder];
  }

  private createContext(): PluginContext {
    return {
      eventSystem: this.eventSystem,
      stateManager: this.stateManager,
      logger: this.logger,
      config: this.createGlobalConfig(),
      utils: this.createGlobalUtils()
    };
  }

  private createGlobalConfig(): PluginConfig {
    return {
      get: (key: string, defaultValue?: any) => {
        // Implement global config access
        return defaultValue;
      },
      set: (key: string, value: any) => {
        // Implement global config set
      },
      has: (key: string) => false,
      delete: (key: string) => {},
      getAll: () => ({}),
      clear: () => {}
    };
  }

  private createGlobalUtils(): PluginUtils {
    return {
      createStorage: (namespace: string) => this.createPluginStorage(namespace),
      createTimer: (callback: () => void, interval: number) => 
        this.createPluginTimer(callback, interval),
      createEventEmitter: () => this.createPluginEventEmitter()
    };
  }

  private createPluginConfig(pluginName: string): PluginConfig {
    const storage = new Map<string, any>();
    
    return {
      get: (key: string, defaultValue?: any) => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      set: (key: string, value: any) => {
        storage.set(key, value);
      },
      has: (key: string) => storage.has(key),
      delete: (key: string) => storage.delete(key),
      getAll: () => Object.fromEntries(storage.entries()),
      clear: () => storage.clear()
    };
  }

  private createPluginUtils(pluginName: string): PluginUtils {
    return {
      createStorage: (namespace: string) => this.createPluginStorage(`${pluginName}:${namespace}`),
      createTimer: (callback: () => void, interval: number) => 
        this.createPluginTimer(callback, interval),
      createEventEmitter: () => this.createPluginEventEmitter()
    };
  }

  private createPluginStorage(namespace: string): PluginStorage {
    const storage = new Map<string, any>();
    
    return {
      get: (key: string, defaultValue?: any) => {
        return storage.has(key) ? storage.get(key) : defaultValue;
      },
      set: (key: string, value: any) => {
        storage.set(key, value);
      },
      delete: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      has: (key: string) => storage.has(key),
      keys: () => Array.from(storage.keys())
    };
  }

  private createPluginTimer(callback: () => void, interval: number): PluginTimer {
    let timerId: NodeJS.Timeout | null = null;
    
    return {
      start: () => {
        if (timerId) return;
        timerId = setInterval(callback, interval);
      },
      stop: () => {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
      },
      isRunning: () => timerId !== null
    };
  }

  private createPluginEventEmitter<T = any>(): PluginEventEmitter<T> {
    const handlers = new Set<(data: T) => void>();
    
    return {
      on: (handler: (data: T) => void) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      emit: (data: T) => {
        handlers.forEach(handler => handler(data));
      },
      once: (handler: (data: T) => void) => {
        const onceHandler = (data: T) => {
          handler(data);
          handlers.delete(onceHandler);
        };
        handlers.add(onceHandler);
        return () => handlers.delete(onceHandler);
      }
    };
  }

  private getDependentPlugins(pluginName: string): string[] {
    const dependents: string[] = [];
    
    for (const [name, plugin] of this.plugins) {
      if (name === pluginName) continue;
      
      if (plugin.dependencies?.includes(pluginName)) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }

  // Debug methods
  dumpPlugins(): void {
    console.table(
      Array.from(this.plugins.entries()).map(([name, plugin]) => ({
        name,
        version: plugin.version,
        description: plugin.description || '',
        loaded: this.loadedPlugins.has(name),
        dependencies: plugin.dependencies?.join(', ') || 'none'
      }))
    );
  }

  validatePlugins(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const plugin of this.plugins.values()) {
      // Check for circular dependencies
      const dependencyErrors = this.checkCircularDependencies(plugin);
      errors.push(...dependencyErrors);
      
      // Check if dependencies are loaded
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!this.loadedPlugins.has(dep)) {
            errors.push(`Plugin "${plugin.name}" depends on "${dep}" which is not loaded`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private checkCircularDependencies(plugin: Plugin): string[] {
    const errors: string[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    
    const dfs = (currentPlugin: Plugin) => {
      if (stack.has(currentPlugin.name)) {
        errors.push(`Circular dependency detected: ${currentPlugin.name}`);
        return;
      }
      
      if (visited.has(currentPlugin.name)) {
        return;
      }
      
      visited.add(currentPlugin.name);
      stack.add(currentPlugin.name);
      
      if (currentPlugin.dependencies) {
        for (const depName of currentPlugin.dependencies) {
          const depPlugin = this.plugins.get(depName);
          if (depPlugin) {
            dfs(depPlugin);
          }
        }
      }
      
      stack.delete(currentPlugin.name);
    };
    
    dfs(plugin);
    return errors;
  }
}