import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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

const queryClient = new QueryClient();

const AppContent = () => {
  const [currentView, setCurrentView] = useState<AppView>('feed');
  const [selectedVilmId, setSelectedVilmId] = useState<string | null>(null);
  const [selectedVilm, setSelectedVilm] = useState<Vilm | null>(null);
  
  useStatusBar();
  const { notification } = useHaptics();
  const { vilms, deleteVilm, retryTranscription, getVilmById } = useVilmStorage();

  // Fetch the full vilm from database when selectedVilmId changes
  useEffect(() => {
    const fetchVilm = async () => {
      if (selectedVilmId) {
        console.log('Fetching vilm from database:', selectedVilmId);
        const vilm = await getVilmById(selectedVilmId);
        console.log('Fetched vilm:', vilm ? { id: vilm.id, audioFilename: vilm.audioFilename, isAudioReady: vilm.isAudioReady } : 'null');
        setSelectedVilm(vilm);
      } else {
        setSelectedVilm(null);
      }
    };
    fetchVilm();
  }, [selectedVilmId, getVilmById]);

  const handleBack = () => {
    setCurrentView('feed');
    setSelectedVilmId(null);
  };

  const handleVilmClick = (vilm: Vilm) => {
    console.log('Vilm clicked:', vilm.id, 'Audio file:', vilm.audioFilename);
    
    // Safety check: ensure vilm has required data before navigating
    if (!vilm.audioFilename) {
      console.warn('Vilm missing audio file - preventing navigation');
      notification('error');
      return;
    }
    
    setSelectedVilmId(vilm.id);
    setCurrentView('detail');
  };

  // Handle Android hardware back button
  useEffect(() => {
    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      console.log('Hardware back button pressed - current view:', currentView);
      
      if (currentView === 'detail' || currentView === 'settings') {
        // Navigate back to feed
        setCurrentView('feed');
        setSelectedVilmId(null);
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
      {currentView === 'feed' && (
        <MainFeed 
          onVilmClick={handleVilmClick} 
          onSettingsClick={handleSettingsClick}
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