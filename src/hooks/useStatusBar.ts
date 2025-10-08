import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export const useStatusBar = () => {
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    const currentTheme = theme === 'system' ? systemTheme : theme;
    
    const setupStatusBar = async () => {
      try {
        if (currentTheme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#1C1C1C' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#F8F8F8' });
        }
      } catch (error) {
        console.log('StatusBar not available');
      }
    };

    setupStatusBar();
  }, [theme, systemTheme]);

  const setDarkStatusBar = async () => {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1C1C1C' });
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