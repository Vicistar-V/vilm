import { pipeline } from '@huggingface/transformers';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

class BrowserTranscriptionService {
  private transcriber: any = null;
  private isInitializing = false;

  async initialize(): Promise<void> {
    if (this.transcriber || this.isInitializing) return;

    this.isInitializing = true;
    try {
      console.log('Initializing browser-based Whisper transcription...');
      
      // Use tiny.en model for speed, or 'base.en' for better accuracy
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        { device: 'webgpu' }
      );
      
      console.log('Whisper transcription initialized successfully');
    } catch (error) {
      console.error('Failed to initialize transcription:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async transcribeAudio(audioDataUrl: string): Promise<TranscriptionResult> {
    try {
      await this.initialize();

      console.log('Starting transcription...');
      const result = await this.transcriber(audioDataUrl);
      
      console.log('Transcription complete:', result);

      return {
        transcript: result.text || '',
        confidence: 0.9,
        isSuccess: true
      };
    } catch (error) {
      console.error('Transcription error:', error);
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
      // Check if WebGPU is available
      if (!(navigator as any).gpu) {
        console.log('WebGPU not available, transcription disabled');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const browserTranscriptionService = new BrowserTranscriptionService();
