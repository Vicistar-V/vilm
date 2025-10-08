import { pipeline } from '@huggingface/transformers';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

export type TranscriptionPhase = 'idle' | 'downloading' | 'ready' | 'error';

type PhaseListener = (phase: TranscriptionPhase) => void;

class BrowserTranscriptionService {
  private transcriber: any = null;
  private isInitializing = false;
  private phase: TranscriptionPhase = 'idle';
  private listeners = new Set<PhaseListener>();
  private currentTaskId: string | null = null;
  private cancelledTaskIds = new Set<string>();

  getPhase(): TranscriptionPhase {
    return this.phase;
  }

  subscribe(listener: PhaseListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: PhaseListener): void {
    this.listeners.delete(listener);
  }

  private setPhase(phase: TranscriptionPhase): void {
    this.phase = phase;
    this.listeners.forEach(listener => listener(phase));
  }

  async initialize(): Promise<void> {
    if (this.transcriber || this.isInitializing) return;

    this.isInitializing = true;
    this.setPhase('downloading');
    
    try {
      console.log('Initializing browser-based Whisper transcription...');
      
      // Try WebGPU first, fallback to WASM for broader compatibility
      let device: 'webgpu' | 'wasm' = 'wasm';
      
      if ((navigator as any).gpu) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
            console.log('Using WebGPU for transcription');
          }
        } catch (e) {
          console.log('WebGPU not available, falling back to WASM');
        }
      }
      
      // Use tiny.en model for speed, or 'base.en' for better accuracy
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        { device }
      );
      
      console.log(`Whisper transcription initialized successfully on ${device}`);
      this.setPhase('ready');
    } catch (error) {
      console.error('Failed to initialize transcription:', error);
      this.setPhase('error');
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  cancelTranscription(): void {
    if (this.currentTaskId) {
      this.cancelledTaskIds.add(this.currentTaskId);
      console.log(`Cancelled transcription task: ${this.currentTaskId}`);
      this.currentTaskId = null;
    }
  }

  async transcribeAudio(audioDataUrl: string): Promise<TranscriptionResult> {
    // Generate unique task ID
    const taskId = `task_${Date.now()}_${Math.random()}`;
    this.currentTaskId = taskId;

    try {
      await this.initialize();

      // Check if cancelled during initialization
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
        return {
          transcript: '',
          confidence: 0,
          isSuccess: false,
          error: 'Transcription cancelled'
        };
      }

      console.log('Starting transcription...');
      const result = await this.transcriber(audioDataUrl);
      
      // Check if cancelled after transcription
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
        return {
          transcript: '',
          confidence: 0,
          isSuccess: false,
          error: 'Transcription cancelled'
        };
      }
      
      console.log('Transcription complete:', result);

      // Clear task if it's still current
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }

      return {
        transcript: result.text || '',
        confidence: 0.9,
        isSuccess: true
      };
    } catch (error) {
      console.error('Transcription error:', error);
      
      // Clear cancelled flag if it exists
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
      }
      
      // Clear task if it's still current
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Whisper can work with both WebGPU and WASM
      // Check for basic browser compatibility
      return typeof navigator !== 'undefined' && typeof atob !== 'undefined';
    } catch {
      return false;
    }
  }
}

export const browserTranscriptionService = new BrowserTranscriptionService();
