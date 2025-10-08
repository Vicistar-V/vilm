import { Filesystem, Directory } from '@capacitor/filesystem';
import { dexieVilmStorage } from './dexieStorage';
import { Vilm } from '@/types/vilm';

export interface MigrationProgress {
  total: number;
  completed: number;
  current?: string;
  errors: string[];
}

class AudioMigrationService {
  private isRunning = false;

  async needsMigration(): Promise<{ needsMigration: boolean; count: number }> {
    try {
      const vilms = await dexieVilmStorage.getAllVilms();
      const webmFiles = vilms.filter(v => v.audioFilename?.endsWith('.webm'));
      
      return {
        needsMigration: webmFiles.length > 0,
        count: webmFiles.length
      };
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return { needsMigration: false, count: 0 };
    }
  }

  async migrateAll(
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<{ success: boolean; errors: string[] }> {
    if (this.isRunning) {
      throw new Error('Migration is already running');
    }

    this.isRunning = true;
    const errors: string[] = [];

    try {
      const vilms = await dexieVilmStorage.getAllVilms();
      const webmVilms = vilms.filter(v => v.audioFilename?.endsWith('.webm'));
      
      const progress: MigrationProgress = {
        total: webmVilms.length,
        completed: 0,
        errors: []
      };

      onProgress?.(progress);

      for (const vilm of webmVilms) {
        try {
          progress.current = vilm.title;
          onProgress?.(progress);

          await this.migrateVilm(vilm);
          
          progress.completed++;
          onProgress?.(progress);
        } catch (error) {
          const errorMsg = `Failed to migrate "${vilm.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          progress.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return { success: errors.length === 0, errors };
    } finally {
      this.isRunning = false;
    }
  }

  private async migrateVilm(vilm: Vilm): Promise<void> {
    if (!vilm.audioFilename || !vilm.audioFilename.endsWith('.webm')) {
      return;
    }

    const webmFilename = vilm.audioFilename;
    const m4aFilename = webmFilename.replace('.webm', '.m4a');

    try {
      // Read the WebM file
      const webmFile = await Filesystem.readFile({
        path: `vilm-audio/${webmFilename}`,
        directory: Directory.Data
      });

      // Convert WebM to M4A using Web Audio API
      const m4aData = await this.convertWebMToM4A(webmFile.data as string);

      // Write the M4A file
      await Filesystem.writeFile({
        path: `vilm-audio/${m4aFilename}`,
        data: m4aData,
        directory: Directory.Data
      });

      // Update the database record
      await dexieVilmStorage.updateVilm(vilm.id, {
        audioFilename: m4aFilename
      });

      // Delete the old WebM file
      try {
        await Filesystem.deleteFile({
          path: `vilm-audio/${webmFilename}`,
          directory: Directory.Data
        });
      } catch (deleteError) {
        console.warn('Failed to delete old WebM file:', deleteError);
        // Don't throw - migration is still successful
      }

      console.log(`Successfully migrated ${webmFilename} to ${m4aFilename}`);
    } catch (error) {
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async convertWebMToM4A(webmBase64: string): Promise<string> {
    try {
      // Decode base64 to blob
      const webmBlob = this.base64ToBlob(webmBase64, 'audio/webm');

      // Use Web Audio API to decode
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Re-encode to AAC/M4A using MediaRecorder
      const m4aBlob = await this.encodeToM4A(audioBuffer, audioContext.sampleRate);

      // Convert back to base64
      const m4aBase64 = await this.blobToBase64(m4aBlob);

      audioContext.close();

      return m4aBase64;
    } catch (error) {
      throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async encodeToM4A(audioBuffer: AudioBuffer, sampleRate: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create an offline context to render the audio
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        sampleRate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      offlineContext.startRendering().then(renderedBuffer => {
        // Convert to PCM data
        const channels = [];
        for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
          channels.push(renderedBuffer.getChannelData(i));
        }

        // Create a MediaStream from the rendered buffer
        const destination = new MediaStreamAudioDestinationNode(
          new AudioContext({ sampleRate })
        );
        
        const bufferSource = destination.context.createBufferSource();
        bufferSource.buffer = renderedBuffer;
        bufferSource.connect(destination);

        // Use MediaRecorder to encode to M4A
        const chunks: Blob[] = [];
        const mediaRecorder = new MediaRecorder(destination.stream, {
          mimeType: 'audio/mp4;codecs=mp4a.40.2'
        });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'audio/mp4' }));
        };

        mediaRecorder.onerror = (e) => {
          reject(new Error('MediaRecorder encoding failed'));
        };

        bufferSource.start(0);
        mediaRecorder.start();

        // Stop after the audio finishes
        setTimeout(() => {
          mediaRecorder.stop();
          bufferSource.stop();
        }, (renderedBuffer.duration * 1000) + 100);
      }).catch(reject);
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeType });
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
}

export const audioMigrationService = new AudioMigrationService();
