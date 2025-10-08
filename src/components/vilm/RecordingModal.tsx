import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Square, Save, Trash2 } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { AudioRecording } from '@/services/nativeAudioService';
import { App } from '@capacitor/app';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, recording: AudioRecording) => Promise<void>;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const generateDefaultTitle = (): string => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const time = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  return `Note from ${date} at ${time}`;
};

const WaveformVisualizer: React.FC<{ isRecording: boolean }> = ({ isRecording }) => {
  return (
    <div className="flex items-center justify-center space-x-1 h-16">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-vilm-recording rounded-full"
          animate={{
            height: isRecording ? [8, 32, 16, 40, 8] : [8],
          }}
          transition={{
            duration: 0.8,
            repeat: isRecording ? Infinity : 0,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
};

export const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [noteTitle, setNoteTitle] = useState('');
  const [stage, setStage] = useState<'recording' | 'finalize'>('recording');
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTriggered = useRef(false);
  const { impact } = useHaptics();
  const { 
    recordingState, 
    currentRecording, 
    startRecording, 
    stopRecording, 
    cancelRecording,
    hasPermission,
    isCheckingPermission,
    debugLog
  } = useAudioRecording();

  // Auto-save grace rule: save recording if app goes to background during finalize stage
  useEffect(() => {
    let appStateListener: any;

    const setupAppStateListener = async () => {
      appStateListener = await App.addListener('appStateChange', (state) => {
        // If app goes to background while in finalize stage and hasn't been auto-saved yet
        if (!state.isActive && stage === 'finalize' && currentRecording && !autoSaveTriggered.current) {
          autoSaveTriggered.current = true;
          handleAutoSave();
        }
      });
    };

    if (isOpen && stage === 'finalize') {
      setupAppStateListener();
    }

    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [isOpen, stage, currentRecording]);

  const handleAutoSave = async () => {
    if (!currentRecording) return;
    
    try {
      const defaultTitle = generateDefaultTitle();
      // Pass the recording object (temporary file info) to be saved permanently
      await onSave(defaultTitle, currentRecording);
    } catch (error) {
      console.error('Failed to auto-save recording:', error);
    }
  };

  // Reset auto-save flag when modal opens/closes or stage changes
  useEffect(() => {
    if (!isOpen || stage === 'recording') {
      autoSaveTriggered.current = false;
    }
  }, [isOpen, stage]);
  
  useEffect(() => {
    if (isOpen && stage === 'recording' && !recordingState.isRecording && !recordingState.isProcessing) {
      startRecording().catch((error) => {
        console.error('Failed to start recording:', error);
        onClose();
      });
    }
  }, [isOpen, stage, recordingState.isRecording, recordingState.isProcessing, startRecording, onClose]);

  const handleStopRecording = async () => {
    await impact();
    const recording = await stopRecording();
    if (recording) {
      setStage('finalize');
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!currentRecording) return;
    
    try {
      setIsSaving(true);
      await impact();
      // Pass the recording object (temporary file info) to be saved permanently
      await onSave(noteTitle.trim() || generateDefaultTitle(), currentRecording);
      setNoteTitle('');
      setStage('recording');
      onClose();
    } catch (error) {
      console.error('Failed to save recording:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (currentRecording?.isTemporary) {
      // Clean up temporary file
      try {
        await cancelRecording();
      } catch (error) {
        console.error('Failed to cleanup temporary recording:', error);
      }
    }
    setNoteTitle('');
    setStage('recording');
    onClose();
  };

  const handleClose = () => {
    // If in finalize stage and hasn't been auto-saved, trigger auto-save
    if (stage === 'finalize' && currentRecording && !autoSaveTriggered.current) {
      autoSaveTriggered.current = true;
      handleAutoSave().then(() => {
        setNoteTitle('');
        setStage('recording');
        onClose();
      });
      return;
    }
    
    // Otherwise, clean up temporary file if it exists
    if (currentRecording?.isTemporary) {
      cancelRecording().catch(console.error);
    }
    setNoteTitle('');
    setStage('recording');
    onClose();
  };



  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={stage === 'finalize' ? handleClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50",
              "bg-card border-t border-vilm-border",
              "rounded-t-3xl shadow-2xl",
              "pb-safe-bottom"
            )}
          >
            {stage === 'recording' ? (
              // Recording Stage
              <div className="p-6 pt-8 text-center">
                {/* Pull indicator */}
                <div className="w-12 h-1 bg-vilm-border rounded-full mx-auto mb-8" />

                {/* Recording Visual */}
                <div className="mb-8">
                  <motion.div
                    animate={{
                      scale: recordingState.isRecording ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                      duration: 2,
                      repeat: recordingState.isRecording ? Infinity : 0,
                    }}
                    className={cn(
                      "w-32 h-32 mx-auto rounded-full mb-6",
                      "flex items-center justify-center",
                      "bg-vilm-recording/10 border-4 border-vilm-recording"
                    )}
                  >
                    <WaveformVisualizer isRecording={recordingState.isRecording} />
                  </motion.div>

                  {/* Timer or Preparing Message */}
                  {recordingState.isProcessing && !recordingState.isRecording ? (
                    <div className="text-center">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-2xl font-medium text-vilm-text-secondary mb-2"
                      >
                        Preparing to record...
                      </motion.div>
                      <p className="text-sm text-vilm-text-secondary/70">
                        Initializing microphone
                      </p>
                    </div>
                  ) : (
                    <div className="text-3xl font-semibold text-vilm-text-primary font-mono">
                      {formatTime(recordingState.duration)}
                    </div>
                  )}
                </div>

                {/* Stop Button */}
                <Button
                  onClick={handleStopRecording}
                  size="lg"
                  className={cn(
                    "w-20 h-20 rounded-full",
                    "bg-vilm-recording hover:bg-vilm-recording/90",
                    "text-white shadow-lg"
                  )}
                  disabled={recordingState.isProcessing || !recordingState.isRecording}
                >
                  <Square size={24} fill="currentColor" />
                </Button>

                <p className="text-vilm-text-secondary mt-4 text-sm">
                  {recordingState.isProcessing && !recordingState.isRecording
                    ? 'Getting ready...'
                    : recordingState.isProcessing
                    ? 'Processing...'
                    : 'Tap to stop recording'}
                </p>

                {/* Debug Panel */}
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg max-h-64 overflow-y-auto text-left">
                  <div className="text-xs font-bold text-red-600 mb-3 flex items-center justify-between">
                    <span>🔍 DEBUG INFO (Temporary)</span>
                    <span className="font-normal text-red-500">Live Diagnostics</span>
                  </div>
                  
                  {/* Current State */}
                  <div className="mb-3 p-2 bg-black/20 rounded text-xs font-mono space-y-1">
                    <div className="text-white">
                      <span className="text-yellow-400">isRecording:</span> {recordingState.isRecording ? '✅ TRUE' : '❌ FALSE'}
                    </div>
                    <div className="text-white">
                      <span className="text-yellow-400">isProcessing:</span> {recordingState.isProcessing ? '⏳ TRUE' : '✅ FALSE'}
                    </div>
                    <div className="text-white">
                      <span className="text-yellow-400">duration:</span> {recordingState.duration}s
                    </div>
                    <div className="text-white">
                      <span className="text-yellow-400">hasPermission:</span> {hasPermission === null ? '❓ NULL' : hasPermission ? '✅ TRUE' : '❌ FALSE'}
                    </div>
                  </div>

                  {/* Debug Log */}
                  <div className="space-y-1">
                    {debugLog.length === 0 ? (
                      <div className="text-xs text-red-400">No debug logs yet...</div>
                    ) : (
                      debugLog.map((log, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "text-xs font-mono p-1 rounded",
                            log.level === 'error' && "bg-red-900/30 text-red-300",
                            log.level === 'success' && "bg-green-900/30 text-green-300",
                            log.level === 'warning' && "bg-yellow-900/30 text-yellow-300",
                            log.level === 'info' && "bg-blue-900/30 text-blue-300"
                          )}
                        >
                          <span className="text-gray-400">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Finalize Stage
              <div className="p-6 pt-8">
                {/* Pull indicator */}
                <div className="w-12 h-1 bg-vilm-border rounded-full mx-auto mb-8" />

                 <div className="text-center mb-6">
                   <p className="text-vilm-text-secondary text-sm">
                     Recording completed • {formatTime(currentRecording?.duration || 0)}
                   </p>
                 </div>

                {/* Title Input */}
                <div className="mb-8">
                  <label className="block text-vilm-text-primary font-medium mb-3">
                    Give your note a title
                  </label>
                  <Input
                    autoFocus
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder={generateDefaultTitle()}
                    className={cn(
                      "text-base h-12",
                      "border-vilm-border focus:border-vilm-primary",
                      "rounded-xl"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSaving) {
                        handleSave();
                      }
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleDiscard}
                    disabled={isSaving}
                    className={cn(
                      "flex-1 h-12 rounded-xl",
                      "border-vilm-border text-vilm-text-secondary",
                      "hover:bg-vilm-hover"
                    )}
                  >
                    <Trash2 size={18} className="mr-2" />
                    Discard
                  </Button>
                  
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !currentRecording}
                    className={cn(
                      "flex-1 h-12 rounded-xl",
                      "bg-vilm-primary hover:bg-vilm-primary/90",
                      "text-white font-medium disabled:opacity-50"
                    )}
                  >
                    <Save size={18} className="mr-2" />
                    {isSaving ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};