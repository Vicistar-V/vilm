import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordingState } from '@/types/vilm';
import { nativeAudioService, AudioRecording } from '@/services/nativeAudioService';
import { transcriptionManager } from '@/services/transcriptionService';
import { webSpeechTranscriptionService } from '@/services/webSpeechTranscriptionService';

// Set Web Speech API as default transcription service
transcriptionManager.setActiveService(webSpeechTranscriptionService);

export interface DebugLogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

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
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  const addDebugLog = (message: string, level: DebugLogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    setDebugLog(prev => [...prev, { timestamp, message, level }]);
  };

  const checkPermission = async (): Promise<boolean> => {
    setIsCheckingPermission(true);
    const permission = await nativeAudioService.requestPermissions();
    setHasPermission(permission);
    setIsCheckingPermission(false);
    return permission;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      addDebugLog('🎙️ Starting recording process...', 'info');
      
      // Cancel any active transcription when starting new recording
      if (transcriptionManager.hasActiveTranscription()) {
        addDebugLog('⚠️ Cancelling previous transcription', 'warning');
        transcriptionManager.cancelActive();
      }
      
      // Clear any previous recording
      setCurrentRecording(null);
      setCurrentRecordingId(null);
      setDebugLog([]); // Clear previous debug logs
      
      addDebugLog('Clearing previous recording state', 'info');
      addDebugLog('Setting processing state to true', 'info');

      setRecordingState({
        isRecording: false,
        duration: 0,
        isProcessing: true
      });

      addDebugLog('Calling nativeAudioService.startRecording()', 'info');
      const result = await nativeAudioService.startRecording();
      
      addDebugLog(`Service returned: ${JSON.stringify(result)}`, result.success ? 'success' : 'error');
      
      if (result.error) {
        addDebugLog(`❌ Error: ${result.error}`, 'error');
      }
      
      if (result.success && result.recordingId) {
        addDebugLog(`✅ Recording started with ID: ${result.recordingId}`, 'success');
        setCurrentRecordingId(result.recordingId);
        setHasPermission(true);
        setRecordingState({
          isRecording: true,
          duration: 0,
          isProcessing: false
        });

        addDebugLog('Starting duration timer', 'success');
        // Start duration timer
        durationTimer.current = setInterval(() => {
          setRecordingState(prev => ({
            ...prev,
            duration: nativeAudioService.getCurrentDuration()
          }));
        }, 1000);

        addDebugLog('✅ Recording fully initialized', 'success');
        return true;
      } else {
        addDebugLog('❌ Failed to start recording - no recordingId', 'error');
        setRecordingState({
          isRecording: false,
          duration: 0,
          isProcessing: false
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addDebugLog(`❌ Exception in startRecording: ${errorMsg}`, 'error');
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
      
      if (recording && recording.blob) {
        // Start transcription immediately after recording stops
        setIsTranscribing(true);
        setTranscript('');
        setTranscriptionProgress('');
        
        addDebugLog('🎯 Starting post-recording transcription...', 'info');
        
        try {
          // Transcribe the recorded audio using the transcription manager
          const result = await transcriptionManager.transcribe(
            recording.blob,
            (progressTranscript) => {
              setTranscriptionProgress(progressTranscript);
            }
          );
          
          if (result.isSuccess) {
            setTranscript(result.transcript);
            addDebugLog('✅ Transcription completed', 'success');
          } else {
            setTranscript(''); // Clear transcript on failure
            addDebugLog(`⚠️ Transcription failed: ${result.error || 'Unknown error'}`, 'error');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          addDebugLog(`❌ Transcription exception: ${errorMsg}`, 'error');
          setTranscript('');
        }
        
        setIsTranscribing(false);
      }
      
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
      setIsTranscribing(false);
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

      // Cancel any active transcription
      transcriptionManager.cancelActive();
      
      setIsTranscribing(false);
      setTranscript('');
      setTranscriptionProgress('');

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
    isCheckingPermission,
    startRecording,
    stopRecording,
    cancelRecording,
    checkPermission,
    debugLog,
    transcript,
    isTranscribing,
    transcriptionProgress
  };
};