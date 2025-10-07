import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Device } from '@capacitor/device';
import { nativeAudioService } from './nativeAudioService';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

class TranscriptionService {
  private isInitialized = false;
  private isCheckingPermissions = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.isCheckingPermissions = true;

    try {
      // Check if we're on web platform
      const deviceInfo = await Device.getInfo();
      if (deviceInfo.platform === 'web') {
        console.log('Speech recognition not available on web platform');
        this.isCheckingPermissions = false;
        throw new Error('Speech recognition not available on web');
      }

      // Request permissions for speech recognition (native only)
      const { available } = await SpeechRecognition.available();
      if (!available) {
        this.isCheckingPermissions = false;
        throw new Error('Speech recognition not available on this device');
      }

      const permissionResult = await SpeechRecognition.requestPermissions();
      if (permissionResult.speechRecognition !== 'granted') {
        this.isCheckingPermissions = false;
        throw new Error('Speech recognition permission denied');
      }

      this.isInitialized = true;
      this.isCheckingPermissions = false;
    } catch (error) {
      console.log('Transcription service initialization:', error);
      this.isCheckingPermissions = false;
      throw error;
    }
  }

  async transcribeAudio(audioFilename: string): Promise<TranscriptionResult> {
    try {
      await this.initialize();

      // Get the audio file as a data URL for transcription
      const audioDataUrl = await nativeAudioService.getAudioFile(audioFilename);
      
      // Start speech recognition
      await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 1,
        prompt: 'Transcribing audio...',
        partialResults: false,
        popup: false
      });

      // Create a promise that resolves when transcription is complete
      return new Promise((resolve) => {
        const handleResult = (result: any) => {
          SpeechRecognition.removeAllListeners();
          
          if (result.matches && result.matches.length > 0) {
            resolve({
              transcript: result.matches[0],
              confidence: result.confidence || 0.8,
              isSuccess: true
            });
          } else {
            resolve({
              transcript: '',
              confidence: 0,
              isSuccess: false,
              error: 'No speech detected'
            });
          }
        };

        const handleError = (error: any) => {
          SpeechRecognition.removeAllListeners();
          resolve({
            transcript: '',
            confidence: 0,
            isSuccess: false,
            error: error.message || 'Transcription failed'
          });
        };

        // Listen for results
        SpeechRecognition.addListener('partialResults', handleResult);

        // Set a timeout for transcription
        setTimeout(() => {
          SpeechRecognition.removeAllListeners();
          SpeechRecognition.stop();
          resolve({
            transcript: '',
            confidence: 0,
            isSuccess: false,
            error: 'Transcription timeout'
          });
        }, 30000); // 30 second timeout
      });

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

  async transcribeFromLiveAudio(): Promise<TranscriptionResult> {
    try {
      await this.initialize();

      // Start live speech recognition
      await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 1,
        prompt: 'Listening...',
        partialResults: true,
        popup: false
      });

      return new Promise((resolve) => {
        const handleResult = (result: any) => {
          if (!result.isFinal) return; // Wait for final result

          SpeechRecognition.removeAllListeners();
          SpeechRecognition.stop();
          
          if (result.matches && result.matches.length > 0) {
            resolve({
              transcript: result.matches[0],
              confidence: result.confidence || 0.8,
              isSuccess: true
            });
          } else {
            resolve({
              transcript: '',
              confidence: 0,
              isSuccess: false,
              error: 'No speech detected'
            });
          }
        };

        const handleError = (error: any) => {
          SpeechRecognition.removeAllListeners();
          SpeechRecognition.stop();
          resolve({
            transcript: '',
            confidence: 0,
            isSuccess: false,
            error: error.message || 'Live transcription failed'
          });
        };

        SpeechRecognition.addListener('partialResults', handleResult);

        // Set a timeout
        setTimeout(() => {
          SpeechRecognition.removeAllListeners();
          SpeechRecognition.stop();
          resolve({
            transcript: '',
            confidence: 0,
            isSuccess: false,
            error: 'Live transcription timeout'
          });
        }, 60000); // 60 second timeout for live transcription
      });

    } catch (error) {
      console.error('Live transcription error:', error);
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Live transcription failed'
      };
    }
  }

  async stopTranscription(): Promise<void> {
    try {
      await SpeechRecognition.stop();
      SpeechRecognition.removeAllListeners();
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check platform first
      const deviceInfo = await Device.getInfo();
      if (deviceInfo.platform === 'web') {
        return false;
      }

      const { available } = await SpeechRecognition.available();
      return available;
    } catch {
      return false;
    }
  }

  getIsCheckingPermissions(): boolean {
    return this.isCheckingPermissions;
  }
}

export const transcriptionService = new TranscriptionService();