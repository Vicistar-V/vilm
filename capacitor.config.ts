import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a50b1d70143b47269eadae7b248a8b9b',
  appName: 'vilmo-your-world',
  webDir: 'dist',
  server: {
    url: 'https://a50b1d70-143b-4726-9ead-ae7b248a8b9b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F8F8F8'
    },
    Haptics: {
      enabled: true
    }
  }
};

export default config;