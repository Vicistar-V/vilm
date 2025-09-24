import React from 'react';
import { cn } from '@/lib/utils';
import { Mic2 } from 'lucide-react';

interface EmptyStateProps {
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ className }) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center px-8 py-16",
      "min-h-[50vh]",
      className
    )}>
      {/* Icon */}
      <div className={cn(
        "w-20 h-20 rounded-full bg-vilm-hover mb-6",
        "flex items-center justify-center"
      )}>
        <Mic2 
          size={36} 
          className="text-vilm-primary" 
          strokeWidth={1.5}
        />
      </div>
      
      {/* Primary Message */}
      <h2 className={cn(
        "text-2xl font-semibold text-vilm-text-primary mb-3",
        "font-inter"
      )}>
        Your mind is clear.
      </h2>
      
      {/* Call to Action */}
      <p className={cn(
        "text-vilm-text-secondary text-base leading-relaxed max-w-sm",
        "font-inter"
      )}>
        Tap the microphone to capture your first thought.
      </p>
    </div>
  );
};