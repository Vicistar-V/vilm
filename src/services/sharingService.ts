import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { nativeAudioService } from './nativeAudioService';
import { Vilm } from '@/types/vilm';

export interface ShareOptions {
  includeAudio?: boolean;
  includeTranscript?: boolean;
  format?: 'text' | 'json';
}

class SharingService {
  
  async shareVilm(vilm: Vilm, options: ShareOptions = {}): Promise<void> {
    const {
      includeAudio = false,
      includeTranscript = true,
      format = 'text'
    } = options;

    try {
      let shareData: any = {
        title: `Vilm: ${vilm.title}`,
      };

      if (format === 'text') {
        // Create text content
        let textContent = `📝 ${vilm.title}\n\n`;
        
        if (includeTranscript && vilm.transcript) {
          textContent += `Transcript:\n${vilm.transcript}\n\n`;
        }
        
        textContent += `Duration: ${this.formatDuration(vilm.duration)}\n`;
        textContent += `Created: ${vilm.createdAt.toLocaleDateString()}\n\n`;
        textContent += `Shared from Vilm App`;

        shareData.text = textContent;
      } else if (format === 'json') {
        // Create JSON content
        const jsonData = {
          title: vilm.title,
          transcript: includeTranscript ? vilm.transcript : undefined,
          duration: vilm.duration,
          createdAt: vilm.createdAt.toISOString(),
          sharedFrom: 'Vilm App'
        };

        shareData.text = JSON.stringify(jsonData, null, 2);
      }

      // If audio is requested and available
      if (includeAudio && vilm.audioFilename) {
        try {
          console.log('[ShareService] Starting audio share preparation');
          
          // Ensure temp_share directory exists
          try {
            await Filesystem.mkdir({
              path: 'temp_share',
              directory: Directory.Cache,
              recursive: true
            });
          } catch (mkdirError) {
            console.log('[ShareService] temp_share directory exists or created');
          }

          // Get audio file data directly
          const { data: base64Data, mimeType } = await nativeAudioService.getAudioFileData(vilm.audioFilename);
          
          // Determine proper file extension from MIME type
          let extension = 'm4a';
          if (mimeType.includes('webm')) {
            extension = 'webm';
          } else if (mimeType.includes('mp4')) {
            extension = 'mp4';
          }
          
          const tempFileName = `vilm_${vilm.id}_${Date.now()}.${extension}`;
          console.log('[ShareService] Creating temp file:', tempFileName);
          
          // Write temporary file for sharing
          await Filesystem.writeFile({
            path: `temp_share/${tempFileName}`,
            data: base64Data,
            directory: Directory.Cache
          });

          console.log('[ShareService] Temp file created, getting URI');

          // Get the file URI for sharing
          const fileUri = await Filesystem.getUri({
            directory: Directory.Cache,
            path: `temp_share/${tempFileName}`
          });

          console.log('[ShareService] Got file URI:', fileUri.uri);

          // Use proper file URI for Capacitor Share
          shareData.files = [fileUri.uri];
          shareData.url = fileUri.uri; // Some platforms need this
          
        } catch (audioError) {
          console.error('[ShareService] Failed to include audio in share:', audioError);
          console.error('[ShareService] Error details:', {
            message: audioError.message,
            stack: audioError.stack,
            vilmId: vilm.id,
            audioFilename: vilm.audioFilename
          });
          // Continue without audio - share text only
        }
      }

      console.log('[ShareService] Calling Share.share with data:', {
        hasTitle: !!shareData.title,
        hasText: !!shareData.text,
        hasFiles: !!shareData.files,
        hasUrl: !!shareData.url
      });

      // Share using Capacitor Share plugin
      const shareResult = await Share.share(shareData);
      
      console.log('[ShareService] Share result:', shareResult);

      // Clean up temporary files after a delay
      if (shareData.files) {
        setTimeout(() => this.cleanupTempShareFiles(), 5000);
      }

    } catch (error) {
      console.error('[ShareService] Sharing failed:', error);
      console.error('[ShareService] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Provide more specific error messages
      if (error.message?.includes('NotAllowedError')) {
        throw new Error('Sharing is not allowed. Please check app permissions.');
      } else if (error.message?.includes('AbortError')) {
        throw new Error('Sharing was cancelled.');
      } else {
        throw new Error(`Failed to share Vilm: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async shareTranscript(vilm: Vilm): Promise<void> {
    await this.shareVilm(vilm, {
      includeAudio: false,
      includeTranscript: true,
      format: 'text'
    });
  }

  async shareAudio(vilm: Vilm): Promise<void> {
    if (!vilm.audioFilename) {
      throw new Error('No audio file available to share');
    }

    console.log('[ShareService] shareAudio called for vilm:', vilm.id);

    await this.shareVilm(vilm, {
      includeAudio: true,
      includeTranscript: false,
      format: 'text'
    });
  }

  async exportAsText(vilm: Vilm): Promise<string> {
    try {
      const fileName = `vilm_${vilm.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
      
      let content = `📝 ${vilm.title}\n\n`;
      
      if (vilm.transcript) {
        content += `Transcript:\n${vilm.transcript}\n\n`;
      }
      
      content += `Duration: ${this.formatDuration(vilm.duration)}\n`;
      content += `Created: ${vilm.createdAt.toLocaleDateString()}\n\n`;
      content += `Exported from Vilm App`;

      // Write to Documents directory
      await Filesystem.writeFile({
        path: `exports/${fileName}`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return fileName;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export Vilm as text');
    }
  }

  async exportAsJSON(vilms: Vilm[]): Promise<string> {
    try {
      const fileName = `vilms_export_${Date.now()}.json`;
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalVilms: vilms.length,
        data: vilms.map(vilm => ({
          id: vilm.id,
          title: vilm.title,
          transcript: vilm.transcript,
          duration: vilm.duration,
          createdAt: vilm.createdAt.toISOString(),
          updatedAt: vilm.updatedAt.toISOString()
        }))
      };

      await Filesystem.writeFile({
        path: `exports/${fileName}`,
        data: JSON.stringify(exportData, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return fileName;
    } catch (error) {
      console.error('JSON export failed:', error);
      throw new Error('Failed to export Vilms as JSON');
    }
  }

  private async cleanupTempShareFiles(): Promise<void> {
    try {
      // Ensure temp_share directory exists first
      try {
        await Filesystem.mkdir({
          path: 'temp_share',
          directory: Directory.Cache,
          recursive: true
        });
      } catch (mkdirError) {
        // Directory might already exist, continue
        console.debug('Temp share directory already exists or mkdir failed:', mkdirError);
      }

      // Clean up temporary share files
      const result = await Filesystem.readdir({
        path: 'temp_share',
        directory: Directory.Cache
      });

      if (!result.files || result.files.length === 0) {
        console.debug('No temporary share files to cleanup');
        return;
      }

      console.debug(`Cleaning up ${result.files.length} temporary share files`);
      
      for (const file of result.files) {
        if (!file.name) continue;
        
        try {
          await Filesystem.deleteFile({
            path: `temp_share/${file.name}`,
            directory: Directory.Cache
          });
          console.debug(`Successfully deleted temp share file: ${file.name}`);
        } catch (deleteError) {
          console.error(`Failed to cleanup temp share file ${file.name}:`, deleteError);
          // Continue with other files even if one fails
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temporary share files:', error);
      // Don't throw error as this is cleanup - shouldn't break the app
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  async canShare(): Promise<boolean> {
    try {
      const result = await Share.canShare();
      return result.value;
    } catch {
      return false;
    }
  }
}

export const sharingService = new SharingService();