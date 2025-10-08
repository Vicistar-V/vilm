import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Play, Pause, Clock } from "lucide-react";
import { Vilm } from "@/types/vilm";
import { TranscriptionStatus } from "@/components/vilm/TranscriptionStatus";
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';
import { useHaptics } from '@/hooks/useHaptics';
import { nativeAudioService } from '@/services/nativeAudioService';
import { cn } from '@/lib/utils';

interface VilmCardProps {
  vilm: Vilm;
  onClick: () => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VilmCard: React.FC<VilmCardProps> = ({ vilm, onClick }) => {
  const { phase } = useTranscriptionEngine();
  const { impact } = useHaptics();
  const isSettingUp = phase === 'downloading' && vilm.transcriptionStatus === 'processing';
  const hasTranscript = vilm.transcript && vilm.transcript.trim() !== '';
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio
  useEffect(() => {
    const loadAudio = async () => {
      if (!vilm.audioFilename) return;
      
      try {
        const url = await nativeAudioService.getAudioFile(vilm.audioFilename);
        setAudioUrl(url);
        
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
        });
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
      } catch (err) {
        console.error('Failed to load audio:', err);
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [vilm.audioFilename]);

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!audioRef.current) return;
    
    await impact();
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const progress = vilm.duration > 0 ? (currentTime / vilm.duration) * 100 : 0;

  // Generate waveform bars (simplified visualization)
  const waveformBars = Array.from({ length: 40 }, (_, i) => {
    const height = Math.sin(i * 0.5) * 0.5 + 0.5; // Sinusoidal pattern
    return height * 0.8 + 0.2; // Scale between 0.2 and 1
  });
  
  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {vilm.title}
              </h3>
              <TranscriptionStatus 
                transcript={vilm.transcript}
                transcriptionStatus={vilm.transcriptionStatus}
                transcriptionError={vilm.transcriptionError}
                className="flex-shrink-0"
              />
            </div>
            
            {vilm.transcriptionStatus === 'processing' ? (
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-sm text-muted-foreground">
                    {isSettingUp ? 'Setting up transcription (first time only)...' : 'Transcribing...'}
                  </span>
                </div>
              </div>
            ) : vilm.transcriptionError ? (
              <p className="text-sm text-destructive/70 italic mb-1">
                Transcription failed - tap to retry
              </p>
            ) : hasTranscript ? (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                {vilm.transcript}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic mb-1">
                No transcript available
              </p>
            )}
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(vilm.duration)}</span>
              <span>•</span>
              <span>{vilm.createdAt.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Inline Audio Player */}
        {vilm.audioFilename && (
          <div 
            className="flex items-center gap-3 pt-2 border-t border-border"
            onClick={(e) => e.stopPropagation()} // Prevent card click on player area
          >
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "transition-colors active:scale-95"
              )}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>

            {/* Waveform Visualization */}
            <div className="flex-1 flex items-center gap-0.5 h-8 relative">
              {waveformBars.map((height, i) => {
                const isPassed = (i / waveformBars.length) * 100 <= progress;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-full transition-colors duration-150",
                      isPassed ? "bg-primary" : "bg-muted"
                    )}
                    style={{ 
                      height: `${height * 100}%`,
                      minHeight: '20%'
                    }}
                  />
                );
              })}
            </div>

            {/* Time Display */}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0 min-w-[35px] text-right">
              {formatDuration(Math.floor(currentTime))}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};
