import React from 'react';
import { Loader2, FileText, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';
import { Button } from '@/components/ui/button';

interface TranscriptionStatusProps {
  transcript?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionError?: string;
  className?: string;
  vilmId?: string;
  onCancel?: () => void;
}

export const TranscriptionStatus: React.FC<TranscriptionStatusProps> = ({
  transcript,
  transcriptionStatus,
  transcriptionError,
  className,
  vilmId,
  onCancel
}) => {
  const { isDownloading, cancelTranscription } = useTranscriptionEngine();

  const handleCancel = () => {
    cancelTranscription();
    onCancel?.();
  };

  // Show setup status if model is downloading
  if (isDownloading && transcriptionError?.includes('setting up')) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Transcription system still setting up</span>
      </div>
    );
  }

  if (transcriptionStatus === 'failed' || transcriptionError) {
    // Determine appropriate error message
    let errorText = 'Transcription failed';
    
    if (transcriptionError?.includes('download') || transcriptionError?.includes('network') || transcriptionError?.includes('fetch')) {
      errorText = 'Transcription system setup failed. Please check your internet connection';
    } else if (transcriptionError?.includes('not ready')) {
      errorText = 'Initialize in Settings';
    }
      
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)} style={{ color: 'hsl(var(--warning))' }}>
        <AlertCircle className="w-3 h-3" />
        <span>{errorText}</span>
      </div>
    );
  }

  if (transcriptionStatus === 'processing') {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Transcribing...</span>
        {vilmId && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-5 px-2 py-0 text-xs hover:bg-destructive/10 hover:text-destructive"
            title="Cancel transcription"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  if (transcript && transcript.trim() !== '') {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-primary", className)}>
        <FileText className="w-3 h-3" />
        <span>Transcribed</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <FileText className="w-3 h-3 opacity-50" />
      <span>No transcript</span>
    </div>
  );
};