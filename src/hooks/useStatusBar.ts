import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';

export const useStatusBar = () => {
  useEffect(() => {
    const setupStatusBar = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#F8F8F8' });
      } catch (error) {
        console.log('StatusBar not available');
      }
    };

    setupStatusBar();
  }, []);

  const setDarkStatusBar = async () => {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1C1C1E' });
    } catch (error) {
      console.log('StatusBar not available');
    }
  };

  const setLightStatusBar = async () => {
    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#F8F8F8' });
    } catch (error) {
      console.log('StatusBar not available');
    }
  };

  return {
    setDarkStatusBar,
    setLightStatusBar
  };
};