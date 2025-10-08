// Abstraction layer for transcription services
// Makes it easy to swap between Web Speech API and external APIs

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

export interface TranscriptionService {
  transcribeAudioBlob(
    audioBlob: Blob,
    onProgress?: (transcript: string) => void
  ): Promise<TranscriptionResult>;
  isAvailable(): Promise<boolean>;
  cancelTranscription(): void;
}

// Global transcription state manager
class TranscriptionManager {
  private activeTranscription: AbortController | null = null;
  private currentService: TranscriptionService | null = null;

  setActiveService(service: TranscriptionService) {
    this.currentService = service;
  }

  async transcribe(
    audioBlob: Blob,
    onProgress?: (transcript: string) => void
  ): Promise<TranscriptionResult> {
    // Cancel any existing transcription
    this.cancelActive();

    // Create new abort controller for this transcription
    this.activeTranscription = new AbortController();

    if (!this.currentService) {
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: 'No transcription service available'
      };
    }

    try {
      const result = await this.currentService.transcribeAudioBlob(audioBlob, onProgress);
      this.activeTranscription = null;
      return result;
    } catch (error) {
      this.activeTranscription = null;
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  cancelActive() {
    if (this.activeTranscription) {
      this.activeTranscription.abort();
      if (this.currentService) {
        this.currentService.cancelTranscription();
      }
      this.activeTranscription = null;
    }
  }

  hasActiveTranscription(): boolean {
    return this.activeTranscription !== null;
  }
}

export const transcriptionManager = new TranscriptionManager();
