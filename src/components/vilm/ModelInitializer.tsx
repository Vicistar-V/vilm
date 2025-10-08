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
    <div className="fixed top-0 left-0 right-0 z-50 pt-safe-top">
      <div className="bg-card border-b border-border shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            {phase === 'downloading' && (
              <Download className="w-4 h-4 text-primary flex-shrink-0 animate-bounce" />
            )}
            {phase === 'ready' && (
              <CheckCircle2 className="w-4 h-4 text-vilm-success flex-shrink-0" />
            )}
            {phase === 'error' && (
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {phase === 'downloading' && 'Downloading AI model...'}
                {phase === 'ready' && 'AI model ready'}
                {phase === 'error' && 'Download failed'}
              </p>
              
              {/* Progress Bar */}
              {phase === 'downloading' && (
                <div className="mt-1.5 w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Error retry button */}
            {phase === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 flex-shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
