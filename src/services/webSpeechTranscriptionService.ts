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

  // Transcribe an audio blob by playing it back and capturing with Web Speech API
  async transcribeAudioBlob(audioBlob: Blob, onProgress?: (transcript: string) => void): Promise<TranscriptionResult> {
    if (!this.recognition) {
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: 'Web Speech API not available'
      };
    }

    return new Promise((resolve) => {
      try {
        this.currentTranscript = '';
        let hasStarted = false;

        // Create audio element to play the recording
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.volume = 0; // Mute for user but system can hear it

        // Set up recognition handlers for this transcription session
        const cleanup = () => {
          this.isListening = false;
          try {
            this.recognition.stop();
          } catch (e) {
            // Ignore errors during cleanup
          }
          audio.pause();
          URL.revokeObjectURL(audioUrl);
        };

        this.recognition.onresult = (event: any) => {
          let finalTranscript = '';

          for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            }
          }

          if (finalTranscript) {
            this.currentTranscript += finalTranscript;
            if (onProgress) {
              onProgress(this.currentTranscript.trim());
            }
          }
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error during transcription:', event.error);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            cleanup();
            resolve({
              transcript: this.currentTranscript.trim(),
              confidence: 0.7,
              isSuccess: this.currentTranscript.length > 0,
              error: event.error
            });
          }
        };

        this.recognition.onend = () => {
          // If audio is still playing, restart recognition to continue capturing
          if (!audio.paused && !audio.ended) {
            try {
              this.recognition.start();
            } catch (error) {
              console.error('Failed to restart recognition:', error);
            }
          }
        };

        // When audio finishes, stop recognition and return result
        audio.onended = () => {
          setTimeout(() => {
            cleanup();
            resolve({
              transcript: this.currentTranscript.trim(),
              confidence: 0.85,
              isSuccess: true
            });
          }, 500); // Small delay to catch final words
        };

        audio.onerror = () => {
          cleanup();
          resolve({
            transcript: this.currentTranscript.trim(),
            confidence: 0,
            isSuccess: false,
            error: 'Failed to play audio for transcription'
          });
        };

        // Start recognition then play audio
        this.isListening = true;
        this.recognition.start();
        
        // Start playing audio after a brief delay to ensure recognition is ready
        setTimeout(() => {
          audio.play().catch((error) => {
            console.error('Failed to play audio:', error);
            cleanup();
            resolve({
              transcript: '',
              confidence: 0,
              isSuccess: false,
              error: 'Failed to play audio for transcription'
            });
          });
        }, 100);

      } catch (error) {
        console.error('Failed to transcribe audio:', error);
        resolve({
          transcript: '',
          confidence: 0,
          isSuccess: false,
          error: error instanceof Error ? error.message : 'Transcription failed'
        });
      }
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.recognition !== null;
  }

  getTranscript(): string {
    return this.currentTranscript.trim();
  }
}

export const webSpeechTranscriptionService = new WebSpeechTranscriptionService();
