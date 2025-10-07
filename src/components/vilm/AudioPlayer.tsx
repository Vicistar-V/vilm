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
  const { impact } = useHaptics();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Load audio file when component mounts
  useEffect(() => {
    const loadAudio = async () => {
      if (!audioFilename) {
        setError('No audio file available');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('[AudioPlayer] Loading audio file:', audioFilename);
        
        const url = await nativeAudioService.getAudioFile(audioFilename);
        
        console.log('[AudioPlayer] Audio file loaded, creating Audio element');
        setAudioUrl(url);
        
        // Create audio element
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.addEventListener('loadedmetadata', () => {
          console.log('[AudioPlayer] Audio metadata loaded');
          setIsLoading(false);
        });
        
        audio.addEventListener('timeupdate', () => {
          if (!isDragging) {
            setCurrentTime(audio.currentTime);
          }
        });
        
        audio.addEventListener('ended', () => {
          console.log('[AudioPlayer] Audio playback ended');
          setIsPlaying(false);
          setCurrentTime(0);
        });
        
        audio.addEventListener('error', (e) => {
          console.error('[AudioPlayer] Audio element error:', e);
          console.error('[AudioPlayer] Audio error details:', {
            error: audio.error,
            src: audio.src,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
          setError('Failed to load audio');
          setIsLoading(false);
        });
        
      } catch (err) {
        console.error('[AudioPlayer] Failed to load audio:', err);
        console.error('[AudioPlayer] Error details:', {
          message: err.message,
          stack: err.stack,
          audioFilename
        });
        setError(`Failed to load audio: ${err.message || 'Unknown error'}`);
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
    };
  }, [audioFilename, isDragging]);

  const handlePlayPause = async () => {
    if (!audioRef.current || isLoading) return;
    
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

  const handleTouchEnd = () => {
    setIsDragging(false);
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