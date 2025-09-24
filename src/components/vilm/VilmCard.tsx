import { Card } from "@/components/ui/card";
import { Play, Clock, FileText } from "lucide-react";
import { Vilm } from "@/types/vilm";
import { TranscriptionStatus } from "@/components/vilm/TranscriptionStatus";

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
  const hasTranscript = vilm.transcript && vilm.transcript.trim() !== '';
  
  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors active:scale-95 transform duration-150"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">
              {vilm.title}
            </h3>
            <TranscriptionStatus 
              transcript={vilm.transcript}
              className="flex-shrink-0"
            />
          </div>
          
          {hasTranscript ? (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {vilm.transcript}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic mb-2">
              Transcription in progress...
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(vilm.duration)}</span>
            <span>•</span>
            <span>{vilm.createdAt.toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Play className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>
    </Card>
  );
};