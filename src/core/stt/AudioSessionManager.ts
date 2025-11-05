// src/core/stt/AudioSessionManager.ts

import { AudioProcessor, AudioConfig } from '@/core/audio/AudioProcessor';
import { VoiceActivityDetector, VADConfig } from '@/core/audio/VAD';
import { STTService } from '@/core/stt/STTService';

export interface AudioSessionConfig {
  sttService: STTService;
  audioProcessor: AudioProcessor;
  vad: VoiceActivityDetector;
  
  // Session settings
  autoStart: boolean;
  autoStop: boolean;
  maxSessionDuration: number; // ms
  silenceTimeout: number; // ms
  
  // Quality settings
  minConfidence: number;
  enablePartialResults: boolean;
  
  // Audio settings
  audioConfig: AudioConfig;
  vadConfig: VADConfig;
}

export interface AudioSession {
  id: string;
  config: AudioSessionConfig;
  isActive: boolean;
  isRecording: boolean;
  startTime: Date;
  endTime?: Date;
  
  // Audio data
  audioChunks: ArrayBuffer[];
  processedChunks: ArrayBuffer[];
  
  // Transcription data
  transcripts: AudioTranscript[];
  
  // Statistics
  statistics: AudioSessionStatistics;
  
  // Callbacks
  onTranscript?: (transcript: AudioTranscript) => void;
  onVADChange?: (isSpeech: boolean) => void;
  onSessionEnd?: () => void;
  onError?: (error: Error) => void;
  onAudioData?: (audioData: ArrayBuffer) => void;
}

export interface AudioTranscript {
  id: string;
  text: string;
  confidence: number;
  timestamp: Date;
  duration: number;
  isFinal: boolean;
  language?: string;
  alternatives?: Array<{ text: string; confidence: number }>;
  metadata?: {
    words?: Array<{ text: string; start: number; end: number; confidence: number }>;
    emotions?: string[];
    speakingRate?: number;
  };
}

export interface AudioSessionStatistics {
  totalDuration: number;
  speakingDuration: number;
  silenceDuration: number;
  averageConfidence: number;
  wordsPerMinute: number;
  chunksProcessed: number;
  errorCount: number;
  voiceActivityRatio: number;
  averageEnergy: number;
  peakEnergy: number;
  silencePeriods: number;
}

export class AudioSessionManager {
  private sessions: Map<string, AudioSession> = new Map();
  private config: AudioSessionConfig;
  private silenceTimer?: NodeJS.Timeout;
  private lastVADResult: any = null;
  private activeAudioContext?: AudioContext;
  private mediaStream?: MediaStream;

  constructor(config: AudioSessionConfig) {
    this.config = config;
  }

  async createSession(options?: Partial<AudioSessionConfig>): Promise<string> {
    const sessionConfig = { ...this.config, ...options };
    const sessionId = this.generateSessionId();
    
    const session: AudioSession = {
      id: sessionId,
      config: sessionConfig,
      isActive: false,
      isRecording: false,
      startTime: new Date(),
      audioChunks: [],
      processedChunks: [],
      transcripts: [],
      statistics: {
        totalDuration: 0,
        speakingDuration: 0,
        silenceDuration: 0,
        averageConfidence: 0,
        wordsPerMinute: 0,
        chunksProcessed: 0,
        errorCount: 0,
        voiceActivityRatio: 0,
        averageEnergy: 0,
        peakEnergy: 0,
        silencePeriods: 0
      }
    };

    this.sessions.set(sessionId, session);
    
    if (sessionConfig.autoStart) {
      await this.startSession(sessionId);
    }

    return sessionId;
  }

  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.isActive) {
      throw new Error(`Session ${sessionId} is already active`);
    }

    try {
      session.isActive = true;
      
      // Update processor configurations
      session.config.audioProcessor.updateConfig(session.config.audioConfig);
      session.config.vad.updateConfig(session.config.vadConfig);
      
      // Start audio recording
      await this.startRecording(session);
      
      // Start STT service
      await session.config.sttService.startSession({
        sourceLanguage: 'ar-SA',
        targetLanguage: undefined,
        engine: 'webspeech',
        partialResults: session.config.enablePartialResults,
        interimResults: session.config.enablePartialResults,
        confidenceThreshold: session.config.minConfidence
      });
      
    } catch (error) {
      session.isActive = false;
      session.isRecording = false;
      session.onError?.(error as Error);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Stop recording
      await this.stopRecording(session);
      
      // Stop STT service
      await session.config.sttService.stopSession(sessionId);
      
      // Update session end time
      session.endTime = new Date();
      session.isActive = false;
      
      // Calculate final statistics
      this.calculateFinalStatistics(session);
      
    } catch (error) {
      session.onError?.(error as Error);
      throw error;
    }
  }

  private async startRecording(session: AudioSession): Promise<void> {
    try {
      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: session.config.audioConfig.sampleRate,
          channelCount: session.config.audioConfig.channels
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      session.isRecording = true;
      
      // Start processing audio chunks
      this.processAudioStream(session, this.mediaStream);
      
    } catch (error) {
      session.isRecording = false;
      session.onError?.(new Error(`Failed to access microphone: ${error}`));
      throw error;
    }
  }

  private async stopRecording(session: AudioSession): Promise<void> {
    session.isRecording = false;
    
    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = undefined;
    }
    
    // Close audio context
    if (this.activeAudioContext) {
      await this.activeAudioContext.close();
      this.activeAudioContext = undefined;
    }
    
    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = undefined;
    }
  }

  private async processAudioStream(session: AudioSession, stream: MediaStream): Promise<void> {
    try {
      // Create audio context
      this.activeAudioContext = new AudioContext({
        sampleRate: session.config.audioConfig.sampleRate
      });
      
      const source = this.activeAudioContext.createMediaStreamSource(stream);
      
      // Set up audio processing
      const processor = this.activeAudioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = async (event) => {
        if (!session.isRecording) return;
        
        try {
          const inputBuffer = event.inputBuffer;
          const channelData = inputBuffer.getChannelData(0);
          
          // Convert to ArrayBuffer
          const audioData = this.float32ToArrayBuffer(channelData);
          session.audioChunks.push(audioData);
          
          // Notify callback with raw audio data
          session.onAudioData?.(audioData);
          
          // Process audio
          const processed = await session.config.audioProcessor.process(audioData, session.config.audioConfig);
          session.processedChunks.push(this.float32ToArrayBuffer(processed.data));
          
          // VAD processing
          const vadResult = session.config.vad.processFrame(processed.data);
          
          // Handle VAD state changes
          this.handleVADChange(session, vadResult);
          
          // Process through STT if there's speech
          if (vadResult.isSpeech && vadResult.confidence > session.config.minConfidence) {
            // Start STT session if not already started
            if (!session.config.sttService.getActiveSession()) {
              await session.config.sttService.startSession({
                sourceLanguage: 'ar-SA',
                partialResults: session.config.enablePartialResults
              });
            }
            
            const transcript = await this.processSTT(session, processed.data);
            if (transcript) {
              session.transcripts.push(transcript);
              session.onTranscript?.(transcript);
            }
          }
          
          // Update statistics
          this.updateSessionStatistics(session, processed, vadResult);
          
        } catch (error) {
          session.statistics.errorCount++;
          session.onError?.(error as Error);
        }
      };
      
      source.connect(processor);
      processor.connect(this.activeAudioContext.destination);
      
    } catch (error) {
      session.onError?.(new Error(`Failed to process audio stream: ${error}`));
      throw error;
    }
  }

  private handleVADChange(session: AudioSession, vadResult: any): void {
    const isSpeechChanged = this.lastVADResult?.isSpeech !== vadResult.isSpeech;
    
    if (isSpeechChanged) {
      session.onVADChange?.(vadResult.isSpeech);
      
      if (!vadResult.isSpeech) {
        // Start silence timer for auto-stop
        this.startSilenceTimer(session);
      } else {
        // Clear silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = undefined;
        }
      }
    }
    
    this.lastVADResult = vadResult;
  }

  private startSilenceTimer(session: AudioSession): void {
    this.silenceTimer = setTimeout(async () => {
      if (session.config.autoStop && session.isActive) {
        await this.stopSession(session.id);
        session.onSessionEnd?.();
      }
    }, session.config.silenceTimeout);
  }

  private async processSTT(session: AudioSession, audioData: Float32Array): Promise<AudioTranscript | null> {
    try {
      // Convert Float32Array to ArrayBuffer for STT service
      const audioBuffer = this.float32ToArrayBuffer(audioData);
      
      const result = await session.config.sttService.processAudio(audioBuffer);
      
      if (result.confidence >= session.config.minConfidence) {
        return {
          id: this.generateTranscriptId(),
          text: result.text,
          confidence: result.confidence,
          timestamp: new Date(),
          duration: result.duration,
          isFinal: result.isFinal,
          language: result.language,
          alternatives: result.alternatives,
          metadata: {
            words: result.metadata?.words,
            emotions: result.metadata?.emotions,
            speakingRate: this.estimateSpeakingRate(result.text, result.duration)
          }
        };
      }
      
      return null;
      
    } catch (error) {
      session.statistics.errorCount++;
      console.error('STT processing error:', error);
      return null;
    }
  }

  private updateSessionStatistics(session: AudioSession, processed: any, vadResult: any): void {
    const now = Date.now();
    const elapsed = now - session.startTime.getTime();
    
    session.statistics.totalDuration = elapsed;
    
    if (vadResult.isSpeech) {
      session.statistics.speakingDuration += session.config.vadConfig.hopSize;
    } else {
      session.statistics.silenceDuration += session.config.vadConfig.hopSize;
    }
    
    // Update energy statistics
    session.statistics.averageEnergy = (session.statistics.averageEnergy * (session.statistics.chunksProcessed) + processed.volume) / (session.statistics.chunksProcessed + 1);
    session.statistics.peakEnergy = Math.max(session.statistics.peakEnergy, processed.volume);
    
    // Update voice activity ratio
    const vadStats = session.config.vad.getStatistics();
    session.statistics.voiceActivityRatio = vadStats.speechRatio;
    
    // Update average confidence
    const totalConfidence = session.transcripts.reduce((sum, t) => sum + t.confidence, 0);
    session.statistics.averageConfidence = session.transcripts.length > 0 
      ? totalConfidence / session.transcripts.length 
      : 0;
    
    // Calculate words per minute
    const totalWords = session.transcripts
      .filter(t => t.isFinal)
      .reduce((sum, t) => sum + t.text.split(' ').length, 0);
    
    session.statistics.wordsPerMinute = elapsed > 0 
      ? (totalWords / (elapsed / 60000)) 
      : 0;
    
    session.statistics.chunksProcessed++;
  }

  private calculateFinalStatistics(session: AudioSession): void {
    if (!session.endTime) return;
    
    const totalDuration = session.endTime.getTime() - session.startTime.getTime();
    session.statistics.totalDuration = totalDuration;
    
    // Final voice activity analysis
    const vadStats = session.config.vad.getStatistics();
    session.statistics.speakingDuration = totalDuration * vadStats.speechRatio;
    session.statistics.silenceDuration = totalDuration * vadStats.silenceRatio;
    
    // Silence periods count
    session.statistics.silencePeriods = this.countSilencePeriods(session);
  }

  private countSilencePeriods(session: AudioSession): number {
    // Count transitions from speech to silence
    let silencePeriods = 0;
    let wasInSpeech = false;
    
    for (const transcript of session.transcripts) {
      const confidence = transcript.confidence;
      const isInSpeech = confidence > session.config.minConfidence;
      
      if (!isInSpeech && wasInSpeech) {
        silencePeriods++;
      }
      
      wasInSpeech = isInSpeech;
    }
    
    return silencePeriods;
  }

  private estimateSpeakingRate(text: string, duration: number): number {
    const words = text.split(' ').length;
    return duration > 0 ? (words / duration) * 60 : 0; // words per minute
  }

  private float32ToArrayBuffer(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 4);
    const view = new DataView(buffer);
    
    for (let i = 0; i < float32Array.length; i++) {
      view.setFloat32(i * 4, float32Array[i], true);
    }
    
    return buffer;
  }

  private generateSessionId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTranscriptId(): string {
    return `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getSession(sessionId: string): AudioSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AudioSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): AudioSession[] {
    return this.getAllSessions().filter(session => session.isActive);
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.isActive) {
      this.stopSession(sessionId).catch(console.error);
    }
    this.sessions.delete(sessionId);
  }

  pauseSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session?.isActive) {
      session.isRecording = false;
      session.config.sttService.pauseRecognition();
    }
  }

  resumeSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session?.isActive) {
      session.isRecording = true;
      session.config.sttService.resumeRecognition();
    }
  }

  // Statistics and monitoring
  getGlobalStatistics(): {
    totalSessions: number;
    activeSessions: number;
    totalDuration: number;
    totalTranscripts: number;
    averageConfidence: number;
  } {
    const sessions = this.getAllSessions();
    const activeSessions = sessions.filter(s => s.isActive).length;
    const totalDuration = sessions.reduce((sum, s) => sum + s.statistics.totalDuration, 0);
    const totalTranscripts = sessions.reduce((sum, s) => sum + s.transcripts.length, 0);
    const totalConfidence = sessions.reduce((sum, s) => 
      sum + (s.transcripts.reduce((tsum, t) => tsum + t.confidence, 0)), 0);
    const averageConfidence = totalTranscripts > 0 ? totalConfidence / totalTranscripts : 0;
    
    return {
      totalSessions: sessions.length,
      activeSessions,
      totalDuration,
      totalTranscripts,
      averageConfidence
    };
  }

  // Utility methods
  exportSessionData(sessionId: string): any {
    const session = this.getSession(sessionId);
    if (!session) return null;
    
    return {
      id: session.id,
      config: session.config,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.statistics.totalDuration,
      transcripts: session.transcripts,
      statistics: session.statistics
    };
  }

  clearAllSessions(): void {
    // Stop all active sessions first
    const activeSessions = this.getActiveSessions();
    activeSessions.forEach(session => {
      this.stopSession(session.id).catch(console.error);
    });
    
    this.sessions.clear();
  }

  // Configuration
  updateGlobalConfig(config: Partial<AudioSessionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AudioSessionConfig {
    return { ...this.config };
  }
}