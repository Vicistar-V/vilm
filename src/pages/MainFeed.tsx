import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { VilmCard } from '@/components/vilm/VilmCard';
import { EmptyState } from '@/components/vilm/EmptyState';
import { RecordingModal } from '@/components/vilm/RecordingModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Vilm, RecordingState } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';

interface MainFeedProps {
  vilms: Vilm[];
  onVilmClick: (vilm: Vilm) => void;
  onCreateVilm: (title: string) => void;
}

export const MainFeed: React.FC<MainFeedProps> = ({
  vilms,
  onVilmClick,
  onCreateVilm
}) => {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    isProcessing: false
  });
  
  const { impact } = useHaptics();

  // Mock recording functionality (UI only as requested)
  const handleStartRecording = () => {
    setRecordingState({
      isRecording: true,
      duration: 0,
      isProcessing: false
    });

    // Simulate recording timer
    const interval = setInterval(() => {
      setRecordingState(prev => ({
        ...prev,
        duration: prev.duration + 1
      }));
    }, 1000);

    // Store interval reference for cleanup
    (window as any).recordingInterval = interval;
  };

  const handleStopRecording = () => {
    if ((window as any).recordingInterval) {
      clearInterval((window as any).recordingInterval);
      delete (window as any).recordingInterval;
    }

    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true
    }));

    // Simulate processing delay
    setTimeout(() => {
      setRecordingState(prev => ({
        ...prev,
        isProcessing: false
      }));
    }, 1000);
  };

  const handleOpenRecording = async () => {
    await impact();
    setIsRecordingModalOpen(true);
  };

  const handleCloseRecording = () => {
    if ((window as any).recordingInterval) {
      clearInterval((window as any).recordingInterval);
      delete (window as any).recordingInterval;
    }
    
    setIsRecordingModalOpen(false);
    setRecordingState({
      isRecording: false,
      duration: 0,
      isProcessing: false
    });
  };

  const handleSaveVilm = (title: string) => {
    onCreateVilm(title || `Note from ${new Date().toLocaleDateString()}`);
    handleCloseRecording();
  };

  return (
    <div className={cn(
      "min-h-screen-safe bg-background",
      "flex flex-col"
    )}>
      {/* Header */}
      <header className={cn(
        "flex items-center justify-between p-6",
        "pt-safe-top bg-background",
        "border-b border-vilm-border/50"
      )}>
        <h1 className="text-2xl font-semibold text-vilm-text-primary">
          Vilm
        </h1>
        
        <ThemeToggle />
      </header>

      {/* Content */}
      <main className="flex-1 p-6 pb-24">
        {vilms.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {vilms.map((vilm) => (
              <VilmCard
                key={vilm.id}
                vilm={vilm}
                onClick={() => onVilmClick(vilm)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={handleOpenRecording} />

      {/* Recording Modal */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={handleCloseRecording}
        onSave={handleSaveVilm}
        recordingState={recordingState}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
      />
    </div>
  );
};