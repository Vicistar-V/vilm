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

const queryClient = new QueryClient();

// Mock data for UI demonstration
const mockVilms: Vilm[] = [
  {
    id: '1',
    title: 'Project Ideas for Q4',
    transcript: 'I was thinking about the new features we could implement for the fourth quarter. The voice memo functionality could be really powerful if we focus on transcription accuracy and seamless user experience. We should also consider adding collaboration features.',
    duration: 127, // 2:07
    createdAt: new Date('2024-01-15T10:30:00'),
    updatedAt: new Date('2024-01-15T10:30:00'),
  },
  {
    id: '2', 
    title: 'Grocery List',
    transcript: 'Need to pick up milk, bread, eggs, and some fresh vegetables for the week. Don\'t forget the avocados for tomorrow\'s breakfast. Also check if they have those organic tomatoes.',
    duration: 45, // 0:45
    createdAt: new Date('2024-01-14T16:45:00'),
    updatedAt: new Date('2024-01-14T16:45:00'),
  },
  {
    id: '3',
    title: '',
    transcript: 'Remember to call mom tonight about the family dinner plans for this weekend. She mentioned something about making her famous lasagna but I need to confirm the time.',
    duration: 23, // 0:23
    createdAt: new Date('2024-01-13T14:20:00'),
    updatedAt: new Date('2024-01-13T14:20:00'),
  }
];

const App = () => {
  const [currentView, setCurrentView] = useState<AppView>('feed');
  const [selectedVilm, setSelectedVilm] = useState<Vilm | null>(null);
  const [vilms, setVilms] = useState<Vilm[]>(mockVilms);
  
  // Initialize native hooks
  useStatusBar();
  const { notification } = useHaptics();

  const handleVilmClick = (vilm: Vilm) => {
    setSelectedVilm(vilm);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setCurrentView('feed');
    setSelectedVilm(null);
  };

  const handleCreateVilm = (title: string) => {
    const newVilm: Vilm = {
      id: Date.now().toString(),
      title,
      transcript: 'This is a mock transcript. In the actual app, this would contain the transcribed text from the voice recording.',
      duration: Math.floor(Math.random() * 180) + 30, // Random duration between 30-210 seconds
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setVilms(prev => [newVilm, ...prev]);
    notification('success');
  };

  const handleShare = async () => {
    if (selectedVilm) {
      // Mock share functionality
      try {
        await navigator.share({
          title: selectedVilm.title || 'Vilm Note',
          text: selectedVilm.transcript,
        });
      } catch (error) {
        // Fallback for browsers without native share
        navigator.clipboard.writeText(selectedVilm.transcript);
        notification('success');
      }
    }
  };

  const handleDelete = () => {
    if (selectedVilm) {
      setVilms(prev => prev.filter(v => v.id !== selectedVilm.id));
      notification('success');
      handleBack();
    }
  };

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
        <div className="min-h-screen-safe bg-background">
          {currentView === 'feed' && (
            <MainFeed
              vilms={vilms}
              onVilmClick={handleVilmClick}
              onCreateVilm={handleCreateVilm}
            />
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
        
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;