import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { nativeAudioService } from '@/services/nativeAudioService';

interface AudioPlayerProps {
  audioFilename?: string;
  duration: number; // Total duration in seconds
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFilename,
  duration,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const progressRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasPlayingBeforeDragRef = useRef(false);
  const { impact } = useHaptics();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Load audio file when component mounts - with small delay for better perceived performance
  useEffect(() => {
    const loadAudio = async () => {
      if (!audioFilename) {
        setError('No audio file available');
        return;
      }

      // Defer audio loading by 150ms to let UI render first
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        setIsLoading(true);
        setError(null);
        
        const url = await nativeAudioService.getAudioFile(audioFilename);
        setAudioUrl(url);
        
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
        });
        
        const handlePlaying = () => {
          setIsPlaying(true);
          console.log('Audio actually playing - timer started');
        };
        
        audio.addEventListener('playing', handlePlaying);
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
        
        audio.addEventListener('error', (e) => {
          setError('Failed to load audio');
          setIsLoading(false);
        });
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load audio: ${errorMsg}`);
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioFilename, isDragging]);

  // Animation frame loop for smooth progress updates
  useEffect(() => {
    if (isPlaying && audioRef.current && !isDragging) {
      const updateProgress = () => {
        if (audioRef.current && !isDragging) {
          setCurrentTime(audioRef.current.currentTime);
        }
        if (isPlaying && !isDragging) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateProgress);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isPlaying, isDragging]);

  const handlePlayPause = async () => {
    if (!audioRef.current || isLoading) return;
    
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
      setError('Playback failed');
    }
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current || !audioRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(newTime);
  };

  const handleTouchStart = () => {
    if (!audioRef.current) return;
    wasPlayingBeforeDragRef.current = isPlaying;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!progressRef.current || !audioRef.current || !isDragging) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const percentage = touchX / rect.width;
    const newTime = percentage * duration;
    
    const clampedTime = Math.max(0, Math.min(newTime, duration));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const handleTouchEnd = async () => {
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

  const handleMouseDown = () => {
    if (!audioRef.current) return;
    wasPlayingBeforeDragRef.current = isPlaying;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!progressRef.current || !audioRef.current || !isDragging) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percentage = mouseX / rect.width;
    const newTime = percentage * duration;
    
    const clampedTime = Math.max(0, Math.min(newTime, duration));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const handleMouseUp = async () => {
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

  if (error) {
    return (
      <div className={cn("bg-card border border-vilm-border rounded-xl p-4", className)}>
        <div className="flex items-center justify-center space-x-2 text-red-500">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-vilm-border rounded-xl p-4", className)}>
      {/* Controls Row */}
      <div className="flex items-center space-x-4">
        {/* Play/Pause Button */}
        <Button
          onClick={handlePlayPause}
          size="sm"
          disabled={isLoading || !!error || !audioRef.current}
          className={cn(
            "w-10 h-10 rounded-full p-0",
            "bg-vilm-primary hover:bg-vilm-primary/90",
            "text-white shadow-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </Button>

        {/* Progress Bar Container */}
        <div className="flex-1">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-8 flex items-center cursor-pointer"
          >
            {/* Background Track */}
            <div className="w-full h-1 bg-vilm-border rounded-full">
              {/* Progress Fill */}
              <div 
                className="h-full bg-vilm-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Scrub Handle */}
            <div 
              className={cn(
                "absolute w-4 h-4 bg-vilm-primary rounded-full",
                "shadow-sm border-2 border-white",
                "transition-transform duration-100",
                isDragging ? "scale-125" : "scale-100"
              )}
              style={{ left: `calc(${progress}% - 8px)` }}
            />
          </div>
        </div>

        {/* Time Display */}
        <div className="text-sm text-vilm-text-secondary font-mono min-w-[80px] text-right">
          <span>{formatTime(Math.floor(currentTime))}</span>
          <span className="mx-1 text-vilm-text-tertiary">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};