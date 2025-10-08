import React from 'react';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';

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
  const { isDownloading } = useTranscriptionEngine();

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