import { useState, useEffect } from 'react';
import { Vilm } from '@/types/vilm';
import { dexieVilmStorage } from '@/services/dexieStorage';
import { nativeAudioService, AudioRecording } from '@/services/nativeAudioService';
import { browserTranscriptionService } from '@/services/browserTranscriptionService';
import { permissionsService } from '@/services/permissionsService';
import { debugLogger } from '@/components/debug/DebugOverlay';
import { v4 as uuidv4 } from 'uuid';

export const useVilmStorage = () => {
  const [vilms, setVilms] = useState<Vilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVilms = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedVilms = await dexieVilmStorage.getAllVilms();
      setVilms(loadedVilms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vilms');
    } finally {
      setLoading(false);
    }
  };

  const createVilm = async (title: string, transcript: string, duration: number, tempRecording: AudioRecording): Promise<void> => {
    try {
      setError(null);
      
      debugLogger.info('Vilm', `Creating new Vilm: ${title}`);
      
      const id = uuidv4();
      
      debugLogger.info('Vilm', 'Saving recording permanently...');
      const audioFilename = await nativeAudioService.saveRecordingPermanently(tempRecording);
      debugLogger.success('Vilm', `Recording saved: ${audioFilename}`);
      
      const vilm = {
        id,
        title,
        transcript,
        duration,
        audioFilename,
        isTranscribing: true,
        transcriptionError: undefined
      };
      
      debugLogger.info('Vilm', 'Saving to database...');
      await dexieVilmStorage.saveVilm(vilm);
      
      await loadVilms();
      
      debugLogger.info('Vilm', 'Starting transcription...');
      startTranscriptionProcess(id, audioFilename);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create vilm';
      debugLogger.error('Vilm', `Create failed: ${errorMsg}`);
      setError(errorMsg);
      throw err;
    }
  };

  const deleteVilm = async (id: string): Promise<void> => {
    try {
      setError(null);
      
      // Get the vilm to find the audio filename
      const vilm = await dexieVilmStorage.getVilmById(id);
      
      if (vilm?.audioFilename) {
        // Delete the audio file
        await nativeAudioService.deleteAudioFile(vilm.audioFilename);
      }
      
      // Delete from Dexie storage
      await dexieVilmStorage.deleteVilm(id);
      
      // Reload the list
      await loadVilms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vilm');
      throw err;
    }
  };

  const getVilmById = async (id: string): Promise<Vilm | null> => {
    try {
      setError(null);
      return await dexieVilmStorage.getVilmById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get vilm');
      return null;
    }
  };

  const searchVilms = async (query: string): Promise<Vilm[]> => {
    try {
      setError(null);
      return await dexieVilmStorage.searchVilms(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search vilms');
      return [];
    }
  };

  useEffect(() => {
    // Initialize services and load data
    const initialize = async () => {
      try {
        // Initialize permissions service
        await permissionsService.initialize();
        
        // Initialize Dexie storage
        await dexieVilmStorage.init();
        
        // Clean up any abandoned temporary audio files on startup
        await nativeAudioService.cleanupAbandonedTempFiles();
        
        // Load vilms
        await loadVilms();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize storage');
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const startTranscriptionProcess = async (vilmId: string, audioFilename: string) => {
    try {
      debugLogger.info('Transcription', `Starting for: ${audioFilename}`);
      
      await dexieVilmStorage.updateVilm(vilmId, { 
        isTranscribing: true,
        transcriptionError: undefined 
      });
      
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { ...v, isTranscribing: true, transcriptionError: undefined }
          : v
      ));

      debugLogger.info('Transcription', 'Loading audio file...');
      const audioDataUrl = await nativeAudioService.getAudioFile(audioFilename);
      
      debugLogger.info('Transcription', 'Running Whisper model...');
      const result = await browserTranscriptionService.transcribeAudio(audioDataUrl);
      
      if (result.isSuccess && result.transcript) {
        debugLogger.success('Transcription', 'Transcription completed!');
        
        await dexieVilmStorage.updateVilm(vilmId, {
          transcript: result.transcript,
          isTranscribing: false
        });
        
        setVilms(prev => prev.map(v => 
          v.id === vilmId 
            ? { ...v, transcript: result.transcript, isTranscribing: false }
            : v
        ));
      } else {
        const errorMsg = result.error || 'Transcription failed';
        debugLogger.error('Transcription', `Failed: ${errorMsg}`);
        
        await dexieVilmStorage.updateVilm(vilmId, {
          isTranscribing: false,
          transcriptionError: errorMsg
        });
        
        setVilms(prev => prev.map(v => 
          v.id === vilmId 
            ? { ...v, isTranscribing: false, transcriptionError: errorMsg }
            : v
        ));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      debugLogger.error('Transcription', `Error: ${errorMsg}`);
      
      await dexieVilmStorage.updateVilm(vilmId, {
        isTranscribing: false,
        transcriptionError: `Transcription failed: ${errorMsg}`
      });
      
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { ...v, isTranscribing: false, transcriptionError: `Transcription failed: ${errorMsg}` }
          : v
      ));
    }
  };

  return {
    vilms,
    loading,
    error,
    createVilm,
    deleteVilm,
    getVilmById,
    searchVilms,
    refreshVilms: loadVilms,
    browserTranscriptionService
  };
};