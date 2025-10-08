import React, { useEffect, useState } from 'react';
import { Database, Loader2, Download, Trash2, CheckCircle2 } from 'lucide-react';
import { browserTranscriptionService } from '@/services/browserTranscriptionService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';

export const ModelStatusCard: React.FC = () => {
  const [cacheStatus, setCacheStatus] = useState<{ isCached: boolean; estimatedSize?: number }>({
    isCached: false
  });
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const { impact } = useHaptics();

  useEffect(() => {
    loadCacheStatus();
  }, []);

  const loadCacheStatus = async () => {
    try {
      const status = await browserTranscriptionService.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('Failed to load cache status:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      await impact();
      setIsClearing(true);
      
      await browserTranscriptionService.clearCache();
      
      // Clear the localStorage flag
      localStorage.removeItem('whisper_model_downloaded');
      
      await loadCacheStatus();
      
      toast({
        title: 'Cache Cleared',
        description: 'AI model cache has been cleared. It will be re-downloaded on next use.',
      });
      
      // Reload the page to trigger re-download
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
            {cacheStatus.isCached ? (
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

      {/* Clear Cache Button */}
      {cacheStatus.isCached && (
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

      {/* Info Text */}
      <p className="text-xs text-vilm-text-tertiary mt-3">
        The AI model is downloaded once and cached locally. Clear the cache to free up storage or fix issues.
      </p>
    </div>
  );
};
