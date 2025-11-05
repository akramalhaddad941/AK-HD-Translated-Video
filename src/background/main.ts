// src/background/main.ts

import { CoreEngine } from '@/core/engine/CoreEngine';
import { AudioSessionManager } from '@/core/stt/AudioSessionManager';
import { WebSpeechService } from '@/core/stt/services/WebSpeechService';
import { AudioProcessorImpl } from '@/core/audio/AudioProcessor';
import { VoiceActivityDetector } from '@/core/audio/VAD';
import { createEventHelpers } from '@/core/events/coreEvents';

// Core engine configuration
const engineConfig = {
  version: '1.0.0',
  debugMode: false,
  enablePerformanceMonitoring: true,
  enablePluginSystem: true,
  maxLogEntries: 1000,
  performanceThresholds: {
    memoryUsage: 80,
    responseTime: 1000,
    errorRate: 5
  }
};

// Global instances
let coreEngine: CoreEngine;
let audioSessionManager: AudioSessionManager;

// Initialize the extension
async function initializeExtension() {
  try {
    // Initialize core engine
    coreEngine = new CoreEngine(engineConfig);
    await coreEngine.initialize();
    
    // Initialize audio session manager
    const webSpeechService = new WebSpeechService();
    const audioProcessor = new AudioProcessorImpl({
      sampleRate: 44100,
      channels: 1,
      bitDepth: 16,
      format: 'wav',
      enableNormalization: true,
      enableNoiseReduction: true,
      enableVAD: true,
      targetVolume: 0.7,
      silenceThreshold: 0.01
    });
    
    const vad = new VoiceActivityDetector({
      sampleRate: 44100,
      windowSize: 30,
      hopSize: 15,
      threshold: 0.01,
      minSpeechDuration: 300,
      minSilenceDuration: 500,
      sensitivity: 0.8,
      adaptiveThreshold: true
    });
    
    audioSessionManager = new AudioSessionManager({
      sttService: webSpeechService,
      audioProcessor,
      vad,
      autoStart: false,
      autoStop: true,
      maxSessionDuration: 300000, // 5 minutes
      silenceTimeout: 3000, // 3 seconds
      minConfidence: 0.6,
      enablePartialResults: true,
      audioConfig: {
        sampleRate: 44100,
        channels: 1,
        bitDepth: 16,
        format: 'wav',
        enableNormalization: true,
        enableNoiseReduction: true,
        enableVAD: true,
        targetVolume: 0.7,
        silenceThreshold: 0.01
      },
      vadConfig: {
        sampleRate: 44100,
        windowSize: 30,
        hopSize: 15,
        threshold: 0.01,
        minSpeechDuration: 300,
        minSilenceDuration: 500,
        sensitivity: 0.8,
        adaptiveThreshold: true
      }
    });
    
    // Set up message handling
    setupMessageHandling();
    
    // Activate the engine
    await coreEngine.activate('automatic');
    
    console.log('AK-HD Translated Video extension initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Set up message handling between components
function setupMessageHandling() {
  if (!chrome.runtime) return;
  
  // Handle messages from popup and content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async responses
  });
  
  // Handle installation
  chrome.runtime.onInstalled.addListener((details) => {
    handleInstallation(details);
  });
  
  // Handle startup
  chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
  });
}

// Handle incoming messages
async function handleMessage(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
) {
  const { type, data } = message;
  
  try {
    switch (type) {
      case 'INIT_ENGINE':
        if (!coreEngine) {
          await initializeExtension();
        }
        sendResponse({ success: true, data: coreEngine?.getStatus() });
        break;
        
      case 'GET_ENGINE_STATUS':
        sendResponse({ 
          success: true, 
          data: coreEngine?.getStatus() || null 
        });
        break;
        
      case 'START_AUDIO_SESSION':
        if (!audioSessionManager) {
          throw new Error('Audio session manager not initialized');
        }
        const sessionId = await audioSessionManager.createSession(data?.options);
        sendResponse({ success: true, data: { sessionId } });
        break;
        
      case 'STOP_AUDIO_SESSION':
        if (!audioSessionManager || !data?.sessionId) {
          throw new Error('Audio session manager not initialized or session ID missing');
        }
        await audioSessionManager.stopSession(data.sessionId);
        sendResponse({ success: true });
        break;
        
      case 'GET_SESSION_STATUS':
        if (!audioSessionManager || !data?.sessionId) {
          throw new Error('Audio session manager not initialized or session ID missing');
        }
        const session = audioSessionManager.getSession(data.sessionId);
        sendResponse({ 
          success: true, 
          data: session ? {
            isActive: session.isActive,
            isRecording: session.isRecording,
            statistics: session.statistics,
            transcripts: session.transcripts
          } : null 
        });
        break;
        
      case 'GET_ALL_SESSIONS':
        if (!audioSessionManager) {
          throw new Error('Audio session manager not initialized');
        }
        const sessions = audioSessionManager.getAllSessions();
        sendResponse({ 
          success: true, 
          data: sessions.map(s => ({
            id: s.id,
            isActive: s.isActive,
            startTime: s.startTime,
            statistics: s.statistics
          }))
        });
        break;
        
      case 'TRANSLATE_TEXT':
        // Placeholder for translation functionality
        sendResponse({ 
          success: true, 
          data: { 
            originalText: data.text,
            translatedText: `[Translated: ${data.text}]`,
            sourceLanguage: data.sourceLanguage || 'auto',
            targetLanguage: data.targetLanguage || 'en'
          }
        });
        break;
        
      case 'GET_SUPPORTED_LANGUAGES':
        const languages = [
          { code: 'ar-SA', name: 'العربية (السعودية)', nativeName: 'العربية' },
          { code: 'en-US', name: 'English (US)', nativeName: 'English' },
          { code: 'es-ES', name: 'Español (España)', nativeName: 'Español' },
          { code: 'fr-FR', name: 'Français (France)', nativeName: 'Français' },
          { code: 'de-DE', name: 'Deutsch (Deutschland)', nativeName: 'Deutsch' },
          { code: 'it-IT', name: 'Italiano (Italia)', nativeName: 'Italiano' },
          { code: 'pt-BR', name: 'Português (Brasil)', nativeName: 'Português' },
          { code: 'ru-RU', name: 'Русский (Россия)', nativeName: 'Русский' },
          { code: 'ja-JP', name: '日本語 (日本)', nativeName: '日本語' },
          { code: 'ko-KR', name: '한국어 (대한민국)', nativeName: '한국어' },
          { code: 'zh-CN', name: '中文 (简体)', nativeName: '中文(简体)' },
          { code: 'hi-IN', name: 'हिन्दी (भारत)', nativeName: 'हिन्दी' }
        ];
        sendResponse({ success: true, data: languages });
        break;
        
      case 'EXPORT_SESSION_DATA':
        if (!audioSessionManager || !data?.sessionId) {
          throw new Error('Audio session manager not initialized or session ID missing');
        }
        const sessionData = audioSessionManager.exportSessionData(data.sessionId);
        sendResponse({ success: true, data: sessionData });
        break;
        
      case 'CLEAR_ALL_SESSIONS':
        if (!audioSessionManager) {
          throw new Error('Audio session manager not initialized');
        }
        audioSessionManager.clearAllSessions();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ 
          success: false, 
          error: `Unknown message type: ${type}` 
        });
    }
    
  } catch (error) {
    console.error(`Error handling message ${type}:`, error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle extension installation
function handleInstallation(details: chrome.runtime.InstalledDetails) {
  if (details.reason === 'install') {
    console.log('AK-HD Translated Video installed for the first time');
    
    // Set default settings
    chrome.storage.sync.set({
      sourceLanguage: 'ar-SA',
      targetLanguage: 'en-US',
      enableAutoTranslation: false,
      enableVoiceActivityDetection: true,
      enableNoiseReduction: true,
      transcriptionSpeed: 'balanced',
      theme: 'auto'
    });
    
    // Open welcome page or settings
    // chrome.tabs.create({ url: chrome.runtime.getURL('ui/welcome.html') });
    
  } else if (details.reason === 'update') {
    console.log(`AK-HD Translated Video updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}`);
  }
}

// Utility functions
function logMessage(message: string, data?: any) {
  console.log(`[AK-HD-Extension] ${message}`, data);
}

function logError(message: string, error?: any) {
  console.error(`[AK-HD-Extension-ERROR] ${message}`, error);
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeExtension,
    handleMessage,
    handleInstallation
  };
}

// Initialize when service worker starts
initializeExtension();

// Handle service worker lifecycle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      logMessage('Service worker activated');
      return initializeExtension();
    })
  );
});

self.addEventListener('deactivate', (event) => {
  event.waitUntil(
    coreEngine?.shutdown().catch(error => {
      logError('Error during shutdown:', error);
    })
  );
});

// Handle service worker errors
self.addEventListener('error', (event) => {
  logError('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection:', event.reason);
});