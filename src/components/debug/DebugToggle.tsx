import React from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebugToggleProps {
  isDebugOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const DebugToggle: React.FC<DebugToggleProps> = ({ 
  isDebugOpen, 
  onToggle,
  className 
}) => {
  return (
    <Button
      onClick={onToggle}
      size="sm"
      variant={isDebugOpen ? "default" : "outline"}
      className={cn(
        "fixed bottom-4 right-4 z-40 rounded-full w-12 h-12 p-0 shadow-lg",
        isDebugOpen && "bg-red-500 hover:bg-red-600",
        className
      )}
    >
      <Bug size={20} />
    </Button>
  );
};
