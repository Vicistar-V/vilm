import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MainFeed } from './pages/MainFeed';
import { DetailView } from './pages/DetailView';
import { Vilm, AppView } from './types/vilm';
import { useStatusBar } from './hooks/useStatusBar';
import { useHaptics } from './hooks/useHaptics';
import { useVilmStorage } from './hooks/useVilmStorage';
import { sharingService } from './services/sharingService';

const queryClient = new QueryClient();

const AppContent = () => {
  const [currentView, setCurrentView] = useState<AppView>('feed');
  const [selectedVilm, setSelectedVilm] = useState<Vilm | null>(null);
  
  useStatusBar();
  const { notification } = useHaptics();
  const { deleteVilm } = useVilmStorage();

  const handleVilmClick = (vilm: Vilm) => {
    setSelectedVilm(vilm);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setCurrentView('feed');
    setSelectedVilm(null);
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

  return (
    <div className="min-h-screen-safe bg-background">
      {currentView === 'feed' && (
        <MainFeed onVilmClick={handleVilmClick} />
      )}
      
      {currentView === 'detail' && selectedVilm && (
        <DetailView
          vilm={selectedVilm}
          onBack={handleBack}
          onShare={handleShare}
          onDelete={handleDelete}
        />
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