import React from 'react';
import { cn } from '@/lib/utils';
import { Vilm } from '@/types/vilm';
import { formatDistanceToNow } from 'date-fns';

interface VilmCardProps {
  vilm: Vilm;
  onClick: () => void;
  className?: string;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VilmCard: React.FC<VilmCardProps> = ({
  vilm,
  onClick,
  className
}) => {
  const previewText = vilm.transcript.length > 120 
    ? vilm.transcript.substring(0, 120) + '...' 
    : vilm.transcript;

  return (
    <div
      onClick={onClick}
      className={cn(
        // Card container with mobile-optimized touch target
        "bg-card border border-vilm-border rounded-xl p-4",
        "min-h-[88px] cursor-pointer transition-all duration-200",
        "shadow-sm hover:shadow-md active:shadow-sm",
        
        // Interactive states with haptic-like visual feedback
        "active:scale-[0.98] active:bg-vilm-hover",
        "hover:border-vilm-primary/20 hover:bg-vilm-hover/50",
        
        // Focus state for accessibility
        "focus:outline-none focus:ring-2 focus:ring-vilm-primary/20 focus:ring-offset-2",
        
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Title */}
      <h3 className={cn(
        "font-semibold text-vilm-text-primary text-base leading-tight mb-2",
        "line-clamp-1"
      )}>
        {vilm.title || `Note from ${vilm.createdAt.toLocaleDateString()}`}
      </h3>
      
      {/* Transcript Preview */}
      <p className={cn(
        "text-vilm-text-secondary text-sm leading-relaxed mb-3",
        "line-clamp-2"
      )}>
        {previewText}
      </p>
      
      {/* Metadata Bar */}
      <div className="flex items-center justify-between text-xs text-vilm-text-tertiary">
        <span>
          {formatDistanceToNow(vilm.createdAt, { addSuffix: true })}
        </span>
        <span className="font-medium">
          {formatDuration(vilm.duration)}
        </span>
      </div>
    </div>
  );
};