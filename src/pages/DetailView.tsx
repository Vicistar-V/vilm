import React from 'react';
import { ArrowLeft, Share, Trash2, FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AudioPlayer } from '@/components/vilm/AudioPlayer';
import { ShareMenu } from '@/components/vilm/ShareMenu';
import { Vilm } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';
import { sharingService } from '@/services/sharingService';
import { useToast } from '@/hooks/use-toast';
import { ImpactStyle } from '@capacitor/haptics';
import { Clipboard } from '@capacitor/clipboard';

interface DetailViewProps {
  vilm: Vilm;
  onBack: () => void;
  onShare: (vilm: Vilm) => void;
  onDelete: (vilm: Vilm) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({ vilm, onBack, onShare, onDelete }) => {
  const { impact, selection } = useHaptics();
  const { toast } = useToast();

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
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Transcript
                </h3>
                {vilm.transcript && vilm.transcript.trim() !== '' && (
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
              
              {vilm.transcript && vilm.transcript.trim() !== '' ? (
                <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {vilm.transcript}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-muted/20 rounded-lg text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    Transcription in progress...
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    This may take a few moments
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