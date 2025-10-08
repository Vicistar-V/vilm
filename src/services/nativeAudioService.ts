import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { v4 as uuidv4 } from 'uuid';

export interface AudioRecording {
  id: string;
  path: string;
  duration: number;
  size: number;
  isTemporary: boolean;
  blob?: Blob; // Keep the audio blob in memory for immediate processing
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Prefer WebM format for consistency
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
        mimeType = 'audio/mp4;codecs=mp4a.40.2';
      }

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();
      this.currentRecordingId = uuidv4();

      await this.ensureTempAudioDirectory();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      this.mediaRecorder.start(1000);
      
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
      this.currentRecordingId = null;
      return { 
        success: false, 
        error: errorMsg,
        details: {
          stack: error instanceof Error ? error.stack : undefined,
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
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          const tempFilename = this.generateTempAudioFilename(recordingId);
          const tempPath = await this.saveTemporaryAudioFile(audioBlob, tempFilename);
          
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
            isTemporary: true,
            blob: audioBlob // Keep blob for immediate transcription
          };

          resolve(recording);
        } catch (error) {
          console.error('Failed to save temp recording:', error);
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  async saveRecordingPermanently(tempRecording: AudioRecording): Promise<string> {
    try {
      await this.ensureAudioDirectory();
      
      const tempFilename = await this.findTempFile(tempRecording.id);
      if (!tempFilename) {
        throw new Error(`Temporary file not found for recording ${tempRecording.id}`);
      }

      const tempFileResult = await Filesystem.readFile({
        path: `${this.tempAudioDirectory}/${tempFilename}`,
        directory: Directory.Data
      });

      // Detect correct extension from blob MIME type
      let extension = '.webm';
      if (tempRecording.blob) {
        const mimeType = tempRecording.blob.type;
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
          extension = '.m4a';
        } else if (mimeType.includes('webm')) {
          extension = '.webm';
        }
      }

      const permanentFilename = `${tempRecording.id}${extension}`;

      await Filesystem.writeFile({
        path: `${this.audioDirectory}/${permanentFilename}`,
        data: tempFileResult.data,
        directory: Directory.Data
      });

      await this.deleteTemporaryRecording(tempRecording.id);

      return permanentFilename;
    } catch (error) {
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

      // Sniff MIME type from file bytes
      const mimeType = this.detectMimeType(result.data as string);

      return `data:${mimeType};base64,${result.data}`;
    } catch (error) {
      throw new Error(`Failed to read audio file: ${error.message || 'Unknown error'}`);
    }
  }

  private detectMimeType(base64Data: string): string {
    try {
      // Decode first few bytes to detect format
      const binary = atob(base64Data.substring(0, 100));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Check for WebM signature (EBML header: 0x1A 0x45 0xDF 0xA3)
      if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
        return 'audio/webm';
      }

      // Check for MP4/M4A signature ('ftyp' at offset 4)
      if (bytes.length > 8 && 
          bytes[4] === 0x66 && bytes[5] === 0x74 && 
          bytes[6] === 0x79 && bytes[7] === 0x70) {
        return 'audio/mp4';
      }

      // Fallback to webm
      return 'audio/webm';
    } catch (error) {
      return 'audio/webm';
    }
  }

  async getAudioFileUri(filename: string): Promise<string> {
    try {
      const result = await Filesystem.getUri({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });
      return result.uri;
    } catch (error) {
      throw new Error(`Failed to get audio file URI: ${error.message || 'Unknown error'}`);
    }
  }

  async getAudioFileData(filename: string): Promise<{ data: string; mimeType: string }> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });

      let mimeType = 'audio/webm';
      if (filename.endsWith('.mp4')) {
        mimeType = 'audio/mp4';
      } else if (filename.endsWith('.m4a')) {
        mimeType = 'audio/m4a';
      }

      return { data: result.data as string, mimeType };
    } catch (error) {
      throw new Error(`Failed to get audio file data: ${error.message || 'Unknown error'}`);
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
      const errorMsg = error.message?.toLowerCase() || '';
      if (!errorMsg.includes('exist')) {
        throw error;
      }
    }
  }

  private async ensureTempAudioDirectory(): Promise<void> {
    try {
      // First check if directory exists
      await Filesystem.readdir({
        path: this.tempAudioDirectory,
        directory: Directory.Data
      });
      // Directory exists, we're done
      return;
    } catch (error) {
      // Directory doesn't exist, try to create it
      try {
        await Filesystem.mkdir({
          path: this.tempAudioDirectory,
          directory: Directory.Data,
          recursive: true
        });
      } catch (mkdirError) {
        const errorMsg = mkdirError.message?.toLowerCase() || '';
        // Ignore if directory was created by another process
        if (!errorMsg.includes('exist')) {
          throw mkdirError;
        }
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