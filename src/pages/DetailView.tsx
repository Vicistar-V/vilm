import React from 'react';
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
  const isSettingUp = phase === 'downloading' && vilm.transcriptionStatus === 'processing';

  const handleBack = async () => {
    await impact(ImpactStyle.Light);
    onBack();
  };

  const handleShare = async () => {
    await selection();
    onShare(vilm);
  };

  const handleDelete = async () => {
    await impact(ImpactStyle.Medium);
    onDelete(vilm);
  };

  const handleShareTranscript = async () => {
    try {
      await impact(ImpactStyle.Light);
      await sharingService.shareTranscript(vilm);
    } catch (error) {
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
      if (vilm.transcript) {
        await Clipboard.write({
          string: vilm.transcript
        });
        toast({
          title: "Copied",
          description: "Transcript copied to clipboard"
        });
      }
    } catch (error) {
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
        onRetryTranscription(vilm.id);
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
      <header className="flex items-center p-4 bg-background border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mr-3"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold text-foreground truncate">
          {vilm.title}
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Audio Player */}
          <div>
            <AudioPlayer 
              audioFilename={vilm.audioFilename}
              duration={vilm.duration}
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
                    transcript={vilm.transcript}
                    transcriptionStatus={vilm.transcriptionStatus}
                    transcriptionError={vilm.transcriptionError}
                  />
                </div>
                {vilm.transcript && vilm.transcript.trim() !== '' && vilm.transcriptionStatus !== 'processing' && (
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleCopyTranscript}
                      className="h-8 px-2"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleShareTranscript}
                      className="h-8 px-2"
                    >
                      <Share className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              {vilm.transcriptionStatus === 'processing' ? (
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
              ) : vilm.transcriptionError ? (
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
                    {vilm.transcriptionError}
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
              ) : vilm.transcript && vilm.transcript.trim() !== '' ? (
                <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {vilm.transcript}
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
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3 space-y-2">
          {/* Share Menu */}
          <ShareMenu vilm={vilm} />
          
          {/* Delete Action */}
          <Button
            onClick={handleDelete}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Vilm
          </Button>
        </div>
      </div>
    </div>
  );
};