import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  className,
  disabled = false
}) => {
  const firedRef = useRef(false);

  return (
    <button
      onPointerDown={(e) => {
        if (disabled || firedRef.current) return;
        firedRef.current = true;
        onClick();
        e.preventDefault();
      }}
      onClick={(e) => {
        if (firedRef.current) {
          firedRef.current = false;
          return;
        }
        onClick();
      }}
      disabled={disabled}
      className={cn(
        // Base styles - perfectly circular FAB
        "fixed bottom-6 right-6 w-16 h-16",
        "bg-vilm-primary shadow-lg rounded-full",
        "flex items-center justify-center",
        "z-50 transition-all duration-200",
        
        // Interactive states
        "active:scale-95 active:bg-vilm-pressed",
        "hover:shadow-xl hover:scale-105",
        "focus:outline-none focus:ring-4 focus:ring-vilm-primary/20",
        
        // Disabled state
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "disabled:hover:scale-100 disabled:active:scale-100",
        
        // Ensure it works well with safe areas on mobile
        "mb-safe-bottom mr-safe-right",
        
        className
      )}
      aria-label="Start recording"
    >
      <Mic 
        size={24} 
        className="text-white" 
        strokeWidth={2.5}
      />
    </button>
  );
};