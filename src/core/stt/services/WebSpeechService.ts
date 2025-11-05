// src/core/stt/services/WebSpeechService.ts

import { 
  STTService, 
  STTConfig, 
  STTResult, 
  STTSession, 
  STTEngine,
  STTConfigurationError,
  STTNetworkError,
  STTAudioError
} from '@/core/stt/STTService';

export class WebSpeechService implements STTService {
  private recognition: SpeechRecognition | null = null;
  private config: STTConfig;
  private isInitialized = false;
  private sessionCallbacks: {
    onResult?: (result: STTResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
  } = {};
  private activeSession: STTSession | null = null;

  constructor() {
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  private getDefaultConfig(): STTConfig {
    return {
      sourceLanguage: 'ar-SA',
      targetLanguage: undefined,
      engine: 'webspeech',
      sampleRate: 44100,
      channels: 1,
      bitDepth: 16,
      enableNoiseReduction: false,
      enableVAD: true,
      vadSensitivity: 0.5,
      maxPhraseDuration: 30,
      partialResults: true,
      interimResults: true,
      autoStop: true,
      accuracy: 'balanced',
      confidenceThreshold: 0.7
    };
  }

  private initialize(): void {
    if (!this.isSupported()) {
      throw new STTConfigurationError(
        'Web Speech API not supported in this browser',
        'webspeech'
      );
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.sourceLanguage;
      this.recognition.maxAlternatives = 3;

      // Event listeners
      this.recognition.onstart = () => {
        this.sessionCallbacks.onStart?.();
      };

      this.recognition.onend = () => {
        this.sessionCallbacks.onEnd?.();
        this.activeSession = null;
      };

      this.recognition.onresult = (event) => {
        const result = this.processResults(event);
        if (result) {
          this.sessionCallbacks.onResult?.(result);
          
          // Update active session
          if (this.activeSession) {
            this.activeSession.transcripts.push({
              id: this.generateTranscriptId(),
              result,
              processedAt: new Date(),
              processingTime: Date.now() - this.activeSession.startTime.getTime()
            });
          }
        }
      };

      this.recognition.onerror = (event) => {
        const error = this.handleError(event.error);
        this.sessionCallbacks.onError?.(error.message);
      };

      this.isInitialized = true;
    } catch (error) {
      throw new STTConfigurationError(
        `Failed to initialize Web Speech API: ${error}`,
        'webspeech'
      );
    }
  }

  private processResults(event: SpeechRecognitionEvent): STTResult | null {
    if (event.results.length === 0) return null;

    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript;
    const confidence = lastResult[0].confidence || 0.8;

    return {
      text: transcript.trim(),
      confidence: confidence,
      isFinal: lastResult.isFinal,
      timestamp: new Date(),
      duration: this.estimateDuration(transcript),
      language: this.config.sourceLanguage,
      alternatives: Array.from(lastResult).slice(1).map(alt => ({
        text: alt.transcript,
        confidence: alt.confidence || 0
      })),
      metadata: {
        words: this.extractWords(transcript),
        speaker: 'speaker_1' // Default speaker
      }
    };
  }

  private extractWords(text: string): Array<{ text: string; start: number; end: number; confidence: number }> {
    const words = text.split(' ');
    const estimatedWordDuration = 0.5; // seconds per word (rough estimate)
    const wordsWithTiming: Array<{ text: string; start: number; end: number; confidence: number }> = [];
    
    let currentTime = 0;
    for (const word of words) {
      const wordConfidence = 0.8 + Math.random() * 0.2; // Simplified confidence
      wordsWithTiming.push({
        text: word,
        start: currentTime,
        end: currentTime + estimatedWordDuration,
        confidence: Math.min(wordConfidence, 1.0)
      });
      currentTime += estimatedWordDuration;
    }
    
    return wordsWithTiming;
  }

  private estimateDuration(text: string): number {
    // Simple estimation: average 150 words per minute
    const words = text.split(' ').length;
    return (words / 150) * 60;
  }

  private handleError(errorCode: string): Error {
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech was detected',
      'audio-capture': 'Audio capture failed',
      'not-allowed': 'Microphone access denied',
      'network': 'Network error occurred',
      'aborted': 'Speech recognition was aborted',
      'language-not-supported': 'Language not supported',
      'service-not-allowed': 'Service not allowed',
      'bad-grammar': 'Grammar error in speech recognition',
      'context-not-allowed': 'Context not allowed'
    };

    const message = errorMessages[errorCode] || `Unknown error: ${errorCode}`;
    
    if (errorCode === 'network') {
      return new STTNetworkError(message, 'webspeech');
    } else if (errorCode === 'audio-capture') {
      return new STTAudioError(message, 'webspeech');
    } else {
      return new STTConfigurationError(message, 'webspeech');
    }
  }

  async startSession(config: Partial<STTConfig>): Promise<STTSession> {
    this.setConfig(config);

    if (!this.recognition) {
      throw new STTConfigurationError('Speech recognition not initialized', 'webspeech');
    }

    if (this.activeSession?.isActive) {
      throw new STTConfigurationError('Session already active', 'webspeech');
    }

    try {
      const session: STTSession = {
        id: this.generateSessionId(),
        config: this.config,
        isActive: false,
        startTime: new Date(),
        duration: 0,
        audioProcessed: 0,
        transcripts: [],
        statistics: {
          totalDuration: 0,
          averageConfidence: 0,
          wordsPerMinute: 0,
          silenceRatio: 0,
          errorRate: 0
        }
      };

      this.activeSession = session;
      
      // Start speech recognition
      this.recognition.start();
      session.isActive = true;

      return session;
    } catch (error) {
      this.activeSession = null;
      throw new STTAudioError(`Failed to start session: ${error}`, 'webspeech');
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    if (!this.activeSession || this.activeSession.id !== sessionId) {
      throw new STTConfigurationError('Session not found or not active', 'webspeech');
    }

    try {
      if (this.recognition) {
        this.recognition.stop();
      }
      
      this.activeSession.isActive = false;
      this.activeSession.duration = Date.now() - this.activeSession.startTime.getTime();
      
      // Calculate final statistics
      this.calculateFinalStatistics(this.activeSession);
      
    } catch (error) {
      throw new STTAudioError(`Failed to stop session: ${error}`, 'webspeech');
    }
  }

  async processAudio(audioData: ArrayBuffer): Promise<STTResult> {
    // For Web Speech API, this is a placeholder
    // Web Speech API processes audio from microphone, not from buffer
    throw new STTAudioError(
      'Web Speech API does not support buffer processing. Use startSession() instead.',
      'webspeech'
    );
  }

  async *streamProcess(audioStream: MediaStream): AsyncGenerator<STTResult> {
    if (!this.recognition) {
      throw new STTConfigurationError('Speech recognition not initialized', 'webspeech');
    }

    // Note: Web Speech API doesn't support streaming from external sources
    // This is a placeholder for the interface
    throw new STTAudioError(
      'Web Speech API does not support streaming processing',
      'webspeech'
    );
  }

  setConfig(config: Partial<STTConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.recognition) {
      this.recognition.lang = this.config.sourceLanguage;
      this.recognition.interimResults = this.config.interimResults;
    }
  }

  getConfig(): STTConfig {
    return { ...this.config };
  }

  isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  getSupportedLanguages(): string[] {
    // Return commonly supported languages for Web Speech API
    return [
      'ar-SA', 'ar-EG', 'ar-AE', 'ar-SA', 'ar-KW', 'ar-QA',
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-NZ',
      'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE',
      'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
      'de-DE', 'de-AT', 'de-CH',
      'it-IT', 'it-CH',
      'pt-BR', 'pt-PT',
      'ru-RU',
      'ja-JP',
      'ko-KR',
      'zh-CN', 'zh-TW', 'zh-HK',
      'hi-IN',
      'th-TH',
      'vi-VN',
      'tr-TR',
      'pl-PL',
      'nl-NL',
      'sv-SE',
      'da-DK',
      'no-NO',
      'fi-FI',
      'cs-CZ'
    ];
  }

  getAvailableEngines(): STTEngine[] {
    return ['webspeech'];
  }

  setSessionCallbacks(callbacks: typeof this.sessionCallbacks): void {
    this.sessionCallbacks = callbacks;
  }

  getActiveSession(): STTSession | null {
    return this.activeSession;
  }

  private generateSessionId(): string {
    return `webspeech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTranscriptId(): string {
    return `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateFinalStatistics(session: STTSession): void {
    if (session.transcripts.length === 0) return;

    const totalDuration = session.duration;
    const totalConfidence = session.transcripts.reduce((sum, t) => sum + t.result.confidence, 0);
    const averageConfidence = totalConfidence / session.transcripts.length;
    
    const totalWords = session.transcripts
      .filter(t => t.result.isFinal)
      .reduce((sum, t) => sum + t.result.text.split(' ').length, 0);
    
    const wordsPerMinute = totalDuration > 0 ? (totalWords / (totalDuration / 60000)) : 0;

    session.statistics.totalDuration = totalDuration;
    session.statistics.averageConfidence = averageConfidence;
    session.statistics.wordsPerMinute = wordsPerMinute;
  }

  // Additional helper methods
  pauseRecognition(): void {
    if (this.recognition && this.activeSession?.isActive) {
      this.recognition.stop();
    }
  }

  resumeRecognition(): void {
    if (this.recognition && this.activeSession?.isActive) {
      this.recognition.start();
    }
  }

  isRecognitionActive(): boolean {
    return this.activeSession?.isActive || false;
  }

  getSessionStatistics(sessionId: string): STTSession['statistics'] | null {
    if (this.activeSession?.id === sessionId) {
      return this.activeSession.statistics;
    }
    return null;
  }
}