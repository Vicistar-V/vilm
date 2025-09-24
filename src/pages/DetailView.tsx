import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, Share, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from '@/components/vilm/AudioPlayer';
import { Vilm } from '@/types/vilm';
import { useHaptics } from '@/hooks/useHaptics';

interface DetailViewProps {
  vilm: Vilm;
  onBack: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  vilm,
  onBack,
  onShare,
  onDelete
}) => {
  const { impact, selection } = useHaptics();

  const handleBack = async () => {
    await impact();
    onBack();
  };

  const handleShare = async () => {
    await selection();
    onShare();
  };

  const handleDelete = async () => {
    await impact();
    onDelete();
  };

  return (
    <div className={cn(
      "min-h-screen-safe bg-background",
      "flex flex-col"
    )}>
      {/* Header */}
      <header className={cn(
        "flex items-center p-6 pt-safe-top",
        "bg-background border-b border-vilm-border/50",
        "sticky top-0 z-10"
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="p-2 mr-3 hover:bg-vilm-hover rounded-full"
        >
          <ArrowLeft size={20} className="text-vilm-text-primary" />
        </Button>
        
        <h1 className={cn(
          "flex-1 text-lg font-semibold text-vilm-text-primary",
          "truncate"
        )}>
          {vilm.title || `Note from ${vilm.createdAt.toLocaleDateString()}`}
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 pb-24 overflow-y-auto">
        {/* Audio Player */}
        <div className="mb-8">
          <AudioPlayer duration={vilm.duration} />
        </div>

        {/* Transcript Section */}
        <div>
          <h2 className={cn(
            "text-lg font-semibold text-vilm-text-primary mb-4",
            "border-b border-vilm-border pb-2"
          )}>
            Transcript
          </h2>
          
          <div 
            className={cn(
              "text-vilm-text-primary text-base leading-relaxed",
              "whitespace-pre-wrap break-words",
              "selection:bg-vilm-primary/20 selection:text-vilm-text-primary"
            )}
            style={{
              lineHeight: '1.6',
              fontSize: '16px' // Ensure readability on mobile
            }}
          >
            {vilm.transcript}
          </div>
        </div>
      </main>

      {/* Bottom Action Toolbar */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0",
        "bg-card border-t border-vilm-border",
        "p-6 pb-safe-bottom",
        "flex justify-center space-x-8"
      )}>
        <Button
          variant="ghost"
          onClick={handleShare}
          className={cn(
            "flex flex-col items-center space-y-1 p-4",
            "hover:bg-vilm-hover rounded-xl min-w-[80px]"
          )}
        >
          <Share size={20} className="text-vilm-primary" />
          <span className="text-xs text-vilm-text-secondary font-medium">
            Share
          </span>
        </Button>

        <Button
          variant="ghost"
          onClick={handleDelete}
          className={cn(
            "flex flex-col items-center space-y-1 p-4",
            "hover:bg-red-50 rounded-xl min-w-[80px]"
          )}
        >
          <Trash2 size={20} className="text-red-500" />
          <span className="text-xs text-red-500 font-medium">
            Delete
          </span>
        </Button>
      </div>
    </div>
  );
};