import { useState, useEffect } from 'react';
import { browserTranscriptionService, TranscriptionPhase } from '@/services/browserTranscriptionService';

export const useTranscriptionEngine = () => {
  const [phase, setPhase] = useState<TranscriptionPhase>(() => 
    browserTranscriptionService.getPhase()
  );

  useEffect(() => {
    const handlePhaseChange = (newPhase: TranscriptionPhase) => {
      setPhase(newPhase);
    };

    // Subscribe to phase changes
    browserTranscriptionService.subscribe(handlePhaseChange);

    // Cleanup subscription on unmount
    return () => {
      browserTranscriptionService.unsubscribe(handlePhaseChange);
    };
  }, []);

  return {
    phase,
    isReady: phase === 'ready',
    isDownloading: phase === 'downloading',
    hasError: phase === 'error'
  };
};
