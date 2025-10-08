import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Play, Pause, Clock } from "lucide-react";
import { Vilm } from "@/types/vilm";
import { TranscriptionStatus } from "@/components/vilm/TranscriptionStatus";
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';
import { useHaptics } from '@/hooks/useHaptics';
import { nativeAudioService } from '@/services/nativeAudioService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { TrashIcon } from './TrashIcon';

interface VilmCardProps {
  vilm: Vilm;
  onClick: () => void;
  onDelete?: (vilmId: string) => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatReadableDate = (date: Date): string => {
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  } else {
    return format(date, 'MMM d, yyyy');
  }
};

export const VilmCard: React.FC<VilmCardProps> = ({ vilm, onClick, onDelete }) => {
  const { phase } = useTranscriptionEngine();
  const { impact } = useHaptics();
  const isSettingUp = phase === 'downloading' && vilm.transcriptionStatus === 'processing';
  const hasTranscript = vilm.transcript && vilm.transcript.trim() !== '';
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [audioDuration, setAudioDuration] = useState(vilm.duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasPlayingBeforeDragRef = useRef(false);

  // Load audio
  useEffect(() => {
    const loadAudio = async () => {
      if (!vilm.audioFilename) return;
      
      try {
        const url = await nativeAudioService.getAudioFile(vilm.audioFilename);
        setAudioUrl(url);
        
        const audio = new Audio(url);
        audioRef.current = audio;
        
        const setDur = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setAudioDuration(audio.duration);
          }
        };
        
        const handleTimeUpdate = () => {
          if (!isDragging) {
            setCurrentTime(audio.currentTime);
          }
        };
        
        const handleEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };
        
        const handlePlaying = () => {
          setIsPlaying(true);
          console.log('Audio actually playing - timer started');
        };
        
        audio.addEventListener('loadedmetadata', setDur);
        audio.addEventListener('durationchange', setDur);
        audio.addEventListener('canplay', setDur);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('ended', handleEnded);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [vilm.audioFilename]);

  // Animation loop for smooth progress updates
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      const updateProgress = () => {
        if (audioRef.current && !isDragging) {
          setCurrentTime(audioRef.current.currentTime);
        }
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateProgress);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }
  }, [isPlaying, isDragging]);

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    
    await impact();
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Don't set isPlaying here - wait for 'playing' event
        await audioRef.current.play();
        console.log('Play requested - waiting for playing event');
      }
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const seekToPosition = (clientX: number) => {
    if (!progressRef.current || !audioRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));

    const rawDuration = Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0
      ? audioRef.current.duration
      : (Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : null);
    if (!rawDuration) return;

    const newTime = percentage * rawDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isDragging) return;
    seekToPosition(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioRef.current) return;

    wasPlayingBeforeDragRef.current = isPlaying;
    setIsDragging(true);
    audioRef.current.pause();
    setIsPlaying(false);
    seekToPosition(e.clientX);

    const onMove = (ev: MouseEvent) => {
      seekToPosition(ev.clientX);
    };
    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setIsDragging(false);
      if (audioRef.current && wasPlayingBeforeDragRef.current) {
        try {
          // Don't set isPlaying here - wait for 'playing' event
          await audioRef.current.play();
        } catch (err) {
          console.error('Failed to resume after drag:', err);
        }
      }
      wasPlayingBeforeDragRef.current = false;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioRef.current) return;
    wasPlayingBeforeDragRef.current = isPlaying;
    setIsDragging(true);
    audioRef.current.pause();
    setIsPlaying(false);
    seekToPosition(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isDragging) return;
    seekToPosition(e.touches[0].clientX);
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(false);
    if (audioRef.current && wasPlayingBeforeDragRef.current) {
      try {
        // Don't set isPlaying here - wait for 'playing' event
        await audioRef.current.play();
      } catch (err) {
        console.error('Failed to resume after drag:', err);
      }
    }
    wasPlayingBeforeDragRef.current = false;
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      await impact();
      onDelete(vilm.id);
    }
  };

  const effectiveDuration = (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : (Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0);
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;
  
  const formattedCurrentTime = formatDuration(Math.floor(currentTime));
  const formattedTotalTime = formatDuration(Math.floor(effectiveDuration));
  
  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="font-semibold text-foreground truncate mb-1">
              {vilm.title}
            </h3>
            
            {vilm.transcriptionStatus === 'processing' ? (
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                  <span className="text-sm text-muted-foreground italic">
                    {isSettingUp ? 'Setting up transcription (first time only)...' : 'Transcribing...'}
                  </span>
                </div>
              </div>
            ) : vilm.transcriptionError ? (
              <p className="text-sm text-destructive/70 italic mb-1">
                Transcription failed - tap to retry
              </p>
            ) : hasTranscript ? (
              <>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                  {vilm.transcript}
                </p>
                <p className="text-xs text-muted-foreground/60 italic mb-1">
                  Transcribed
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic mb-1">
                No transcript available
              </p>
            )}
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatReadableDate(vilm.createdAt)}</span>
            </div>
          </div>

          {/* Delete Button */}
          {onDelete && (
            <button
              onClick={handleDelete}
              className={cn(
                "p-2 rounded-lg flex-shrink-0",
                "text-muted-foreground",
                "active:bg-destructive/10 active:text-destructive",
                "transition-colors touch-manipulation"
              )}
              aria-label="Delete note"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Inline Audio Player */}
        {vilm.audioFilename && (
          <div 
            className="flex items-center gap-3 pt-2 border-t border-border"
            onClick={(e) => e.stopPropagation()}
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

            {/* Simple Progress Line */}
            <div 
              ref={progressRef}
              className="flex-1 relative h-8 flex items-center cursor-pointer"
              onClick={handleProgressClick}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Background line */}
              <div className="w-full h-1 bg-muted rounded-full">
                {/* Progress fill */}
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Draggable thumb */}
              <div 
                className={cn(
                  "absolute w-3 h-3 bg-primary rounded-full",
                  "border-2 border-background shadow-sm",
                  "transition-transform duration-100",
                  isDragging && "scale-125"
                )}
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>

            {/* Time Display */}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0 tabular-nums">
              {formattedCurrentTime} / {formattedTotalTime}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};
