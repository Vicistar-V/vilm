import React from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { permissionsService } from '@/services/permissionsService';
import { useToast } from '@/hooks/use-toast';

interface PermissionPromptProps {
  onPermissionGranted: () => void;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({ onPermissionGranted }) => {
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = React.useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const granted = await permissionsService.requestMicrophonePermission();
      
      if (granted) {
        toast({
          title: 'Permission Granted',
          description: 'You can now record audio',
        });
        onPermissionGranted();
      } else {
        toast({
          title: 'Permission Denied',
          description: 'Microphone access is required to record audio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to request microphone permission',
        variant: 'destructive',
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className={cn(
              "w-20 h-20 rounded-full",
              "bg-gradient-to-br from-primary to-primary-glow",
              "flex items-center justify-center"
            )}>
              <Mic className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-foreground mb-2">
          Microphone Access Required
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-6">
          Vilm needs access to your microphone to record audio notes. Your recordings stay private on your device.
        </p>

        {/* Info box */}
        <div className={cn(
          "flex items-start gap-3 p-4 rounded-lg mb-6",
          "bg-muted/50 border border-border"
        )}>
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            You can change this permission anytime in your device settings.
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={handleRequestPermission}
          disabled={isRequesting}
          className={cn(
            "w-full px-6 py-3 rounded-lg",
            "bg-primary text-primary-foreground",
            "font-medium text-base",
            "hover:opacity-90 active:opacity-80",
            "transition-opacity duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isRequesting ? 'Requesting...' : 'Allow Microphone Access'}
        </button>
      </div>
    </div>
  );
};
