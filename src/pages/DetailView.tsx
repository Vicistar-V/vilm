import React, { useEffect, useState } from 'react';
import { ArrowLeft, Share, Trash2, FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AudioPlayer } from '@/components/vilm/AudioPlayer';
import { ShareMenu } from '@/components/vilm/ShareMenu';
import { TranscriptionStatus } from '@/components/vilm/TranscriptionStatus';
import { Vilm } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';
import { sharingService } from '@/services/sharingService';
import { useToast } from '@/hooks/use-toast';
import { ImpactStyle } from '@capacitor/haptics';
import { Clipboard } from '@capacitor/clipboard';
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';
import { dexieVilmStorage } from '@/services/dexieStorage';

interface DetailViewProps {
  vilm: Vilm;
  onBack: () => void;
  onShare: (vilm: Vilm) => void;
  onDelete: (vilm: Vilm) => void;
  onRetryTranscription?: (vilmId: string) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({ vilm, onBack, onShare, onDelete, onRetryTranscription }) => {
  const { impact, selection } = useHaptics();
  const { toast } = useToast();
  const { phase } = useTranscriptionEngine();
  const [currentVilm, setCurrentVilm] = useState(vilm);
  const isSettingUp = phase === 'downloading' && currentVilm.transcriptionStatus === 'processing';
  
  // Poll for updates while transcription is processing - defer start by 500ms
  useEffect(() => {
    if (currentVilm.transcriptionStatus !== 'processing') return;
    
    // Defer polling start to avoid blocking initial render
    const timeout = setTimeout(() => {
      const interval = setInterval(async () => {
        const fresh = await dexieVilmStorage.getVilmById(vilm.id);
        if (fresh) {
          setCurrentVilm(fresh);
        }
      }, 2000); // Poll every 2 seconds
      
      return () => clearInterval(interval);
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [currentVilm.transcriptionStatus, vilm.id]);
  
  // Safety check: if vilm is missing audioFilename, show error
  useEffect(() => {
    if (!currentVilm.audioFilename) {
      console.error('DetailView received vilm without audioFilename:', currentVilm.id);
      toast({
        title: "Audio Error",
        description: "Audio file is missing for this recording",
        variant: "destructive"
      });
    }
  }, [currentVilm, toast]);

  const handleBack = async () => {
    await impact(ImpactStyle.Light);
    onBack();
  };

  const handleShare = async () => {
    await selection();
    onShare(currentVilm);
  };

  const handleDelete = async () => {
    await impact(ImpactStyle.Medium);
    onDelete(currentVilm);
  };

  const handleShareTranscript = async () => {
    try {
      await impact(ImpactStyle.Light);
      
      if (!currentVilm.transcript || currentVilm.transcript.trim() === '') {
        toast({
          title: "No Transcript",
          description: "No transcript available to share",
          variant: "destructive"
        });
        return;
      }
      
      await sharingService.shareTranscript(currentVilm);
      
      toast({
        title: "✓ Shared",
        description: "Transcript shared successfully",
        duration: 2000
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't show error for user cancellation
      if (errorMsg.toLowerCase().includes('cancel')) {
        console.log('[DetailView] Share was canceled by user');
        return;
      }
      
      console.error('[DetailView] Share failed:', error);
      toast({
        title: "Share Failed",
        description: "Unable to share transcript",
        variant: "destructive"
      });
    }
  };

  const handleCopyTranscript = async () => {
    try {
      await impact(ImpactStyle.Light);
      if (currentVilm.transcript && currentVilm.transcript.trim() !== '') {
        await Clipboard.write({
          string: currentVilm.transcript
        });
        toast({
          title: "✓ Copied",
          description: "Transcript copied to clipboard",
          duration: 2000
        });
      } else {
        toast({
          title: "No Transcript",
          description: "No transcript available to copy",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[DetailView] Copy failed:', error);
      toast({
        title: "Copy Failed",
        description: "Unable to copy transcript",
        variant: "destructive"
      });
    }
  };

  const handleRetryTranscription = async () => {
    try {
      await impact(ImpactStyle.Medium);
      if (onRetryTranscription) {
        onRetryTranscription(currentVilm.id);
        toast({
          title: "Retrying",
          description: "Starting transcription again..."
        });
      }
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Unable to retry transcription",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center px-4 pb-4 pt-safe-top bg-background border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mr-3"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold text-foreground truncate">
          {currentVilm.title}
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Audio Player */}
          <div>
            <AudioPlayer 
              audioFilename={currentVilm.audioFilename}
              duration={currentVilm.duration}
              className="w-full"
            />
          </div>

          {/* Transcript Section */}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Transcript
                  </h3>
                   <TranscriptionStatus 
                    transcript={currentVilm.transcript}
                    transcriptionStatus={currentVilm.transcriptionStatus}
                    transcriptionError={currentVilm.transcriptionError}
                    vilmId={currentVilm.id}
                    onCancel={async () => {
                      await impact(ImpactStyle.Medium);
                      // Update local state immediately
                      setCurrentVilm(prev => ({
                        ...prev,
                        transcriptionStatus: 'failed',
                        transcriptionError: 'Cancelled by user'
                      }));
                      // Update storage
                      await dexieVilmStorage.updateVilm(currentVilm.id, {
                        transcriptionStatus: 'failed',
                        transcriptionError: 'Cancelled by user'
                      });
                      toast({
                        title: "Cancelled",
                        description: "Transcription cancelled. You can retry anytime.",
                        duration: 3000
                      });
                    }}
                  />
                </div>
                {currentVilm.transcript && currentVilm.transcript.trim() !== '' && currentVilm.transcriptionStatus !== 'processing' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyTranscript}
                    className="h-9 px-3 gap-2 hover:bg-muted/50 transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Copy transcript to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="text-xs font-medium">Copy</span>
                  </Button>
                )}
              </div>
              
              {currentVilm.transcriptionStatus === 'processing' ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-foreground font-medium text-sm mb-1">
                    {isSettingUp ? 'Setting up transcription service' : 'Transcribing'}
                  </p>
                  {isSettingUp && (
                    <p className="text-muted-foreground text-xs">
                      This only happens once
                    </p>
                  )}
                </div>
              ) : currentVilm.transcriptionError ? (
                <div className="p-6 rounded-lg border text-center" style={{ 
                  backgroundColor: 'hsl(var(--warning) / 0.1)', 
                  borderColor: 'hsl(var(--warning) / 0.2)' 
                }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ 
                    backgroundColor: 'hsl(var(--warning) / 0.2)' 
                  }}>
                    <FileText className="w-6 h-6" style={{ color: 'hsl(var(--warning))' }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: 'hsl(var(--warning))' }}>
                    Transcription Failed
                  </p>
                  <p className="text-sm mb-4" style={{ color: 'hsl(var(--warning) / 0.7)' }}>
                    {currentVilm.transcriptionError}
                  </p>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleRetryTranscription}
                    style={{ 
                      borderColor: 'hsl(var(--warning) / 0.3)', 
                      color: 'hsl(var(--warning))' 
                    }}
                    className="hover:bg-[hsl(var(--warning)/0.1)]"
                  >
                    Try Again
                  </Button>
                </div>
              ) : currentVilm.transcript && currentVilm.transcript.trim() !== '' ? (
                <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {currentVilm.transcript}
                  </p>
                </div>
              ) : (
                <div className="p-6 bg-muted/20 rounded-lg text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium mb-1">
                    No Transcript Available
                  </p>
                  <p className="text-muted-foreground/70 text-sm">
                    The transcription service may not be available
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="border-t bg-background/95">
        <div className="px-4 py-3">
          {/* Share Menu */}
          <ShareMenu vilm={currentVilm} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
};