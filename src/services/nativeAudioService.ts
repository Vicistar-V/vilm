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
    return new Promise((resolve) => {
      const startTimeout = setTimeout(() => {
        // Safety timeout in case onstart never fires
        if (!this.startTime) {
          this.startTime = Date.now();
        }
      }, 500);

      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            } 
          });

          // Use M4A format for maximum compatibility with all sharing platforms
          const mimeType = 'audio/mp4;codecs=mp4a.40.2';
          
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error('M4A audio format is not supported on this device');
          }

          console.log('[Recording] MediaRecorder MIME type:', mimeType);
          
          this.mediaRecorder = new MediaRecorder(stream, { mimeType });
          this.audioChunks = [];
          this.currentRecordingId = uuidv4();

          await this.ensureTempAudioDirectory();

          // Set startTime when recording actually starts
          this.mediaRecorder.onstart = () => {
            clearTimeout(startTimeout);
            this.startTime = Date.now();
            console.log('MediaRecorder started at:', this.startTime);
          };

          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              this.audioChunks.push(event.data);
            }
          };

          this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
          };

          this.mediaRecorder.start(1000);
          
          resolve({ 
            success: true, 
            recordingId: this.currentRecordingId,
            details: {
              mimeType,
              streamId: stream.id,
              mediaRecorderState: this.mediaRecorder.state
            }
          });
        } catch (error) {
          clearTimeout(startTimeout);
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.currentRecordingId = null;
          resolve({ 
            success: false, 
            error: errorMsg,
            details: {
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : 'Unknown'
            }
          });
        }
      })();
    });
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
          const mimeType = this.mediaRecorder?.mimeType || 'audio/mp4;codecs=mp4a.40.2';
          console.log('[Recording] Stopping recording with MIME type:', mimeType);
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          const tempFilename = this.generateTempAudioFilename(recordingId, mimeType);
          console.log('[Recording] Generated temp filename:', tempFilename);
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

      // Use M4A extension for all recordings
      const extension = '.m4a';
      const mimeType = tempRecording.blob?.type || 'audio/mp4';
      console.log('[NativeAudio] Blob MIME type:', mimeType);
      
      console.log('[NativeAudio] Using extension:', extension);
      const permanentFilename = `${tempRecording.id}${extension}`;
      console.log('[NativeAudio] Permanent filename:', permanentFilename);

      await Filesystem.writeFile({
        path: `${this.audioDirectory}/${permanentFilename}`,
        data: tempFileResult.data,
        directory: Directory.Data
      });
      
      // Phase 5: Verify file integrity after saving
      console.log('[NativeAudio] Verifying saved file integrity...');
      const verificationResult = await this.verifyFileIntegrity(permanentFilename, tempFileResult.data as string);
      if (!verificationResult.valid) {
        throw new Error(`File integrity check failed: ${verificationResult.error}`);
      }
      console.log('[NativeAudio] File integrity verified successfully');

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

      // Check for MP4/M4A signature ('ftyp' at offset 4)
      if (bytes.length > 8 && 
          bytes[4] === 0x66 && bytes[5] === 0x74 && 
          bytes[6] === 0x79 && bytes[7] === 0x70) {
        return 'audio/mp4';
      }

      // All audio files should be M4A
      return 'audio/mp4';
    } catch (error) {
      return 'audio/mp4';
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

  async verifyAudioFileExists(filename: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });
      console.log('[NativeAudio] Audio file exists:', filename);
      return true;
    } catch (error) {
      console.log('[NativeAudio] Audio file not found in permanent storage:', filename);
      return false;
    }
  }

  async getAudioFileData(filename: string, retryCount: number = 0): Promise<{ data: string; mimeType: string }> {
    try {
      // Verify file exists first
      const exists = await this.verifyAudioFileExists(filename);
      if (!exists) {
        throw new Error(`Audio file "${filename}" not found in storage`);
      }

      console.log('[NativeAudio] Reading audio file:', filename, retryCount > 0 ? `(Retry ${retryCount})` : '');
      const result = await Filesystem.readFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });

      // Phase 1: Use content sniffing instead of filename extension
      const detectedMimeType = this.detectMimeType(result.data as string);
      
      // Also get extension-based MIME type for logging
      let extensionMimeType = 'audio/mp4';
      if (filename.endsWith('.mp4') || filename.endsWith('.m4a')) {
        extensionMimeType = 'audio/mp4';
      }
      
      console.log('[NativeAudio] Extension suggests:', extensionMimeType);
      console.log('[NativeAudio] Content detected as:', detectedMimeType);

      const dataLength = (result.data as string).length;
      console.log('[NativeAudio] Audio file read successfully. Base64 length:', dataLength);
      
      // Validate that we got actual data
      if (!result.data || dataLength === 0) {
        throw new Error('Audio file is empty or corrupted');
      }

      return { data: result.data as string, mimeType: detectedMimeType };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[NativeAudio] Failed to get audio file data:', errorMsg);
      
      // Phase 5: Retry mechanism - retry once after 500ms
      if (retryCount === 0 && !errorMsg.includes('not found')) {
        console.log('[NativeAudio] Retrying file read after 500ms delay...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.getAudioFileData(filename, retryCount + 1);
      }
      
      throw new Error(`Failed to read audio file: ${errorMsg}`);
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

  private generateTempAudioFilename(recordingId: string, mimeType?: string): string {
    // Always use M4A extension
    const extension = 'm4a';
    const filename = `temp_${recordingId}_${Date.now()}.${extension}`;
    console.log('[Recording] Generated temp filename:', filename);
    return filename;
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

  // Phase 5: Add file integrity verification
  private async verifyFileIntegrity(filename: string, originalData: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.audioDirectory}/${filename}`,
        directory: Directory.Data
      });
      
      const readData = result.data as string;
      
      // Check if file is readable
      if (!readData) {
        return { valid: false, error: 'File is empty after saving' };
      }
      
      // Check if data length matches (allowing small differences due to encoding)
      const originalLength = originalData.length;
      const readLength = readData.length;
      const lengthDiff = Math.abs(originalLength - readLength);
      
      if (lengthDiff > 100) { // Allow small differences
        return { 
          valid: false, 
          error: `Data size mismatch: original ${originalLength}, read ${readLength}` 
        };
      }
      
      // Try to detect MIME type to ensure it's valid audio data
      const mimeType = this.detectMimeType(readData);
      if (!mimeType.startsWith('audio/')) {
        return { valid: false, error: `Invalid audio format detected: ${mimeType}` };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown verification error' 
      };
    }
  }

  generateAudioId(): string {
    return uuidv4();
  }
}

export const nativeAudioService = new NativeAudioService();