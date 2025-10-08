import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface WidgetLaunchData {
  requirePermission: boolean;
  openFinalizeModal: boolean;
  audioFromWidget: boolean;
  audioPath: string | null;
  storageFullError: boolean;
}

export const useWidgetLaunch = () => {
  const [launchData, setLaunchData] = useState<WidgetLaunchData | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const checkLaunch = async () => {
      try {
        const { VilmWidget } = await import('../plugins/VilmWidgetPlugin');
        const data = await VilmWidget.checkWidgetLaunch();
        
        if (data.requirePermission || data.openFinalizeModal || data.storageFullError) {
          setLaunchData(data);
        }
      } catch (error) {
        console.error('Failed to check widget launch:', error);
      }
    };

    // Check on mount
    checkLaunch();

    // Also check when app resumes
    const handleResume = () => checkLaunch();
    document.addEventListener('resume', handleResume);

    return () => {
      document.removeEventListener('resume', handleResume);
    };
  }, []);

  const clearLaunchData = () => setLaunchData(null);

  return { launchData, clearLaunchData };
};
