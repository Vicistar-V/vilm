import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vilm.app',
  appName: 'Vilm',
  webDir: 'dist',
  // Development hot-reload (comment out for production builds)
  // server: {
  //   url: 'https://a50b1d70-143b-4726-9ead-ae7b248a8b9b.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F8F8F8',
      overlaysWebView: false
    },
    Haptics: {
      enabled: true
    }
  }
};

export default config;