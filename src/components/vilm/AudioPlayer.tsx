import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';

interface AudioPlayerProps {
  duration: number; // Total duration in seconds
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  duration,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { impact } = useHaptics();

  const progress = (currentTime / duration) * 100;

  useEffect(() => {
    if (isPlaying && !isDragging) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isDragging, duration]);

  const handlePlayPause = async () => {
    await impact();
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    setCurrentTime(Math.max(0, Math.min(newTime, duration)));
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!progressRef.current || !isDragging) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const percentage = touchX / rect.width;
    const newTime = percentage * duration;
    
    setCurrentTime(Math.max(0, Math.min(newTime, duration)));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className={cn("bg-card border border-vilm-border rounded-xl p-4", className)}>
      {/* Controls Row */}
      <div className="flex items-center space-x-4">
        {/* Play/Pause Button */}
        <Button
          onClick={handlePlayPause}
          size="sm"
          className={cn(
            "w-10 h-10 rounded-full p-0",
            "bg-vilm-primary hover:bg-vilm-primary/90",
            "text-white shadow-sm"
          )}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
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
          <span>{formatTime(currentTime)}</span>
          <span className="mx-1 text-vilm-text-tertiary">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};