// src/core/audio/AudioProcessor.ts

export interface AudioProcessor {
  process(audioData: ArrayBuffer, config: AudioConfig): Promise<ProcessedAudio>;
  normalize(audioData: Float32Array): Float32Array;
  denoise(audioData: Float32Array): Float32Array;
  resample(audioData: Float32Array, fromRate: number, toRate: number): Float32Array;
  convertFormat(audioData: ArrayBuffer, fromFormat: AudioFormat, toFormat: AudioFormat): ArrayBuffer;
  detectSilence(audioData: Float32Array, threshold: number): boolean;
  applyGain(audioData: Float32Array, gain: number): Float32Array;
  applyCompressor(audioData: Float32Array, threshold: number, ratio: number): Float32Array;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: AudioFormat;
  
  // Processing options
  enableNormalization: boolean;
  enableNoiseReduction: boolean;
  enableVAD: boolean;
  targetVolume: number; // 0-1
  silenceThreshold: number;
}

export interface ProcessedAudio {
  data: Float32Array;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  duration: number;
  volume: number;
  hasVoice: boolean;
  quality: AudioQuality;
  spectralAnalysis?: SpectralData;
}

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'raw' | 'float32';

export interface AudioQuality {
  snr: number; // Signal-to-noise ratio
  dynamicRange: number;
  clipping: number; // Percentage of clipped samples
  silence: number; // Percentage of silence
  peakLevel: number; // Peak amplitude
  rmsLevel: number; // RMS amplitude
  thd: number; // Total Harmonic Distortion
}

export interface SpectralData {
  frequencies: number[];
  magnitudes: number[];
  dominantFrequency: number;
  bandwidth: number;
}

export class AudioProcessorImpl implements AudioProcessor {
  private config: AudioConfig;
  private noiseProfile: Float32Array | null = null;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  async process(audioData: ArrayBuffer, config: Partial<AudioConfig>): Promise<ProcessedAudio> {
    this.config = { ...this.config, ...config };
    
    // Convert to Float32Array
    const floatData = await this.convertToFloat32(audioData);
    
    // Apply processing chain
    let processed = floatData;
    
    // 1. Normalize if enabled
    if (this.config.enableNormalization) {
      processed = this.normalize(processed);
    }
    
    // 2. Remove noise if enabled
    if (this.config.enableNoiseReduction) {
      processed = this.denoise(processed);
    }
    
    // 3. Apply gain
    processed = this.applyGain(processed, this.config.targetVolume);
    
    // 4. Detect voice activity
    const hasVoice = await this.detectVoiceActivity(processed);
    
    // 5. Calculate quality metrics
    const quality = this.calculateQuality(processed);
    
    // 6. Calculate volume
    const volume = this.calculateRMSVolume(processed);
    
    // 7. Calculate duration
    const duration = processed.length / this.config.sampleRate;
    
    // 8. Perform spectral analysis
    const spectralAnalysis = this.performSpectralAnalysis(processed);

    return {
      data: processed,
      format: this.config.format,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      duration,
      volume,
      hasVoice,
      quality,
      spectralAnalysis
    };
  }

  normalize(audioData: Float32Array): Float32Array {
    const max = Math.max(...audioData.map(Math.abs));
    if (max === 0) return audioData;

    const normalized = new Float32Array(audioData.length);
    const target = this.config.targetVolume;
    
    for (let i = 0; i < audioData.length; i++) {
      normalized[i] = (audioData[i] / max) * target;
    }
    
    return normalized;
  }

  denoise(audioData: Float32Array): Float32Array {
    // Advanced noise reduction using spectral subtraction
    const windowSize = 1024;
    const hopSize = 512;
    const denoised = new Float32Array(audioData.length);
    
    // Create noise profile if not available
    if (!this.noiseProfile) {
      this.noiseProfile = this.createNoiseProfile(audioData);
    }
    
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const window = audioData.slice(i, i + windowSize);
      const processedWindow = this.applySpectralSubtraction(window, this.noiseProfile);
      
      // Overlap-add
      for (let j = 0; j < processedWindow.length && i + j < denoised.length; j++) {
        denoised[i + j] = processedWindow[j];
      }
    }
    
    return denoised;
  }

  resample(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return audioData;
    
    const ratio = toRate / fromRate;
    const newLength = Math.round(audioData.length * ratio);
    const resampled = new Float32Array(newLength);
    
    // Use linear interpolation for resampling
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.ceil(srcIndex);
      
      if (srcIndexFloor >= audioData.length) {
        resampled[i] = 0;
      } else if (srcIndexCeil >= audioData.length) {
        resampled[i] = audioData[srcIndexFloor];
      } else {
        // Linear interpolation
        const fraction = srcIndex - srcIndexFloor;
        resampled[i] = audioData[srcIndexFloor] * (1 - fraction) + 
                      audioData[srcIndexCeil] * fraction;
      }
    }
    
    return resampled;
  }

  convertFormat(audioData: ArrayBuffer, fromFormat: AudioFormat, toFormat: AudioFormat): ArrayBuffer {
    // Placeholder implementation
    // In a real implementation, you would handle format conversion
    return audioData;
  }

  detectSilence(audioData: Float32Array, threshold: number = this.config.silenceThreshold): boolean {
    const rms = this.calculateRMSVolume(audioData);
    return rms < threshold;
  }

  applyGain(audioData: Float32Array, gain: number): Float32Array {
    const affected = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      affected[i] = audioData[i] * gain;
    }
    return affected;
  }

  applyCompressor(audioData: Float32Array, threshold: number, ratio: number): Float32Array {
    const compressed = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      const input = Math.abs(audioData[i]);
      
      if (input > threshold) {
        // Apply compression above threshold
        const excess = input - threshold;
        const compressedExcess = excess / ratio;
        const output = threshold + compressedExcess;
        compressed[i] = (audioData[i] > 0 ? 1 : -1) * output;
      } else {
        compressed[i] = audioData[i];
      }
    }
    
    return compressed;
  }

  // Private helper methods
  private async convertToFloat32(audioData: ArrayBuffer): Promise<Float32Array> {
    // Simplified conversion - in reality you'd parse the audio format
    const bytes = new Uint8Array(audioData);
    const floatArray = new Float32Array(bytes.length / 2);
    
    for (let i = 0; i < floatArray.length; i++) {
      const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
      floatArray[i] = (sample - 32768) / 32768;
    }
    
    return floatArray;
  }

  private async detectVoiceActivity(audioData: Float32Array): Promise<boolean> {
    // Advanced VAD using energy and spectral features
    const windowSize = Math.floor(this.config.sampleRate * 0.03); // 30ms windows
    const hopSize = Math.floor(windowSize / 2);
    const windows = Math.floor(audioData.length / hopSize);
    
    let speechWindows = 0;
    
    for (let i = 0; i < windows; i++) {
      const start = i * hopSize;
      const end = start + windowSize;
      
      if (end > audioData.length) break;
      
      const window = audioData.slice(start, end);
      
      // Calculate energy
      const energy = this.calculateEnergy(window);
      
      // Calculate zero crossing rate
      const zcr = this.calculateZeroCrossingRate(window);
      
      // Simple VAD decision
      const hasSpeech = energy > this.config.silenceThreshold && zcr < 0.1;
      
      if (hasSpeech) speechWindows++;
    }
    
    // Consider as speech if more than 30% of windows contain speech
    return (speechWindows / windows) > 0.3;
  }

  private calculateQuality(audioData: Float32Array): AudioQuality {
    // Calculate Signal-to-Noise Ratio
    const snr = this.calculateSNR(audioData);
    
    // Calculate dynamic range
    const max = Math.max(...audioData.map(Math.abs));
    const min = Math.min(...audioData.map(Math.abs));
    const dynamicRange = max - min;
    
    // Calculate clipping
    let clipped = 0;
    for (const sample of audioData) {
      if (Math.abs(sample) > 0.99) clipped++;
    }
    const clipping = (clipped / audioData.length) * 100;
    
    // Calculate silence
    let silenceCount = 0;
    const silenceThreshold = 0.001;
    for (const sample of audioData) {
      if (Math.abs(sample) < silenceThreshold) silenceCount++;
    }
    const silence = (silenceCount / audioData.length) * 100;
    
    // Calculate peak and RMS levels
    const peakLevel = max;
    const rmsLevel = this.calculateRMSVolume(audioData);
    
    // Estimate THD (simplified)
    const thd = this.estimateTHD(audioData);

    return {
      snr,
      dynamicRange,
      clipping,
      silence,
      peakLevel,
      rmsLevel,
      thd
    };
  }

  private calculateRMSVolume(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
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

  private calculateSNR(audioData: Float32Array): number {
    const signal = this.calculateEnergy(audioData);
    
    // Estimate noise from the quietest segments
    const windowSize = 1024;
    const windows = Math.floor(audioData.length / windowSize);
    const energies: number[] = [];
    
    for (let i = 0; i < windows; i++) {
      const start = i * windowSize;
      const end = start + windowSize;
      if (end > audioData.length) break;
      
      const window = audioData.slice(start, end);
      energies.push(this.calculateEnergy(window));
    }
    
    // Use 10th percentile as noise estimate
    energies.sort((a, b) => a - b);
    const noiseIndex = Math.floor(energies.length * 0.1);
    const noise = energies[noiseIndex] || 0.0001;
    
    const snr = 10 * Math.log10(signal / Math.max(noise, 0.0001));
    return snr;
  }

  private estimateTHD(audioData: Float32Array): number {
    // Simplified THD estimation
    // In practice, this would require FFT analysis
    const fundamental = this.estimateFundamentalFrequency(audioData);
    const harmonics = this.estimateHarmonics(audioData, fundamental);
    
    const totalHarmonicPower = harmonics.reduce((sum, h) => sum + h * h, 0);
    const fundamentalPower = harmonics[0] * harmonics[0];
    
    return Math.sqrt(totalHarmonicPower / Math.max(fundamentalPower, 0.0001));
  }

  private estimateFundamentalFrequency(audioData: Float32Array): number {
    // Simplified pitch detection using autocorrelation
    const minPeriod = Math.floor(this.config.sampleRate / 1000); // 1kHz max
    const maxPeriod = Math.floor(this.config.sampleRate / 50); // 50Hz min
    
    let bestPeriod = minPeriod;
    let bestCorrelation = 0;
    
    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      const validSamples = audioData.length - period;
      
      for (let i = 0; i < validSamples; i++) {
        correlation += audioData[i] * audioData[i + period];
      }
      
      correlation /= validSamples;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return this.config.sampleRate / bestPeriod;
  }

  private estimateHarmonics(audioData: Float32Array, fundamental: number): number[] {
    // Simplified harmonic estimation
    const harmonics: number[] = [];
    
    for (let h = 1; h <= 5; h++) {
      const targetFreq = fundamental * h;
      const amplitude = this.estimateAmplitudeAtFrequency(audioData, targetFreq);
      harmonics.push(amplitude);
    }
    
    return harmonics;
  }

  private estimateAmplitudeAtFrequency(audioData: Float32Array, frequency: number): number {
    // Simplified frequency domain analysis
    const omega = 2 * Math.PI * frequency / this.config.sampleRate;
    let real = 0, imag = 0;
    
    for (let n = 0; n < audioData.length; n++) {
      real += audioData[n] * Math.cos(omega * n);
      imag += audioData[n] * Math.sin(omega * n);
    }
    
    return Math.sqrt(real * real + imag * imag) / audioData.length;
  }

  private performSpectralAnalysis(audioData: Float32Array): SpectralData {
    const frequencies: number[] = [];
    const magnitudes: number[] = [];
    
    // Simplified spectral analysis
    const bins = 1024;
    const binSize = this.config.sampleRate / (2 * bins);
    
    for (let i = 0; i < bins; i++) {
      const freq = i * binSize;
      const magnitude = this.estimateAmplitudeAtFrequency(audioData, freq);
      
      frequencies.push(freq);
      magnitudes.push(magnitude);
    }
    
    // Find dominant frequency
    let maxMagnitude = 0;
    let dominantIndex = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMagnitude) {
        maxMagnitude = magnitudes[i];
        dominantIndex = i;
      }
    }
    
    const dominantFrequency = frequencies[dominantIndex];
    
    // Estimate bandwidth (frequency range containing 90% of energy)
    const totalEnergy = magnitudes.reduce((sum, m) => sum + m * m, 0);
    let cumulativeEnergy = 0;
    let bandwidthStart = 0;
    let bandwidthEnd = frequencies[frequencies.length - 1];
    
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i] * magnitudes[i];
      if (cumulativeEnergy >= totalEnergy * 0.05 && bandwidthStart === 0) {
        bandwidthStart = frequencies[i];
      }
      if (cumulativeEnergy >= totalEnergy * 0.95) {
        bandwidthEnd = frequencies[i];
        break;
      }
    }
    
    const bandwidth = bandwidthEnd - bandwidthStart;
    
    return {
      frequencies,
      magnitudes,
      dominantFrequency,
      bandwidth
    };
  }

  private createNoiseProfile(audioData: Float32Array): Float32Array {
    // Analyze first 10% of audio to create noise profile
    const noiseLength = Math.floor(audioData.length * 0.1);
    const noiseWindow = audioData.slice(0, noiseLength);
    
    // Simple FFT would be needed here for real implementation
    // For now, return a basic noise profile
    return noiseWindow;
  }

  private applySpectralSubtraction(window: Float32Array, noiseProfile: Float32Array): Float32Array {
    // Simplified spectral subtraction
    const result = new Float32Array(window.length);
    const alpha = 2.0; // Over-subtraction factor
    
    for (let i = 0; i < window.length && i < noiseProfile.length; i++) {
      const signalPower = window[i] * window[i];
      const noisePower = noiseProfile[i] * noiseProfile[i];
      
      const cleanSignal = Math.max(
        signalPower - alpha * noisePower,
        0.01 * signalPower
      );
      
      result[i] = window[i] >= 0 ? Math.sqrt(cleanSignal) : -Math.sqrt(cleanSignal);
    }
    
    return result;
  }

  // Configuration methods
  updateConfig(config: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  calibrateNoiseProfile(backgroundNoise: Float32Array): void {
    this.noiseProfile = backgroundNoise.slice();
  }

  resetNoiseProfile(): void {
    this.noiseProfile = null;
  }
}