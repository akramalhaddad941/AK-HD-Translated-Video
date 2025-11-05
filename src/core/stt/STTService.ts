// src/core/stt/STTService.ts

export interface STTService {
  // Core functionality
  startSession(config: STTConfig): Promise<STTSession>;
  stopSession(sessionId: string): Promise<void>;
  
  // Real-time processing
  processAudio(audioData: ArrayBuffer): Promise<STTResult>;
  streamProcess(audioStream: MediaStream): AsyncGenerator<STTResult>;
  
  // Configuration
  setConfig(config: Partial<STTConfig>): void;
  getConfig(): STTConfig;
  
  // Capabilities
  isSupported(): boolean;
  getSupportedLanguages(): string[];
  getAvailableEngines(): STTEngine[];
}

export interface STTConfig {
  // Language settings
  sourceLanguage: string;
  targetLanguage?: string;
  
  // Engine configuration
  engine: STTEngine;
  apiKey?: string;
  endpoint?: string;
  
  // Audio settings
  sampleRate: number;
  channels: number;
  bitDepth: number;
  
  // Processing options
  enableNoiseReduction: boolean;
  enableVAD: boolean;
  vadSensitivity: number; // 0-1
  maxPhraseDuration: number; // seconds
  
  // Real-time options
  partialResults: boolean;
  interimResults: boolean;
  autoStop: boolean;
  
  // Quality settings
  accuracy: 'fast' | 'balanced' | 'high';
  confidenceThreshold: number;
}

export type STTEngine = 'webspeech' | 'google' | 'azure' | 'whisper' | 'custom';

export interface STTSession {
  id: string;
  config: STTConfig;
  isActive: boolean;
  startTime: Date;
  duration: number;
  audioProcessed: number; // bytes
  transcripts: STTTranscript[];
  statistics: STTSessionStatistics;
}

export interface STTResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
  duration: number;
  language?: string;
  alternatives?: STTAlternative[];
  metadata?: STTMetadata;
}

export interface STTAlternative {
  text: string;
  confidence: number;
}

export interface STTMetadata {
  words?: STTWord[];
  emotions?: string[];
  speaker?: string;
  noiseLevel?: number;
}

export interface STTWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface STTTranscript {
  id: string;
  result: STTResult;
  processedAt: Date;
  processingTime: number;
}

export interface STTSessionStatistics {
  totalDuration: number;
  averageConfidence: number;
  wordsPerMinute: number;
  silenceRatio: number;
  errorRate: number;
}

// Error types
export class STTError extends Error {
  constructor(
    message: string,
    public code: string,
    public engine: STTEngine
  ) {
    super(message);
    this.name = 'STTError';
  }
}

export class STTConfigurationError extends STTError {
  constructor(message: string, engine: STTEngine) {
    super(message, 'CONFIGURATION_ERROR', engine);
    this.name = 'STTConfigurationError';
  }
}

export class STTNetworkError extends STTError {
  constructor(message: string, engine: STTEngine) {
    super(message, 'NETWORK_ERROR', engine);
    this.name = 'STTNetworkError';
  }
}

export class STTAudioError extends STTError {
  constructor(message: string, engine: STTEngine) {
    super(message, 'AUDIO_ERROR', engine);
    this.name = 'STTAudioError';
  }
}