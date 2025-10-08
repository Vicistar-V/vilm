import React, { useState } from 'react';
import { Share2, FileText, Download, Music, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Vilm } from '@/types/vilm';
import { sharingService } from '@/services/sharingService';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';
import { DownloadDialog } from './DownloadDialog';

interface ShareMenuProps {
  vilm: Vilm;
  onClose?: () => void;
  onDelete?: (vilm: Vilm) => void;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ vilm, onClose, onDelete }) => {
  const { toast } = useToast();
  const { impact } = useHaptics();
  const [isSharing, setIsSharing] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  const handleShareAll = async () => {
    if (isSharing) return;
    
    try {
      setIsSharing(true);
      await impact(ImpactStyle.Light);
      
      await sharingService.shareVilm(vilm, {
        includeAudio: true,
        includeTranscript: true,
        format: 'text'
      });
      
      toast({
        title: "Shared",
        description: "Vilm shared successfully"
      });
      
      onClose?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to share Vilm';
      
      // Don't show error for user cancellation
      if (errorMsg.toLowerCase().includes('cancel')) {
        console.log('[ShareMenu] Share was canceled by user');
        return;
      }
      
      // Categorize errors and provide specific feedback
      let errorCategory = 'Share Failed';
      let userFriendlyMsg = errorMsg;
      
      if (errorMsg.toLowerCase().includes('not found')) {
        errorCategory = 'Audio File Missing';
        userFriendlyMsg = 'The audio file could not be found in storage';
      } else if (errorMsg.toLowerCase().includes('permission')) {
        errorCategory = 'Permission Denied';
        userFriendlyMsg = 'Storage or sharing permission was denied';
      } else if (errorMsg.toLowerCase().includes('format') || errorMsg.toLowerCase().includes('mime')) {
        errorCategory = 'Format Issue';
        userFriendlyMsg = 'Some apps may not support this audio format. Try sharing transcript only.';
      } else if (errorMsg.toLowerCase().includes('audio')) {
        errorCategory = 'Audio Error';
        userFriendlyMsg = 'Unable to prepare audio for sharing';
      }
      
      console.error('[ShareMenu] Share All failed:', errorCategory, errorMsg);
      
      toast({
        title: errorCategory,
        description: userFriendlyMsg,
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareTranscript = async () => {
    if (isSharing) return;
    
    try {
      setIsSharing(true);
      await impact(ImpactStyle.Light);
      
      if (!vilm.transcript || vilm.transcript.trim() === '') {
        toast({
          title: "No Transcript",
          description: "Transcript is not available yet",
          variant: "destructive"
        });
        return;
      }
      
      await sharingService.shareTranscript(vilm);
      
      toast({
        title: "Shared",
        description: "Transcript shared successfully"
      });
      
      onClose?.();
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Unable to share transcript",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareAudio = async () => {
    if (isSharing) return;
    
    try {
      setIsSharing(true);
      await impact(ImpactStyle.Light);
      
      if (!vilm.audioFilename) {
        toast({
          title: "No Audio",
          description: "Audio file is not available",
          variant: "destructive"
        });
        return;
      }
      
      await sharingService.shareAudio(vilm);
      
      toast({
        title: "Shared",
        description: "Audio shared successfully"
      });
      
      onClose?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to share audio';
      
      // Don't show error for user cancellation
      if (errorMsg.toLowerCase().includes('cancel')) {
        console.log('[ShareMenu] Share was canceled by user');
        return;
      }
      
      // Categorize audio-specific errors
      let errorCategory = 'Share Failed';
      let userFriendlyMsg = errorMsg;
      
      if (errorMsg.toLowerCase().includes('not found')) {
        errorCategory = 'File Missing';
        userFriendlyMsg = 'The audio file could not be found';
      } else if (errorMsg.toLowerCase().includes('empty') || errorMsg.toLowerCase().includes('corrupted')) {
        errorCategory = 'Corrupted File';
        userFriendlyMsg = 'The audio file appears to be corrupted';
      } else if (errorMsg.toLowerCase().includes('format')) {
        errorCategory = 'Format Issue';
        userFriendlyMsg = 'Some apps may not support this audio format. The audio will be saved in M4A format going forward.';
      }
      
      console.error('[ShareMenu] Share Audio failed:', errorCategory, errorMsg);
      
      toast({
        title: errorCategory,
        description: userFriendlyMsg,
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadClick = async () => {
    await impact(ImpactStyle.Light);
    setShowDownloadDialog(true);
  };

  return (
    <Card className="border-0 bg-muted/30">
      <div className="p-6 space-y-6">
        {/* Primary Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleShareAll}
            disabled={isSharing}
            className="w-full h-12 justify-start gap-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all duration-200 hover:scale-[1.02]"
            variant="ghost"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="font-medium">Share Everything</span>
          </Button>
          
          <Button
            onClick={handleShareTranscript}
            disabled={isSharing || !vilm.transcript?.trim()}
            className="w-full h-12 justify-start gap-3 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02]"
            variant="ghost"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-medium">Share Transcript</span>
          </Button>
          
          <Button
            onClick={handleShareAudio}
            disabled={isSharing || !vilm.audioFilename}
            className="w-full h-12 justify-start gap-3 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02]"
            variant="ghost"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Music className="w-4 h-4" />
            </div>
            <span className="font-medium">Share Audio</span>
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 text-muted-foreground">Quick Actions</span>
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadClick}
            disabled={isSharing}
            className="flex-1 h-11 gap-2 hover:bg-muted/50 transition-all duration-200"
            variant="ghost"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Download</span>
          </Button>
          
          <Button
            onClick={async () => {
              await impact(ImpactStyle.Medium);
              onDelete?.(vilm);
            }}
            disabled={isSharing}
            className="flex-1 h-11 gap-2 hover:bg-destructive/10 text-destructive hover:text-destructive transition-all duration-200"
            variant="ghost"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">Delete</span>
          </Button>
        </div>
      </div>

      <DownloadDialog
        vilm={vilm}
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
      />
    </Card>
  );
};