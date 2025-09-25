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
          // Create a temporary share file
          const tempFileName = `vilm_${vilm.id}_${Date.now()}.m4a`;
          const audioDataUrl = await nativeAudioService.getAudioFile(vilm.audioFilename);
          
          // Convert data URL to base64
          const base64Data = audioDataUrl.split(',')[1];
          
          // Write temporary file for sharing
          await Filesystem.writeFile({
            path: `temp_share/${tempFileName}`,
            data: base64Data,
            directory: Directory.Cache
          });

          // Get the file URI for sharing
          const fileUri = await Filesystem.getUri({
            directory: Directory.Cache,
            path: `temp_share/${tempFileName}`
          });

          shareData.files = [fileUri.uri];
        } catch (audioError) {
          console.error('Failed to include audio in share:', audioError);
          // Continue without audio
        }
      }

      // Share using Capacitor Share plugin
      await Share.share(shareData);

      // Clean up temporary files after a delay
      if (shareData.files) {
        setTimeout(() => this.cleanupTempShareFiles(), 5000);
      }

    } catch (error) {
      console.error('Sharing failed:', error);
      throw new Error('Failed to share Vilm');
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
      // Clean up temporary share files
      const result = await Filesystem.readdir({
        path: 'temp_share',
        directory: Directory.Cache
      });

      for (const file of result.files) {
        try {
          await Filesystem.deleteFile({
            path: `temp_share/${file.name}`,
            directory: Directory.Cache
          });
        } catch (error) {
          console.error('Failed to cleanup temp share file:', error);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
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