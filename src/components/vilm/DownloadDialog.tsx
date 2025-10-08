import React, { useState } from 'react';
import { FileText, Music } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Vilm } from '@/types/vilm';
import { sharingService } from '@/services/sharingService';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';

interface DownloadDialogProps {
  vilm: Vilm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  vilm,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { impact } = useHaptics();
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadText = async () => {
    if (isExporting) return;
    
    try {
      setIsExporting(true);
      await impact(ImpactStyle.Light);
      
      const fileName = await sharingService.exportAsText(vilm);
      
      toast({
        title: "Exported",
        description: `Saved as ${fileName} in Documents/exports`
      });
      
      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to export as text';
      toast({
        title: "Export Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (isExporting) return;
    
    try {
      setIsExporting(true);
      await impact(ImpactStyle.Light);
      
      if (!vilm.audioFilename) {
        toast({
          title: "No Audio",
          description: "Audio file is not available",
          variant: "destructive"
        });
        return;
      }
      
      const fileName = await sharingService.exportAudio(vilm);
      
      toast({
        title: "Exported",
        description: `Saved as ${fileName} in Documents/exports`
      });
      
      onOpenChange(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to export audio file';
      toast({
        title: "Export Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Choose Download Format</AlertDialogTitle>
          <AlertDialogDescription>
            Select what you'd like to download
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-4">
          <button
            onClick={handleDownloadText}
            disabled={isExporting}
            className="w-full p-4 rounded-lg border border-border hover:bg-muted/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Download as Text</div>
                <div className="text-sm text-muted-foreground">
                  Transcript + metadata (.txt)
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleDownloadAudio}
            disabled={isExporting || !vilm.audioFilename}
            className="w-full p-4 rounded-lg border border-border hover:bg-muted/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Download Audio</div>
                <div className="text-sm text-muted-foreground">
                  Original recording (.m4a)
                </div>
              </div>
            </div>
          </button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExporting}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
