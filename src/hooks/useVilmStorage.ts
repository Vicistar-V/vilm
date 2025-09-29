import { useState, useEffect } from 'react';
import { Vilm } from '@/types/vilm';
import { dexieVilmStorage } from '@/services/dexieStorage';
import { nativeAudioService, AudioRecording } from '@/services/nativeAudioService';
import { transcriptionService } from '@/services/transcriptionService';
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

  const createVilm = async (title: string, transcript: string, duration: number, tempRecording: AudioRecording): Promise<void> => {
    try {
      setError(null);
      
      // Generate a unique ID for the vilm
      const id = uuidv4();
      
      // Move audio file from temporary to permanent location
      const audioFilename = await nativeAudioService.saveRecordingPermanently(tempRecording);
      
      // Create the vilm object with transcription state
      const vilm = {
        id,
        title,
        transcript,
        duration,
        audioFilename,
        isTranscribing: true, // Mark as currently transcribing
        transcriptionError: undefined
      };
      
      // Save to Dexie storage
      await dexieVilmStorage.saveVilm(vilm);
      
      // Reload the list to show the new vilm with loading state
      await loadVilms();
      
      // Start transcription process in background (don't wait for it)
      startTranscriptionProcess(id, audioFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vilm');
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
      const result = await transcriptionService.transcribeAudio(audioFilename);
      
      if (result.isSuccess && result.transcript.trim()) {
        // Update the vilm with successful transcription
        await dexieVilmStorage.updateVilm(vilmId, {
          transcript: result.transcript,
          isTranscribing: false,
          transcriptionError: undefined
        });
      } else {
        // Update with transcription error
        await dexieVilmStorage.updateVilm(vilmId, {
          isTranscribing: false,
          transcriptionError: result.error || 'Transcription failed'
        });
      }
      
      // Reload vilms to show updated state
      await loadVilms();
    } catch (error) {
      console.error('Background transcription failed:', error);
      
      // Update with transcription error
      try {
        await dexieVilmStorage.updateVilm(vilmId, {
          isTranscribing: false,
          transcriptionError: 'Transcription service unavailable'
        });
        await loadVilms();
      } catch (updateError) {
        console.error('Failed to update vilm with error state:', updateError);
      }
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
    transcriptionService
  };
};