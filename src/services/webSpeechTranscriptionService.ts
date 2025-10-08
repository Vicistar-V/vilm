// Web Speech API transcription service - 100% free, runs in browser
export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

class WebSpeechTranscriptionService {
  private recognition: any = null;
  private isListening = false;
  private currentTranscript = '';
  private onTranscriptUpdate?: (transcript: string) => void;

  constructor() {
    // Check if Web Speech API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.setupRecognitionHandlers();
    }
  }

  private setupRecognitionHandlers() {
    if (!this.recognition) return;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = this.currentTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = (finalTranscript + interimTranscript).trim();
      this.currentTranscript = finalTranscript;
      
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(fullTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      // Don't stop on 'no-speech' errors, continue listening
      if (event.error !== 'no-speech') {
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (error) {
          console.error('Failed to restart recognition:', error);
        }
      }
    };
  }

  async startTranscription(onUpdate: (transcript: string) => void): Promise<boolean> {
    if (!this.recognition) {
      console.warn('Web Speech API not available');
      return false;
    }

    try {
      this.currentTranscript = '';
      this.onTranscriptUpdate = onUpdate;
      this.isListening = true;
      this.recognition.start();
      console.log('Web Speech API transcription started');
      return true;
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.isListening = false;
      return false;
    }
  }

  stopTranscription(): string {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    return this.currentTranscript.trim();
  }

  async isAvailable(): Promise<boolean> {
    return this.recognition !== null;
  }

  getTranscript(): string {
    return this.currentTranscript.trim();
  }
}

export const webSpeechTranscriptionService = new WebSpeechTranscriptionService();
