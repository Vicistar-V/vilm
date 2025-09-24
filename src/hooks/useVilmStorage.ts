import { useState, useEffect, useCallback } from 'react';
import { Vilm } from '@/types/vilm';
import { vilmStorage } from '@/services/storage';
import { audioService } from '@/services/audioService';

export const useVilmStorage = () => {
  const [vilms, setVilms] = useState<Vilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVilms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedVilms = await vilmStorage.getAllVilms();
      setVilms(loadedVilms);
    } catch (err) {
      setError('Failed to load vilms');
      console.error('Error loading vilms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createVilm = useCallback(async (
    title: string, 
    audioBlob: Blob, 
    duration: number,
    transcript: string = ''
  ): Promise<Vilm> => {
    try {
      const id = crypto.randomUUID();
      const filename = audioService.generateAudioFilename();
      
      // Save audio file
      const audioPath = await audioService.saveAudioFile(audioBlob, filename);
      
      const newVilm: Vilm = {
        id,
        title: title.trim() || `Recording ${new Date().toLocaleDateString()}`,
        transcript,
        duration,
        createdAt: new Date(),
        updatedAt: new Date(),
        audioFilename: filename,
        audioPath
      };

      await vilmStorage.saveVilm(newVilm);
      await loadVilms(); // Refresh the list
      
      return newVilm;
    } catch (err) {
      setError('Failed to create vilm');
      console.error('Error creating vilm:', err);
      throw err;
    }
  }, [loadVilms]);

  const deleteVilm = useCallback(async (id: string) => {
    try {
      const vilm = await vilmStorage.getVilmById(id);
      if (vilm?.audioFilename) {
        // Delete audio file
        await audioService.deleteAudioFile(vilm.audioFilename);
      }
      
      await vilmStorage.deleteVilm(id);
      await loadVilms(); // Refresh the list
    } catch (err) {
      setError('Failed to delete vilm');
      console.error('Error deleting vilm:', err);
      throw err;
    }
  }, [loadVilms]);

  const getVilmById = useCallback(async (id: string): Promise<Vilm | null> => {
    try {
      return await vilmStorage.getVilmById(id);
    } catch (err) {
      console.error('Error getting vilm by id:', err);
      return null;
    }
  }, []);

  const searchVilms = useCallback(async (query: string): Promise<Vilm[]> => {
    try {
      if (!query.trim()) {
        return vilms;
      }
      return await vilmStorage.searchVilms(query);
    } catch (err) {
      console.error('Error searching vilms:', err);
      return [];
    }
  }, [vilms]);

  useEffect(() => {
    loadVilms();
  }, [loadVilms]);

  return {
    vilms,
    loading,
    error,
    createVilm,
    deleteVilm,
    getVilmById,
    searchVilms,
    refreshVilms: loadVilms
  };
};