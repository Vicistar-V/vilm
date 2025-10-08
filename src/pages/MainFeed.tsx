import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { VilmCard } from '@/components/vilm/VilmCard';
import { EmptyState } from '@/components/vilm/EmptyState';
import { RecordingModal } from '@/components/vilm/RecordingModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Vilm } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';
import { useVilmStorage } from '@/hooks/useVilmStorage';
import { useToast } from '@/hooks/use-toast';
import { AudioRecording } from '@/services/nativeAudioService';
import { permissionsService } from '@/services/permissionsService';

interface MainFeedProps {
  onVilmClick: (vilm: Vilm) => void;
  onSettingsClick: () => void;
  widgetAudioPath?: string | null;
  onWidgetAudioProcessed?: () => void;
}

export const MainFeed: React.FC<MainFeedProps> = ({
  onVilmClick,
  onSettingsClick,
  widgetAudioPath,
  onWidgetAudioProcessed
}) => {
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const { impact, selection } = useHaptics();
  const { vilms, loading, error, createVilm, deleteVilm } = useVilmStorage();
  const { toast } = useToast();

  // Auto-open recording modal when widget audio is available
  useEffect(() => {
    if (widgetAudioPath) {
      setIsRecordingModalOpen(true);
    }
  }, [widgetAudioPath]);

  // Preload microphone permissions on mount for faster subsequent recordings
  useEffect(() => {
    permissionsService.checkAllPermissions().catch(console.error);
  }, []);

  const handleOpenRecording = () => {
    setIsRecordingModalOpen(true);
    impact().catch(console.error); // fire-and-forget for instant UI
  };

  const handleSettingsClick = async () => {
    await selection();
    onSettingsClick();
  };

  const handleCloseRecording = () => {
    setIsRecordingModalOpen(false);
    
    // Clear widget audio if it was from widget
    if (widgetAudioPath && onWidgetAudioProcessed) {
      onWidgetAudioProcessed();
    }
  };

  const handleSaveVilm = async (title: string, recording: AudioRecording) => {
    try {
      await createVilm(title, recording.duration, recording);
      handleCloseRecording();
    } catch (error) {
      console.error('Failed to save vilm:', error);
      toast({
        title: "Error",
        description: "Failed to save recording",
        variant: "destructive"
      });
    }
  };

  const handleDeleteVilm = async (vilmId: string) => {
    try {
      await deleteVilm(vilmId);
    } catch (error) {
      console.error('Failed to delete vilm:', error);
    }
  };

  const handleVilmClick = async (vilm: Vilm) => {
    console.log('Vilm clicked:', { 
      id: vilm.id, 
      title: vilm.title,
      audioFilename: vilm.audioFilename, 
      isAudioReady: vilm.isAudioReady 
    });
    
    // Fire-and-forget haptic feedback for instant response
    selection().catch(console.error);
    
    // Safety check: ensure audio file exists before navigating
    if (!vilm.audioFilename) {
      console.warn('Cannot navigate to vilm without audio file');
      toast({
        title: "Cannot open",
        description: "Audio file is missing",
        variant: "destructive"
      });
      return;
    }
    
    // Prevent navigation if audio not ready (catches both false and undefined)
    if (vilm.isAudioReady !== true) {
      console.warn('Audio file not ready yet:', vilm.isAudioReady);
      toast({
        title: "Audio still processing",
        description: "Please wait a moment and try again",
      });
      return;
    }
    
    onVilmClick(vilm);
  };

  return (
    <div className={cn(
      "min-h-screen-safe bg-background",
      "flex flex-col"
    )}>
      {/* Header */}
      <header className={cn(
        "px-6 py-6",
        "pt-[calc(env(safe-area-inset-top)+1.5rem)]",
        "bg-gradient-to-b from-background to-background/50",
        "border-b border-border/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Vilm
            </h1>
            <p className="text-sm text-muted-foreground">
              save your thoughts quicky
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSettingsClick}
              className="h-10 w-10 rounded-full hover:bg-muted/50 transition-all duration-200"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
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
                onClick={() => handleVilmClick(vilm)}
                onDelete={handleDeleteVilm}
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
        widgetAudioPath={widgetAudioPath}
      />
    </div>
  );
};