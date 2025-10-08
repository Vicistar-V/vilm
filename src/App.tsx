import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MainFeed } from './pages/MainFeed';
import { DetailView } from './pages/DetailView';
import { Settings } from './pages/Settings';
import { Vilm, AppView } from './types/vilm';
import { useStatusBar } from './hooks/useStatusBar';
import { useHaptics } from './hooks/useHaptics';
import { useVilmStorage } from './hooks/useVilmStorage';
import { sharingService } from './services/sharingService';
import { App as CapacitorApp } from '@capacitor/app';
import { browserTranscriptionService } from '@/services/browserTranscriptionService';
import { useWidgetLaunch } from './hooks/useWidgetLaunch';
import { PermissionPrompt } from './components/vilm/PermissionPrompt';

const queryClient = new QueryClient();

const AppContent = () => {
  const [currentView, setCurrentView] = useState<AppView>('feed');
  const [selectedVilm, setSelectedVilm] = useState<Vilm | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [widgetAudioPath, setWidgetAudioPath] = useState<string | null>(null);
  
  useStatusBar();
  const { notification } = useHaptics();
  const { vilms, deleteVilm, retryTranscription } = useVilmStorage();
  const { launchData, clearLaunchData } = useWidgetLaunch();

  // Handle widget launches
  useEffect(() => {
    if (!launchData) return;

    if (launchData.storageFullError) {
      toast.error('Failed to save recording. Your device storage is full.', {
        duration: 5000,
      });
      clearLaunchData();
    } else if (launchData.requirePermission) {
      setShowPermissionPrompt(true);
      clearLaunchData();
    } else if (launchData.openFinalizeModal && launchData.audioPath) {
      setWidgetAudioPath(launchData.audioPath);
      clearLaunchData();
    }
  }, [launchData, clearLaunchData]);

  // Silently initialize model in background on app startup
  useEffect(() => {
    browserTranscriptionService.initialize().catch(err => {
      console.error('Background model initialization failed:', err);
    });
  }, []);

  const handleBack = () => {
    setCurrentView('feed');
    setSelectedVilm(null);
  };

  const handleVilmClick = (vilm: Vilm) => {
    console.log('Vilm clicked:', vilm.id, 'Audio file:', vilm.audioFilename);
    
    // Safety check: ensure vilm has required data before navigating
    if (!vilm.audioFilename || !vilm.isAudioReady) {
      console.warn('Vilm not ready - preventing navigation');
      notification('error');
      return;
    }
    
    // Batch state updates by using functional update with both values
    setSelectedVilm(vilm);
    // Use setTimeout to batch with React 18's automatic batching
    setTimeout(() => setCurrentView('detail'), 0);
  };

  // Handle Android hardware back button
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      console.log('Hardware back button pressed - current view:', currentView);
      
      if (currentView === 'detail' || currentView === 'settings') {
        // Navigate back to feed
        setCurrentView('feed');
        setSelectedVilm(null);
      } else {
        // On feed view, exit the app
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [currentView]);

  const handleSettingsClick = () => {
    setCurrentView('settings');
  };

  const handleShare = async () => {
    if (selectedVilm) {
      try {
        await sharingService.shareVilm(selectedVilm);
        notification('success');
      } catch (error) {
        console.error('Failed to share vilm:', error);
        notification('error');
      }
    }
  };

  const handleDelete = async () => {
    if (selectedVilm) {
      try {
        await deleteVilm(selectedVilm.id);
        notification('success');
        handleBack();
      } catch (error) {
        console.error('Failed to delete vilm:', error);
        notification('error');
      }
    }
  };

  const handleRetryTranscription = async (vilmId: string) => {
    try {
      await retryTranscription(vilmId);
      notification('success');
    } catch (error) {
      console.error('Failed to retry transcription:', error);
      notification('error');
    }
  };

  return (
    <div className="min-h-screen-safe bg-background">
      {showPermissionPrompt && (
        <PermissionPrompt 
          onClose={() => setShowPermissionPrompt(false)}
          onPermissionGranted={() => {
            setShowPermissionPrompt(false);
            notification('success');
          }}
        />
      )}

      {currentView === 'feed' && (
        <MainFeed 
          onVilmClick={handleVilmClick} 
          onSettingsClick={handleSettingsClick}
          widgetAudioPath={widgetAudioPath}
          onWidgetAudioProcessed={() => setWidgetAudioPath(null)}
        />
      )}
      
      {currentView === 'detail' && selectedVilm ? (
        <DetailView
          vilm={selectedVilm}
          onBack={handleBack}
          onShare={handleShare}
          onDelete={handleDelete}
          onRetryTranscription={handleRetryTranscription}
        />
      ) : currentView === 'detail' && !selectedVilm ? (
        // Fallback if vilm not found - show loading or error
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-foreground font-medium mb-2">Loading vilm...</p>
            <p className="text-muted-foreground text-sm mb-4">
              If this persists, the vilm may have been deleted
            </p>
            <button 
              onClick={handleBack}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              Go Back to Feed
            </button>
          </div>
        </div>
      ) : null}

      {currentView === 'settings' && (
        <Settings onBack={handleBack} />
      )}
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;