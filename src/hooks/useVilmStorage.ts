import { useState, useEffect } from 'react';
import { Vilm } from '@/types/vilm';
import { dexieVilmStorage } from '@/services/dexieStorage';
import { nativeAudioService, AudioRecording } from '@/services/nativeAudioService';
import { browserTranscriptionService } from '@/services/browserTranscriptionService';
import { permissionsService } from '@/services/permissionsService';
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

  const createVilm = async (title: string, duration: number, tempRecording: AudioRecording): Promise<void> => {
    try {
      setError(null);
      
      const id = uuidv4();
      
      const audioFilename = await nativeAudioService.saveRecordingPermanently(tempRecording);
      
      const vilm = {
        id,
        title,
        transcript: '',
        duration,
        audioFilename,
        transcriptionStatus: 'processing' as const,
        transcriptionError: undefined,
        transcriptionRetryCount: 0
      };
      
      await dexieVilmStorage.saveVilm(vilm);
      
      await loadVilms();
      
      startTranscriptionProcess(id, audioFilename);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create vilm';
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

  const retryTranscription = async (vilmId: string): Promise<void> => {
    try {
      setError(null);
      const vilm = await dexieVilmStorage.getVilmById(vilmId);
      if (!vilm || !vilm.audioFilename) {
        throw new Error('Vilm or audio file not found');
      }

      // Update vilm to processing status
      await dexieVilmStorage.updateVilm(vilmId, {
        transcriptionStatus: 'processing',
        transcriptionError: undefined,
        transcriptionRetryCount: (vilm.transcriptionRetryCount || 0) + 1
      });

      // Update local state
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { 
              ...v, 
              transcriptionStatus: 'processing' as const, 
              transcriptionError: undefined,
              transcriptionRetryCount: (v.transcriptionRetryCount || 0) + 1
            } 
          : v
      ));

      // Start transcription process
      await startTranscriptionProcess(vilmId, vilm.audioFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry transcription');
      throw err;
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
      await dexieVilmStorage.updateVilm(vilmId, {
        transcriptionStatus: 'processing',
        transcriptionError: undefined 
      });
      
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { ...v, transcriptionStatus: 'processing' as const, transcriptionError: undefined }
          : v
      ));

      const audioDataUrl = await nativeAudioService.getAudioFile(audioFilename);
      const result = await browserTranscriptionService.transcribeAudio(audioDataUrl);
      
      if (result.isSuccess && result.transcript) {
        
        await dexieVilmStorage.updateVilm(vilmId, {
          transcript: result.transcript,
          transcriptionStatus: 'completed'
        });
        
        setVilms(prev => prev.map(v => 
          v.id === vilmId 
            ? { ...v, transcript: result.transcript, transcriptionStatus: 'completed' as const }
            : v
        ));
      } else {
        const errorMsg = result.error || 'Transcription failed';
        
        await dexieVilmStorage.updateVilm(vilmId, {
          transcriptionStatus: 'failed',
          transcriptionError: errorMsg
        });
        
        setVilms(prev => prev.map(v => 
          v.id === vilmId 
            ? { ...v, transcriptionStatus: 'failed' as const, transcriptionError: errorMsg }
            : v
        ));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      await dexieVilmStorage.updateVilm(vilmId, {
        transcriptionStatus: 'failed',
        transcriptionError: `Transcription failed: ${errorMsg}`
      });
      
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { ...v, transcriptionStatus: 'failed' as const, transcriptionError: `Transcription failed: ${errorMsg}` }
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
    retryTranscription,
    browserTranscriptionService
  };
};