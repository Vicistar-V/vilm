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

    let retryTimeout: NodeJS.Timeout;

    const checkLaunch = async (isRetry = false) => {
      try {
        // Check if plugin is available
        if (!Capacitor.isPluginAvailable('VilmWidget')) {
          if (isRetry) {
            console.error('❌ VilmWidget plugin still unavailable after retry. Please run: npx cap sync android, clean/rebuild in Android Studio, and reinstall the app.');
            return;
          }
          console.warn('⚠️ VilmWidget plugin not available yet, scheduling retry in 500ms...');
          retryTimeout = setTimeout(() => checkLaunch(true), 500);
          return;
        }

        const { VilmWidget } = await import('../plugins/VilmWidgetPlugin');
        const data = await VilmWidget.checkWidgetLaunch();
        
        console.log('✅ Widget launch data received:', data);
        
        if (data.requirePermission || data.openFinalizeModal || data.storageFullError) {
          console.log('Setting launch data - openFinalizeModal:', data.openFinalizeModal, 'audioPath:', data.audioPath);
          setLaunchData(data);
        } else {
          console.log('No widget launch action needed');
        }
      } catch (error: any) {
        if (error?.message?.includes('not implemented')) {
          console.error('❌ VilmWidget plugin is not implemented. This usually means:\n' +
            '1. Run: npx cap sync android\n' +
            '2. In Android Studio: Build > Clean Project, then Build > Rebuild Project\n' +
            '3. Uninstall old app from device\n' +
            '4. Run the new build');
        } else {
          console.error('Failed to check widget launch:', error);
        }
      }
    };

    // Delay initial check by 300ms to avoid cold-start issues
    const initialTimeout = setTimeout(() => checkLaunch(), 300);

    // Also check when app resumes
    const handleResume = () => checkLaunch();
    document.addEventListener('resume', handleResume);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(retryTimeout);
      document.removeEventListener('resume', handleResume);
    };
  }, []);

  const clearLaunchData = () => setLaunchData(null);

  return { launchData, clearLaunchData };
};
