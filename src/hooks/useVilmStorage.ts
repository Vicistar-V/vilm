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

  const createVilm = async (title: string, transcript: string, duration: number, tempRecording: AudioRecording): Promise<void> => {
    try {
      setError(null);
      
      console.log('[useVilmStorage] Creating vilm with temp recording:', tempRecording.id);
      
      // Generate a unique ID for the vilm
      const id = uuidv4();
      
      // Move audio file from temporary to permanent location
      console.log('[useVilmStorage] Saving recording permanently');
      const audioFilename = await nativeAudioService.saveRecordingPermanently(tempRecording);
      console.log('[useVilmStorage] Audio saved as:', audioFilename);
      
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
      console.log('[useVilmStorage] Saving vilm to storage');
      await dexieVilmStorage.saveVilm(vilm);
      
      // Reload the list to show the new vilm with loading state
      await loadVilms();
      
      // Start transcription process in background (don't wait for it)
      console.log('[useVilmStorage] Starting transcription process');
      startTranscriptionProcess(id, audioFilename);
    } catch (err) {
      console.error('[useVilmStorage] Failed to create vilm:', err);
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
      console.log('[useVilmStorage] Starting browser-based transcription for:', audioFilename);
      
      // Mark as transcribing
      await dexieVilmStorage.updateVilm(vilmId, { 
        isTranscribing: true,
        transcriptionError: undefined 
      });
      
      setVilms(prev => prev.map(v => 
        v.id === vilmId 
          ? { ...v, isTranscribing: true, transcriptionError: undefined }
          : v
      ));

      console.log('[useVilmStorage] Getting audio file for transcription');
      
      // Get audio file as data URL
      const audioDataUrl = await nativeAudioService.getAudioFile(audioFilename);
      
      console.log('[useVilmStorage] Audio file loaded, starting transcription');
      
      // Transcribe using browser-based Whisper
      const result = await browserTranscriptionService.transcribeAudio(audioDataUrl);
      
      console.log('[useVilmStorage] Transcription result:', { 
        isSuccess: result.isSuccess, 
        hasTranscript: !!result.transcript,
        error: result.error 
      });
      
      if (result.isSuccess && result.transcript) {
        // Update with transcript
        await dexieVilmStorage.updateVilm(vilmId, {
          transcript: result.transcript,
          isTranscribing: false
        });
        
        setVilms(prev => prev.map(v => 
          v.id === vilmId 
            ? { ...v, transcript: result.transcript, isTranscribing: false }
            : v
        ));
        
        console.log('[useVilmStorage] Transcription successful');
      } else {
        // Handle transcription failure
        const errorMsg = result.error || 'Transcription failed';
        console.error('[useVilmStorage] Transcription failed:', errorMsg);
        
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
      console.error('[useVilmStorage] Error during transcription:', error);
      console.error('[useVilmStorage] Error details:', {
        message: error.message,
        stack: error.stack,
        vilmId,
        audioFilename
      });
      
      const errorMsg = `Transcription failed: ${error.message || 'Unknown error'}`;
      
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