import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { VilmCard } from '@/components/vilm/VilmCard';
import { EmptyState } from '@/components/vilm/EmptyState';
import { RecordingModal } from '@/components/vilm/RecordingModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Vilm } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';
import { useVilmStorage } from '@/hooks/useVilmStorage';
import { AudioRecording } from '@/services/nativeAudioService';

interface MainFeedProps {
  onVilmClick: (vilm: Vilm) => void;
}

export const MainFeed: React.FC<MainFeedProps> = ({
  onVilmClick
}) => {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const { impact } = useHaptics();
  const { vilms, loading, error, createVilm } = useVilmStorage();

  const handleOpenRecording = async () => {
    await impact();
    setIsRecordingModalOpen(true);
  };

  const handleCloseRecording = () => {
    setIsRecordingModalOpen(false);
  };

  const handleSaveVilm = async (title: string, transcript: string, duration: number, recording: AudioRecording) => {
    try {
      await createVilm(title, transcript, duration, recording);
      handleCloseRecording();
    } catch (error) {
      console.error('Failed to save vilm:', error);
      // You could show a toast error here
    }
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
        {loading ? (
          <div className="text-center py-8">
            <p className="text-vilm-text-secondary">Loading your notes...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500">Error: {error}</p>
          </div>
        ) : vilms.length === 0 ? (
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
      />
    </div>
  );
};