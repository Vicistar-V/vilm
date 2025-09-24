import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const useHaptics = () => {
  const impact = async (style: ImpactStyle = ImpactStyle.Medium) => {
    try {
      await Haptics.impact({ style });
    } catch (error) {
      // Fallback for web or if haptics not available
      console.log('Haptics not available');
    }
  };

  const selection = async () => {
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  const notification = async (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      const notificationType = type === 'success' 
        ? NotificationType.Success 
        : type === 'warning' 
        ? NotificationType.Warning 
        : NotificationType.Error;
        
      await Haptics.notification({ type: notificationType });
    } catch (error) {
      console.log('Haptics not available');
    }
  };

  return {
    impact,
    selection,
    notification
  };
};