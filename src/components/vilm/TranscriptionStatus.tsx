import React from 'react';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptionStatusProps {
  transcript?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionError?: string;
  className?: string;
}

export const TranscriptionStatus: React.FC<TranscriptionStatusProps> = ({
  transcript,
  transcriptionStatus,
  transcriptionError,
  className
}) => {
  if (transcriptionStatus === 'failed' || transcriptionError) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive", className)}>
        <AlertCircle className="w-3 h-3" />
        <span>Transcription failed</span>
      </div>
    );
  }

  if (transcriptionStatus === 'processing') {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Transcribing...</span>
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