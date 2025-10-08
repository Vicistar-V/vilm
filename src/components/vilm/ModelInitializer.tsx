import React, { useEffect, useState } from 'react';
import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { browserTranscriptionService, TranscriptionPhase } from '@/services/browserTranscriptionService';
import { cn } from '@/lib/utils';

interface ModelInitializerProps {
  onComplete?: () => void;
}

export const ModelInitializer: React.FC<ModelInitializerProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<TranscriptionPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let progressInterval: NodeJS.Timeout;

    const initializeModel = async () => {
      try {
        // Check if already cached
        const cacheStatus = await browserTranscriptionService.getCacheStatus();
        
        if (cacheStatus.isCached && mounted) {
          console.log('Model already cached, skipping download');
          setPhase('ready');
          setProgress(100);
          
          // Still initialize to load from cache
          await browserTranscriptionService.initialize();
          
          if (mounted && onComplete) {
            onComplete();
          }
          return;
        }

        // Subscribe to phase changes
        const handlePhaseChange = (newPhase: TranscriptionPhase) => {
          if (mounted) {
            setPhase(newPhase);
            
            if (newPhase === 'ready') {
              setProgress(100);
              localStorage.setItem('whisper_model_downloaded', 'true');
              
              if (onComplete) {
                onComplete();
              }
            } else if (newPhase === 'error') {
              setError('Failed to download model. Please check your connection.');
            }
          }
        };

        browserTranscriptionService.subscribe(handlePhaseChange);

        // Simulate progress while downloading
        if (mounted) {
          setPhase('downloading');
          let currentProgress = 0;
          
          progressInterval = setInterval(() => {
            if (currentProgress < 90) {
              currentProgress += Math.random() * 10;
              if (mounted) {
                setProgress(Math.min(currentProgress, 90));
              }
            }
          }, 500);
        }

        // Start initialization
        await browserTranscriptionService.initialize();

        // Cleanup
        clearInterval(progressInterval);
        browserTranscriptionService.unsubscribe(handlePhaseChange);

      } catch (err) {
        console.error('Model initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setPhase('error');
        }
      }
    };

    initializeModel();

    return () => {
      mounted = false;
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [onComplete]);

  // Don't render anything if already ready
  if (phase === 'ready' && progress === 100) {
    return null;
  }

  // Don't show if idle
  if (phase === 'idle') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {phase === 'downloading' && (
            <div className="relative">
              <Download className="w-16 h-16 text-primary animate-bounce" />
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            </div>
          )}
          {phase === 'ready' && (
            <CheckCircle2 className="w-16 h-16 text-primary" />
          )}
          {phase === 'error' && (
            <AlertCircle className="w-16 h-16 text-destructive" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-foreground mb-2">
          {phase === 'downloading' && 'Downloading AI Model'}
          {phase === 'ready' && 'Ready to Go!'}
          {phase === 'error' && 'Download Failed'}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6">
          {phase === 'downloading' && 'Setting up speech recognition... This only happens once.'}
          {phase === 'ready' && 'Your recordings will now be automatically transcribed'}
          {phase === 'error' && error}
        </p>

        {/* Progress Bar */}
        {phase === 'downloading' && (
          <div className="space-y-2">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-300 ease-out",
                  progress < 100 && "animate-pulse"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Error retry button */}
        {phase === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
