import React, { useState } from 'react';
import { Share2, FileText, Download, Copy, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Vilm } from '@/types/vilm';
import { sharingService } from '@/services/sharingService';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

interface ShareMenuProps {
  vilm: Vilm;
  onClose?: () => void;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ vilm, onClose }) => {
  const { toast } = useToast();
  const { impact } = useHaptics();
  const [isSharing, setIsSharing] = useState(false);

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
      toast({
        title: "Share Failed",
        description: "Unable to share Vilm",
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
      toast({
        title: "Share Failed",
        description: "Unable to share audio",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyTranscript = async () => {
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
      
      await navigator.clipboard.writeText(vilm.transcript);
      
      toast({
        title: "Copied",
        description: "Transcript copied to clipboard"
      });
      
      onClose?.();
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy transcript",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleExportText = async () => {
    if (isSharing) return;
    
    try {
      setIsSharing(true);
      await impact(ImpactStyle.Light);
      
      const fileName = await sharingService.exportAsText(vilm);
      
      toast({
        title: "Exported",
        description: `Saved as ${fileName} in Documents`
      });
      
      onClose?.();
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export as text",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Share2 className="w-4 h-4" />
        Share Options
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleShareAll}
          disabled={isSharing}
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-3"
        >
          <Share2 className="w-4 h-4" />
          <span className="text-xs">Share All</span>
        </Button>
        
        <Button
          onClick={handleShareTranscript}
          disabled={isSharing || !vilm.transcript?.trim()}
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-3"
        >
          <FileText className="w-4 h-4" />
          <span className="text-xs">Transcript</span>
        </Button>
        
        <Button
          onClick={handleShareAudio}
          disabled={isSharing || !vilm.audioFilename}
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-3"
        >
          <Music className="w-4 h-4" />
          <span className="text-xs">Audio</span>
        </Button>
        
        <Button
          onClick={handleCopyTranscript}
          disabled={isSharing || !vilm.transcript?.trim()}
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-3"
        >
          <Copy className="w-4 h-4" />
          <span className="text-xs">Copy</span>
        </Button>
      </div>
      
      <div className="pt-2 border-t">
        <Button
          onClick={handleExportText}
          disabled={isSharing}
          variant="ghost"
          className="w-full flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export as Text File
        </Button>
      </div>
    </Card>
  );
};