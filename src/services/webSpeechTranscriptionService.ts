// Web Speech API transcription service - 100% free, runs in browser
import { TranscriptionService, TranscriptionResult } from './transcriptionService';

const MAX_AUDIO_DURATION = 300; // 5 minutes - Web Speech API limit

class WebSpeechTranscriptionService implements TranscriptionService {
  private recognition: any = null;
  private isListening = false;
  private currentTranscript = '';
  private currentAudio: HTMLAudioElement | null = null;
  private isCancelled = false;

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

    // Removed old real-time recognition handlers

    // Removed old real-time recognition handlers
  }

  cancelTranscription() {
    this.isCancelled = true;
    this.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors during cancellation
      }
    }
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  // Transcribe an audio blob by playing it back and capturing with Web Speech API
  async transcribeAudioBlob(audioBlob: Blob, onProgress?: (transcript: string) => void): Promise<TranscriptionResult> {
    this.isCancelled = false;
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

        // Create audio element to play the recording
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        audio.volume = 0; // Mute for user but system can hear it

        // Check if audio is too long
        audio.addEventListener('loadedmetadata', () => {
          if (audio.duration > MAX_AUDIO_DURATION) {
            cleanup();
            resolve({
              transcript: '',
              confidence: 0,
              isSuccess: false,
              error: `Audio too long (${Math.round(audio.duration)}s). Maximum ${MAX_AUDIO_DURATION}s supported. Please use a shorter recording or try API-based transcription.`
            });
          }
        });

        // Set up recognition handlers for this transcription session
        const cleanup = () => {
          this.isListening = false;
          this.currentAudio = null;
          try {
            this.recognition.stop();
          } catch (e) {
            // Ignore errors during cleanup
          }
          audio.pause();
          URL.revokeObjectURL(audioUrl);
        };

        this.recognition.onresult = (event: any) => {
          if (this.isCancelled) return;
          
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
          
          if (this.isCancelled) {
            cleanup();
            resolve({
              transcript: this.currentTranscript.trim(),
              confidence: 0,
              isSuccess: false,
              error: 'Transcription cancelled'
            });
            return;
          }
          
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            cleanup();
            resolve({
              transcript: this.currentTranscript.trim(),
              confidence: 0.7,
              isSuccess: this.currentTranscript.length > 0,
              error: event.error === 'network' 
                ? 'Network error. Please check your connection and retry.' 
                : event.error
            });
          }
        };

        this.recognition.onend = () => {
          if (this.isCancelled) return;
          
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
          if (this.isCancelled) {
            cleanup();
            resolve({
              transcript: this.currentTranscript.trim(),
              confidence: 0,
              isSuccess: false,
              error: 'Transcription cancelled'
            });
            return;
          }
          
          setTimeout(() => {
            cleanup();
            const transcript = this.currentTranscript.trim();
            resolve({
              transcript,
              confidence: transcript.length > 0 ? 0.85 : 0,
              isSuccess: transcript.length > 0,
              error: transcript.length === 0 ? 'No speech detected in audio' : undefined
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
