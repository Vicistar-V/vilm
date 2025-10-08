import React, { useState } from 'react';
import { ArrowLeft, MessageSquare, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FeedbackModal } from '@/components/vilm/FeedbackModal';
import { ModelStatusCard } from '@/components/vilm/ModelStatusCard';
import { useHaptics } from '@/hooks/useHaptics';

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const { selection, impact } = useHaptics();

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