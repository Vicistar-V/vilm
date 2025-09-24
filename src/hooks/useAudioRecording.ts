import { useState, useCallback, useRef, useEffect } from 'react';
import { audioService } from '@/services/audioService';
import { RecordingState } from '@/types/vilm';

export const useAudioRecording = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    isProcessing: false
  });

  const [currentRecording, setCurrentRecording] = useState<Blob | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkPermission = useCallback(async () => {
    const permission = await audioService.requestPermissions();
    setHasPermission(permission);
    return permission;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!hasPermission) {
        const permission = await checkPermission();
        if (!permission) {
          throw new Error('Audio permission required');
        }
      }

      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: true
      });

      const success = await audioService.startRecording();
      
      if (success) {
        setRecordingState({
          isRecording: true,
          duration: 0,
          isProcessing: false
        });

        // Start duration timer
        intervalRef.current = setInterval(() => {
          setRecordingState(prev => ({
            ...prev,
            duration: audioService.getCurrentDuration()
          }));
        }, 1000);
      } else {
        setRecordingState({
          isRecording: false,
          duration: 0,
          isProcessing: false
        });
        throw new Error('Failed to start recording');
      }
    } catch (error) {
      console.error('Recording start error:', error);
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });
      throw error;
    }
  }, [hasPermission, checkPermission]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: true
      }));

      const audioBlob = await audioService.stopRecording();
      
      setRecordingState(prev => ({
        ...prev,
        isProcessing: false
      }));

      setCurrentRecording(audioBlob);
      return audioBlob;
    } catch (error) {
      console.error('Recording stop error:', error);
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });
      return null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (audioService.isRecording()) {
      audioService.stopRecording();
    }

    setRecordingState({
      isRecording: false,
      duration: 0,
      isProcessing: false
    });
    
    setCurrentRecording(null);
  }, []);

  useEffect(() => {
    checkPermission();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkPermission]);

  return {
    recordingState,
    currentRecording,
    hasPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    checkPermission
  };
};