import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordingState } from '@/types/vilm';
import { nativeAudioService, AudioRecording } from '@/services/nativeAudioService';

export const useAudioRecording = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    isProcessing: false
  });
  const [currentRecording, setCurrentRecording] = useState<AudioRecording | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  const checkPermission = async (): Promise<boolean> => {
    setIsCheckingPermission(true);
    const permission = await nativeAudioService.requestPermissions();
    setHasPermission(permission);
    setIsCheckingPermission(false);
    return permission;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Clear any previous recording
      setCurrentRecording(null);
      setCurrentRecordingId(null);

      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: true
      });

      const result = await nativeAudioService.startRecording();
      
      if (result.success && result.recordingId) {
        setCurrentRecordingId(result.recordingId);
        setHasPermission(true);
        
        // Wait a bit for MediaRecorder's onstart to fire
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setRecordingState({
          isRecording: true,
          duration: 0,
          isProcessing: false
        });

        // Start duration timer - now synced with actual MediaRecorder start
        durationTimer.current = setInterval(() => {
          setRecordingState(prev => ({
            ...prev,
            duration: nativeAudioService.getCurrentDuration()
          }));
        }, 1000);

        return true;
      } else {
        setRecordingState({
          isRecording: false,
          duration: 0,
          isProcessing: false
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });
      return false;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<AudioRecording | null> => {
    try {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      setRecordingState(prev => ({
        ...prev,
        isProcessing: true
      }));

      const recording = await nativeAudioService.stopRecording();
      
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });

      setCurrentRecording(recording);
      setCurrentRecordingId(null);
      return recording;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async (): Promise<void> => {
    try {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      if (recordingState.isRecording) {
        await nativeAudioService.stopRecording();
      }

      // Clean up any temporary recording
      if (currentRecordingId) {
        await nativeAudioService.deleteTemporaryRecording(currentRecordingId);
      }
      
      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: false
      });
      
      setCurrentRecording(null);
      setCurrentRecordingId(null);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }, [recordingState.isRecording, currentRecordingId]);

  useEffect(() => {
    // Avoid requesting permissions on mount to prevent NotAllowedError on webviews
    // Cleanup abandoned temp files on init
    nativeAudioService.cleanupAbandonedTempFiles().catch(console.error);
    
    // Cleanup timer on unmount
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, []);

  return {
    recordingState,
    currentRecording,
    hasPermission,
    currentRecordingId,
    isCheckingPermission,
    currentStream: nativeAudioService.getCurrentStream(),
    checkPermission,
    startRecording,
    stopRecording,
    cancelRecording
  };
};