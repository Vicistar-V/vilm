import React, { useEffect, useState } from 'react';
import { Database, Loader2, Download, Trash2, CheckCircle2 } from 'lucide-react';
import { browserTranscriptionService } from '@/services/browserTranscriptionService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { useTranscriptionEngine } from '@/hooks/useTranscriptionEngine';

export const ModelStatusCard: React.FC = () => {
  const [cacheStatus, setCacheStatus] = useState<{ isCached: boolean; estimatedSize?: number }>({
    isCached: false
  });
  const [isClearing, setIsClearing] = useState(false);
  const [isDownloadingManually, setIsDownloadingManually] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { toast } = useToast();
  const { impact } = useHaptics();
  const { isDownloading, isReady, phase } = useTranscriptionEngine();

  useEffect(() => {
    const init = async () => {
      await loadCacheStatus();
      
      // Try to warm from cache immediately
      if (localStorage.getItem('whisper_model_downloaded') === 'true') {
        await browserTranscriptionService.warmFromCache();
      }
    };
    
    init();
    
    // Subscribe to download progress
    const progressListener = (progress: number) => {
      setDownloadProgress(progress);
    };
    
    browserTranscriptionService.subscribeProgress(progressListener);
    
    return () => {
      browserTranscriptionService.unsubscribeProgress(progressListener);
    };
  }, []);

  // Refresh cache status when model becomes ready
  useEffect(() => {
    if (phase === 'ready') {
      loadCacheStatus();
    }
  }, [phase]);

  const loadCacheStatus = async () => {
    try {
      const status = await browserTranscriptionService.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to load cache status:', error);
    }
  };

  const handleDownloadModel = async () => {
    try {
      await impact();
      setIsDownloadingManually(true);
      
      await browserTranscriptionService.initialize();
      
      await loadCacheStatus();
      
      toast({
        title: 'Model Downloaded',
        description: 'AI model is ready for transcription.',
      });
    } catch (error) {
      console.error('Failed to download model:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download AI model',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingManually(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await impact();
      setIsClearing(true);
      
      await browserTranscriptionService.clearCache();
      
      await loadCacheStatus();
      
      toast({
        title: 'Cache Cleared',
        description: 'AI model cache has been cleared. It will be re-downloaded on next use.',
      });
      
      // Reload the page to reset state
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear model cache',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={cn(
      "bg-vilm-surface rounded-lg p-6",
      "border border-vilm-border/50",
      "shadow-sm"
    )}>
      {/* Header */}
      <div className="flex items-center space-x-4 mb-4">
        <div className={cn(
          "w-12 h-12 rounded-lg",
          "bg-vilm-primary/10 flex items-center justify-center"
        )}>
          <Database className="w-6 h-6 text-vilm-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-vilm-text-primary">
            AI Model Status
          </h2>
          <p className="text-sm text-vilm-text-secondary">
            Speech-to-text transcription
          </p>
        </div>
      </div>

      {/* Status Info */}
      <div className="space-y-3 mb-4">
        {/* Cache Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-vilm-text-secondary">Model Status</span>
          <div className="flex items-center gap-2">
            {isDownloading || isDownloadingManually ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-vilm-primary" />
                <span className="text-sm font-medium text-vilm-primary">Downloading... {downloadProgress}%</span>
              </>
            ) : isReady || cacheStatus.isCached ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-vilm-success" />
                <span className="text-sm font-medium text-vilm-success">Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-vilm-text-secondary" />
                <span className="text-sm font-medium text-vilm-text-secondary">Not Downloaded</span>
              </>
            )}
          </div>
        </div>

        {/* Download Progress Bar */}
        {(isDownloading || isDownloadingManually) && (
          <div className="w-full">
            <div className="h-2 bg-vilm-surface-dark rounded-full overflow-hidden">
              <div 
                className="h-full bg-vilm-primary transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Storage Size */}
        {cacheStatus.estimatedSize !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-vilm-text-secondary">Storage Used</span>
            <span className="text-sm font-medium text-vilm-text-primary">
              {formatBytes(cacheStatus.estimatedSize)}
            </span>
          </div>
        )}

        {/* Model Name */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-vilm-text-secondary">Model</span>
          <span className="text-sm font-medium text-vilm-text-primary font-mono">
            whisper-tiny.en
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Download Button - shown when model is not ready/downloading/cached */}
        {!isReady && !isDownloading && !isDownloadingManually && !cacheStatus.isCached && (
          <button
            onClick={handleDownloadModel}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "px-4 py-2 rounded-lg",
              "bg-vilm-primary text-white",
              "hover:bg-vilm-primary/90",
              "transition-all duration-200"
            )}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Download AI Model</span>
          </button>
        )}

        {/* Clear Cache Button */}
        {(isReady || cacheStatus.isCached) && (
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "px-4 py-2 rounded-lg",
              "bg-vilm-surface border border-vilm-border/50",
              "text-vilm-text-secondary hover:text-vilm-error",
              "hover:border-vilm-error/50 hover:bg-vilm-error/5",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isClearing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Clearing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Clear Model Cache</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Info Text */}
      <p className="text-xs text-vilm-text-tertiary mt-3">
        The AI model is downloaded once and cached locally. Clear the cache to free up storage or fix issues.
      </p>
    </div>
  );
};
