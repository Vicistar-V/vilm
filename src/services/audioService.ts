import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

export interface AudioRecording {
  id: string;
  path: string;
  duration: number;
  size: number;
}

class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private audioDirectory = 'vilm-audio';

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Audio permission denied:', error);
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    try {
      // Ensure we have permission
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Audio permission required');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Stop all tracks
        if (this.mediaRecorder?.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  getCurrentDuration(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  async saveAudioFile(audioBlob: Blob, filename: string): Promise<string> {
    try {
      // Convert blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // Ensure directory exists
      await this.ensureAudioDirectory();
      
      // Save file
      const result = await Filesystem.writeFile({
        path: `${this.audioDirectory}/${filename}`,
        data: base64Audio,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      return result.uri;
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw error;
    }
  }

  async getAudioFile(filename: string): Promise<string> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });

      return `data:audio/webm;base64,${result.data}`;
    } catch (error) {
      console.error('Failed to read audio file:', error);
      throw error;
    }
  }

  async deleteAudioFile(filename: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });
    } catch (error) {
      console.error('Failed to delete audio file:', error);
      throw error;
    }
  }

  private async ensureAudioDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.audioDirectory,
        directory: Directory.Data,
        recursive: true
      });
    } catch (error) {
      // Directory might already exist, that's okay
      if (!error.message?.includes('Directory exists')) {
        throw error;
      }
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  generateAudioFilename(): string {
    return `vilm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`;
  }
}

export const audioService = new AudioService();