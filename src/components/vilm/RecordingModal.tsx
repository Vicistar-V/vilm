import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Square, Save, X } from 'lucide-react';
import { RecordingState } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  onSave,
  recordingState,
  onStartRecording,
  onStopRecording
}) => {
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<'recording' | 'finalize'>('recording');
  const { impact, notification } = useHaptics();

  useEffect(() => {
    if (isOpen) {
      setStage('recording');
      setTitle('');
      onStartRecording();
    }
  }, [isOpen, onStartRecording]);

  const handleStopRecording = async () => {
    await impact();
    onStopRecording();
    setStage('finalize');
    // Auto-focus will be handled by the Input component
  };

  const handleSave = async () => {
    await notification('success');
    onSave(title);
    onClose();
  };

  const handleDiscard = async () => {
    await impact();
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
            onClick={stage === 'finalize' ? onClose : undefined}
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

                  {/* Timer */}
                  <div className="text-3xl font-semibold text-vilm-text-primary font-mono">
                    {formatTime(recordingState.duration)}
                  </div>
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
                  disabled={recordingState.isProcessing}
                >
                  <Square size={24} fill="currentColor" />
                </Button>

                <p className="text-vilm-text-secondary mt-4 text-sm">
                  Tap to stop recording
                </p>
              </div>
            ) : (
              // Finalize Stage
              <div className="p-6 pt-8">
                {/* Pull indicator */}
                <div className="w-12 h-1 bg-vilm-border rounded-full mx-auto mb-8" />

                {/* Title Input */}
                <div className="mb-8">
                  <label className="block text-vilm-text-primary font-medium mb-3">
                    Give your note a title
                  </label>
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Note from ${new Date().toLocaleDateString()}`}
                    className={cn(
                      "text-base h-12",
                      "border-vilm-border focus:border-vilm-primary",
                      "rounded-xl"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
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
                    className={cn(
                      "flex-1 h-12 rounded-xl",
                      "border-vilm-border text-vilm-text-secondary",
                      "hover:bg-vilm-hover"
                    )}
                  >
                    <X size={18} className="mr-2" />
                    Discard
                  </Button>
                  
                  <Button
                    onClick={handleSave}
                    className={cn(
                      "flex-1 h-12 rounded-xl",
                      "bg-vilm-primary hover:bg-vilm-primary/90",
                      "text-white font-medium"
                    )}
                  >
                    <Save size={18} className="mr-2" />
                    Save Note
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