import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { v4 as uuidv4 } from 'uuid';

export interface AudioRecording {
  id: string;
  path: string;
  duration: number;
  size: number;
  isTemporary: boolean;
}

class NativeAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private tempAudioDirectory = 'vilm-temp-audio';
  private audioDirectory = 'vilm-audio';
  private currentRecordingId: string | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Audio permission denied:', error);
      return false;
    }
  }

  async startRecording(): Promise<{ success: boolean; recordingId?: string; error?: string; details?: any }> {
    try {
      console.log('[DEBUG] 1. Starting recording - requesting permissions');
      const hasPermission = await this.requestPermissions();
      console.log('[DEBUG] 2. Permission result:', hasPermission);
      
      if (!hasPermission) {
        return { 
          success: false, 
          error: 'Audio permission denied by user',
          details: { step: 'permission_request' }
        };
      }

      console.log('[DEBUG] 3. Getting user media stream');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      console.log('[DEBUG] 4. Stream obtained:', stream.id, 'Active:', stream.active);

      // Use AAC codec for better mobile compatibility (closer to m4a)
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
        mimeType = 'audio/mp4;codecs=mp4a.40.2'; // AAC in MP4
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      console.log('[DEBUG] 5. Selected MIME type:', mimeType);

      console.log('[DEBUG] 6. Creating MediaRecorder');
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();
      this.currentRecordingId = uuidv4();

      console.log('[DEBUG] 7. MediaRecorder created, state:', this.mediaRecorder.state);

      // Ensure temp directory exists
      console.log('[DEBUG] 8. Ensuring temp directory exists');
      await this.ensureTempAudioDirectory();

      console.log('[DEBUG] 9. Setting up event handlers');
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[DEBUG] Data chunk received:', event.data.size, 'bytes');
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('[DEBUG] MediaRecorder error:', event);
      };

      console.log('[DEBUG] 10. Starting MediaRecorder');
      this.mediaRecorder.start(1000);
      console.log('[DEBUG] 11. MediaRecorder started, state:', this.mediaRecorder.state);
      
      return { 
        success: true, 
        recordingId: this.currentRecordingId,
        details: {
          mimeType,
          streamId: stream.id,
          mediaRecorderState: this.mediaRecorder.state
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[DEBUG] Failed to start recording:', error);
      this.currentRecordingId = null;
      return { 
        success: false, 
        error: errorMsg,
        details: {
          stack: errorStack,
          name: error instanceof Error ? error.name : 'Unknown'
        }
      };
    }
  }

  async stopRecording(): Promise<AudioRecording | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.currentRecordingId) {
        resolve(null);
        return;
      }

      const recordingId = this.currentRecordingId;
      const duration = this.getCurrentDuration();

      this.mediaRecorder.onstop = async () => {
        try {
          // Create audio blob
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          // Save to temporary location
          const tempFilename = this.generateTempAudioFilename(recordingId);
          const tempPath = await this.saveTemporaryAudioFile(audioBlob, tempFilename);
          
          // Stop all tracks
          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          }
          
          this.mediaRecorder = null;
          this.audioChunks = [];
          this.currentRecordingId = null;

          const recording: AudioRecording = {
            id: recordingId,
            path: tempPath,
            duration,
            size: audioBlob.size,
            isTemporary: true
          };

          resolve(recording);
        } catch (error) {
          console.error('Failed to save temporary recording:', error);
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  async saveRecordingPermanently(tempRecording: AudioRecording): Promise<string> {
    try {
      // Generate permanent filename with .m4a extension
      const permanentFilename = `${tempRecording.id}.m4a`;
      
      // Ensure permanent directory exists
      await this.ensureAudioDirectory();
      
      // Get the actual temp filename (find by pattern)
      const tempFilename = await this.findTempFile(tempRecording.id);
      if (!tempFilename) {
        throw new Error(`Temporary file not found for recording ${tempRecording.id}`);
      }

      // Read temporary file as base64 for binary audio data
      const tempFileResult = await Filesystem.readFile({
        path: `${this.tempAudioDirectory}/${tempFilename}`,
        directory: Directory.Data
      });

      // Write to permanent location
      await Filesystem.writeFile({
        path: `${this.audioDirectory}/${permanentFilename}`,
        data: tempFileResult.data,
        directory: Directory.Data
      });

      // Clean up temporary file
      await this.deleteTemporaryRecording(tempRecording.id);

      return permanentFilename;
    } catch (error) {
      console.error('Failed to save recording permanently:', error);
      throw error;
    }
  }

  async deleteTemporaryRecording(recordingId: string): Promise<void> {
    try {
      const tempFilename = await this.findTempFile(recordingId);
      if (tempFilename) {
        await Filesystem.deleteFile({
          path: `${this.tempAudioDirectory}/${tempFilename}`,
          directory: Directory.Data
        });
      }
    } catch (error) {
      console.error('Failed to delete temporary recording:', error);
      // Don't throw - cleanup failures shouldn't break the app
    }
  }

  getCurrentDuration(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  async getAudioFile(filename: string): Promise<string> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });

      // Determine MIME type based on extension
      let mimeType = 'audio/m4a';
      if (filename.endsWith('.webm')) {
        mimeType = 'audio/webm';
      } else if (filename.endsWith('.mp4')) {
        mimeType = 'audio/mp4';
      }

      return `data:${mimeType};base64,${result.data}`;
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

  async cleanupAbandonedTempFiles(): Promise<void> {
    try {
      const tempDir = await Filesystem.readdir({
        path: this.tempAudioDirectory,
        directory: Directory.Data
      });

      // Delete all temporary files older than 1 hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const file of tempDir.files) {
        if (file.name.startsWith('temp_')) {
          try {
            const stat = await Filesystem.stat({
              path: `${this.tempAudioDirectory}/${file.name}`,
              directory: Directory.Data
            });
            
            if (stat.mtime < oneHourAgo) {
              await Filesystem.deleteFile({
                path: `${this.tempAudioDirectory}/${file.name}`,
                directory: Directory.Data
              });
            }
          } catch (error) {
            // Ignore errors for individual file cleanup
          }
        }
      }
    } catch (error) {
      // Ignore if temp directory doesn't exist
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
      if (!error.message?.includes('Directory exists')) {
        throw error;
      }
    }
  }

  private async ensureTempAudioDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: this.tempAudioDirectory,
        directory: Directory.Data,
        recursive: true
      });
    } catch (error) {
      if (!error.message?.includes('Directory exists')) {
        throw error;
      }
    }
  }

  private async saveTemporaryAudioFile(audioBlob: Blob, filename: string): Promise<string> {
    try {
      const base64Audio = await this.blobToBase64(audioBlob);
      
      const result = await Filesystem.writeFile({
        path: `${this.tempAudioDirectory}/${filename}`,
        data: base64Audio,
        directory: Directory.Data
      });

      return result.uri;
    } catch (error) {
      console.error('Failed to save temporary audio file:', error);
      throw error;
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

  private generateTempAudioFilename(recordingId: string): string {
    return `temp_${recordingId}_${Date.now()}.webm`;
  }

  private getTempFilename(recordingId: string): string {
    // Use consistent filename pattern for cleanup - find files starting with this pattern
    return `temp_${recordingId}`;
  }

  private async findTempFile(recordingId: string): Promise<string | null> {
    try {
      // List all files in temp directory
      const result = await Filesystem.readdir({
        path: this.tempAudioDirectory,
        directory: Directory.Data
      });
      
      // Find file that starts with temp_{recordingId}_
      const prefix = `temp_${recordingId}_`;
      const matchingFile = result.files.find(file => file.name.startsWith(prefix));
      return matchingFile?.name || null;
    } catch (error) {
      console.error('Failed to find temp file:', error);
      return null;
    }
  }

  generateAudioId(): string {
    return uuidv4();
  }
}

export const nativeAudioService = new NativeAudioService();