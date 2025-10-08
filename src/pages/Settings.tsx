import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, Smartphone, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FeedbackModal } from '@/components/vilm/FeedbackModal';
import { ModelStatusCard } from '@/components/vilm/ModelStatusCard';
import { useHaptics } from '@/hooks/useHaptics';
import { audioMigrationService, MigrationProgress } from '@/services/audioMigrationService';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ needsMigration: boolean; count: number }>({
    needsMigration: false,
    count: 0
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const { selection, impact } = useHaptics();
  const { toast } = useToast();

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      const status = await audioMigrationService.needsMigration();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Failed to check migration status:', error);
    }
  };

  const handleBack = async () => {
    await selection();
    onBack();
  };

  const handleOpenFeedback = async () => {
    await impact();
    setIsFeedbackModalOpen(true);
  };

  const handleCloseFeedback = () => {
    setIsFeedbackModalOpen(false);
  };

  const handleMigrateAudio = async () => {
    try {
      await impact();
      setIsMigrating(true);
      
      const result = await audioMigrationService.migrateAll((progress) => {
        setMigrationProgress(progress);
      });

      if (result.success) {
        toast({
          title: 'Migration Complete',
          description: `Successfully converted ${migrationProgress?.completed || 0} audio files to M4A format.`,
        });
      } else {
        toast({
          title: 'Migration Completed with Errors',
          description: `${result.errors.length} file(s) failed to convert. Check console for details.`,
          variant: 'destructive',
        });
      }

      // Refresh migration status
      await checkMigrationStatus();
      setMigrationProgress(null);
    } catch (error) {
      console.error('Migration failed:', error);
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const settingsItems = [
    {
      id: 'feedback',
      title: 'Send Feedback',
      subtitle: 'Share your ideas and suggestions',
      icon: MessageSquare,
      action: handleOpenFeedback,
    },
  ];

  return (
    <div className={cn(
      "min-h-screen-safe bg-background",
      "flex flex-col"
    )}>
      {/* Header */}
      <header className={cn(
        "flex items-center p-6",
        "pt-safe-top bg-background",
        "border-b border-vilm-border/50"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="mr-3 text-vilm-text-primary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <h1 className="text-2xl font-semibold text-vilm-text-primary">
          Settings
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 space-y-6">
        {/* App Info */}
        <div className={cn(
          "bg-vilm-surface rounded-lg p-6",
          "border border-vilm-border/50",
          "shadow-sm"
        )}>
          <div className="flex items-center space-x-4">
            <div className={cn(
              "w-12 h-12 rounded-lg",
              "bg-vilm-primary/10 flex items-center justify-center"
            )}>
              <Smartphone className="w-6 h-6 text-vilm-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-vilm-text-primary">
                Vilm
              </h2>
              <p className="text-sm text-vilm-text-secondary">
                Version 1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* Model Status Card */}
        <ModelStatusCard />

        {/* Audio Migration Card */}
        {migrationStatus.needsMigration && (
          <div className={cn(
            "bg-vilm-surface rounded-lg p-6",
            "border border-vilm-border/50",
            "shadow-sm"
          )}>
            <div className="flex items-center space-x-4 mb-4">
              <div className={cn(
                "w-12 h-12 rounded-lg",
                "bg-amber-500/10 flex items-center justify-center"
              )}>
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-vilm-text-primary">
                  Audio Format Update
                </h2>
                <p className="text-sm text-vilm-text-secondary">
                  {migrationStatus.count} file{migrationStatus.count !== 1 ? 's' : ''} need conversion to M4A
                </p>
              </div>
            </div>

            {isMigrating && migrationProgress && (
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-vilm-text-secondary">
                    {migrationProgress.current || 'Converting...'}
                  </span>
                  <span className="text-vilm-text-primary font-medium">
                    {migrationProgress.completed} / {migrationProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(migrationProgress.completed / migrationProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}

            <Button
              onClick={handleMigrateAudio}
              disabled={isMigrating}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "bg-vilm-primary hover:bg-vilm-primary-hover",
                "text-white"
              )}
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Convert to M4A Format</span>
                </>
              )}
            </Button>

            <p className="text-xs text-vilm-text-tertiary mt-3">
              M4A format ensures better compatibility with all sharing platforms and apps.
            </p>
          </div>
        )}

        {/* Settings List */}
        <div className={cn(
          "bg-vilm-surface rounded-lg",
          "border border-vilm-border/50",
          "shadow-sm overflow-hidden"
        )}>
          {settingsItems.map((item, index) => (
            <button
              key={item.id}
              onClick={item.action}
              className={cn(
                "w-full p-4 flex items-center space-x-4",
                "text-left transition-colors",
                "hover:bg-vilm-hover active:bg-vilm-pressed",
                "touch-manipulation",
                index < settingsItems.length - 1 && "border-b border-vilm-border/30"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg",
                "bg-vilm-primary/10 flex items-center justify-center"
              )}>
                <item.icon className="w-5 h-5 text-vilm-primary" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-vilm-text-primary">
                  {item.title}
                </h3>
                <p className="text-sm text-vilm-text-secondary">
                  {item.subtitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleCloseFeedback}
      />
    </div>
  );
};