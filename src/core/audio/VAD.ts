// src/core/audio/VAD.ts

import { AudioProcessor } from './AudioProcessor';

export interface VADConfig {
  sampleRate: number;
  windowSize: number; // ms
  hopSize: number; // ms
  threshold: number; // energy threshold
  minSpeechDuration: number; // ms
  minSilenceDuration: number; // ms
  sensitivity: number; // 0-1
  adaptiveThreshold: boolean;
}

export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  energy: number;
  timestamp: number;
  frameIndex: number;
  voiceProbability: number;
  spectralCentroid: number;
}

export interface VADState {
  isSpeech: boolean;
  speechStartTime: number;
  speechEndTime: number;
  totalSpeechDuration: number;
  totalSilenceDuration: number;
  speechFrames: number;
  silenceFrames: number;
}

export class VoiceActivityDetector {
  private config: VADConfig;
  private frameBuffer: Float32Array[] = [];
  private frameIndex = 0;
  private state: VADState;
  private energyHistory: number[] = [];
  private baselineEnergy = 0;
  private adaptationRate = 0.01;
  private lastVADResult: VADResult | null = null;

  constructor(config: VADConfig) {
    this.config = config;
    this.state = {
      isSpeech: false,
      speechStartTime: 0,
      speechEndTime: 0,
      totalSpeechDuration: 0,
      totalSilenceDuration: 0,
      speechFrames: 0,
      silenceFrames: 0
    };
  }

  processFrame(audioData: Float32Array): VADResult {
    const windowSamples = Math.floor((this.config.windowSize / 1000) * this.config.sampleRate);
    const hopSamples = Math.floor((this.config.hopSize / 1000) * this.config.sampleRate);
    
    // Calculate features
    const energy = this.calculateEnergy(audioData);
    const zcr = this.calculateZeroCrossingRate(audioData);
    const spectralCentroid = this.calculateSpectralCentroid(audioData);
    
    // Update energy history for adaptive threshold
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 100) {
      this.energyHistory.shift();
    }
    
    // Calculate adaptive threshold
    let threshold = this.config.threshold;
    if (this.config.adaptiveThreshold) {
      threshold = this.calculateAdaptiveThreshold();
    }
    
    // Calculate voice probability using multiple features
    const voiceProbability = this.calculateVoiceProbability(energy, zcr, spectralCentroid, threshold);
    
    // Apply hysteresis to reduce false positives/negatives
    const isSpeech = this.applyHysteresis(voiceProbability);
    
    // Update state
    this.updateState(isSpeech, energy);
    
    const result: VADResult = {
      isSpeech,
      confidence: voiceProbability,
      energy,
      timestamp: this.frameIndex * this.config.hopSize,
      frameIndex: this.frameIndex,
      voiceProbability,
      spectralCentroid
    };
    
    this.lastVADResult = result;
    this.frameIndex++;
    
    return result;
  }

  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return sum / audioData.length;
  }

  private calculateZeroCrossingRate(audioData: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioData.length;
  }

  private calculateSpectralCentroid(audioData: Float32Array): number {
    // Simplified spectral centroid calculation
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 1; i < audioData.length; i++) {
      const magnitude = Math.abs(audioData[i]);
      const frequency = (i * this.config.sampleRate) / (2 * audioData.length);
      
      weightedSum += magnitude * frequency;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateVoiceProbability(
    energy: number, 
    zcr: number, 
    spectralCentroid: number, 
    threshold: number
  ): number {
    // Normalize features to 0-1 range
    const normalizedEnergy = Math.min(energy * 10, 1); // Energy contribution
    const normalizedZCR = Math.max(0, Math.min(zcr * 10, 1)); // ZCR contribution (lower is better)
    const normalizedCentroid = Math.min(spectralCentroid / 2000, 1); // Spectral centroid contribution
    
    // Weighted combination of features
    const energyWeight = 0.5;
    const zcrWeight = 0.2;
    const centroidWeight = 0.3;
    
    const voiceProbability = (
      normalizedEnergy * energyWeight +
      (1 - normalizedZCR) * zcrWeight +
      normalizedCentroid * centroidWeight
    );
    
    // Apply sensitivity adjustment
    const adjustedProbability = Math.pow(voiceProbability, this.config.sensitivity);
    
    return Math.max(0, Math.min(1, adjustedProbability));
  }

  private calculateAdaptiveThreshold(): number {
    if (this.energyHistory.length < 10) {
      return this.config.threshold;
    }
    
    // Calculate dynamic threshold based on recent energy history
    const sortedEnergies = [...this.energyHistory].sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedEnergies.length * 0.5);
    const medianEnergy = sortedEnergies[medianIndex];
    
    // Set threshold to 2-3 times the median energy
    const adaptiveThreshold = medianEnergy * 2.5;
    
    // Smooth the threshold change
    const smoothedThreshold = this.baselineEnergy * (1 - this.adaptationRate) + 
                             adaptiveThreshold * this.adaptationRate;
    
    this.baselineEnergy = smoothedThreshold;
    
    return Math.max(this.config.threshold * 0.5, Math.min(smoothedThreshold, this.config.threshold * 3));
  }

  private applyHysteresis(voiceProbability: number): boolean {
    if (this.lastVADResult === null) {
      return voiceProbability > 0.5;
    }
    
    const currentIsSpeech = this.lastVADResult.isSpeech;
    const hysteresisFactor = 0.1;
    
    if (currentIsSpeech) {
      // When currently in speech, require higher probability to stop
      return voiceProbability > (0.5 - hysteresisFactor);
    } else {
      // When currently in silence, require lower probability to start
      return voiceProbability > (0.5 + hysteresisFactor);
    }
  }

  private updateState(isSpeech: boolean, energy: number): void {
    const now = this.frameIndex * this.config.hopSize;
    
    if (isSpeech && !this.state.isSpeech) {
      // Speech just started
      this.state.isSpeech = true;
      this.state.speechStartTime = now;
    } else if (!isSpeech && this.state.isSpeech) {
      // Speech just ended
      this.state.isSpeech = false;
      this.state.speechEndTime = now;
      this.state.totalSpeechDuration += now - this.state.speechStartTime;
    }
    
    if (isSpeech) {
      this.state.speechFrames++;
    } else {
      this.state.silenceFrames++;
      if (this.state.isSpeech) {
        this.state.totalSilenceDuration += now - this.state.speechEndTime;
      }
    }
  }

  // Public methods for getting state and statistics
  getState(): VADState {
    return { ...this.state };
  }

  getCurrentResult(): VADResult | null {
    return this.lastVADResult;
  }

  getStatistics(): {
    speechRatio: number;
    silenceRatio: number;
    averageEnergy: number;
    energyVariance: number;
  } {
    const totalFrames = this.frameIndex;
    const speechRatio = totalFrames > 0 ? this.state.speechFrames / totalFrames : 0;
    const silenceRatio = 1 - speechRatio;
    
    const averageEnergy = this.energyHistory.length > 0 
      ? this.energyHistory.reduce((sum, e) => sum + e, 0) / this.energyHistory.length 
      : 0;
    
    const energyVariance = this.energyHistory.length > 1
      ? this.energyHistory.reduce((sum, e) => sum + Math.pow(e - averageEnergy, 2), 0) / this.energyHistory.length
      : 0;
    
    return {
      speechRatio,
      silenceRatio,
      averageEnergy,
      energyVariance
    };
  }

  // Calibration methods
  calibrate(backgroundNoise: Float32Array): void {
    // Analyze background noise to set optimal threshold
    const windowSize = Math.floor((this.config.windowSize / 1000) * this.config.sampleRate);
    const noiseEnergy = this.calculateEnergy(backgroundNoise.slice(0, windowSize));
    
    // Set threshold to 3 times background noise level
    const newThreshold = noiseEnergy * 3;
    this.config.threshold = Math.max(0.001, newThreshold);
    
    // Update baseline
    this.baselineEnergy = newThreshold;
    this.energyHistory.length = 0;
  }

  reset(): void {
    this.state = {
      isSpeech: false,
      speechStartTime: 0,
      speechEndTime: 0,
      totalSpeechDuration: 0,
      totalSilenceDuration: 0,
      speechFrames: 0,
      silenceFrames: 0
    };
    
    this.frameIndex = 0;
    this.energyHistory.length = 0;
    this.baselineEnergy = this.config.threshold;
    this.lastVADResult = null;
  }

  // Configuration methods
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): VADConfig {
    return { ...this.config };
  }

  setSensitivity(sensitivity: number): void {
    this.config.sensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
  }

  setAdaptiveThreshold(enabled: boolean): void {
    this.config.adaptiveThreshold = enabled;
    if (enabled) {
      this.adaptationRate = 0.01;
    }
  }

  // Advanced features
  detectEmotion(audioData: Float32Array): {
    emotion: string;
    confidence: number;
  } | null {
    // Simplified emotion detection based on spectral features
    const spectralCentroid = this.calculateSpectralCentroid(audioData);
    const energy = this.calculateEnergy(audioData);
    const zcr = this.calculateZeroCrossingRate(audioData);
    
    // Basic emotion heuristics
    if (energy > 0.1 && spectralCentroid > 1500) {
      return { emotion: 'excited', confidence: 0.7 };
    } else if (energy < 0.01 && zcr < 0.05) {
      return { emotion: 'calm', confidence: 0.6 };
    } else if (zcr > 0.15) {
      return { emotion: 'stressed', confidence: 0.5 };
    }
    
    return null;
  }

  estimateSpeakingRate(audioData: Float32Array): number {
    // Estimate words per minute based on audio characteristics
    const energy = this.calculateEnergy(audioData);
    const zcr = this.calculateZeroCrossingRate(audioData);
    
    // Simple estimation formula
    const baseRate = 150; // words per minute
    const energyFactor = Math.min(energy * 5, 2); // up to 2x faster with high energy
    const zcrFactor = 1 + (zcr - 0.1) * 2; // adjustment for speech clarity
    
    return baseRate * energyFactor * zcrFactor;
  }
}