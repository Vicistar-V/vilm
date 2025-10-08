import { registerPlugin } from '@capacitor/core';

export interface VilmWidgetPlugin {
  checkWidgetLaunch(): Promise<{
    requirePermission: boolean;
    openFinalizeModal: boolean;
    audioFromWidget: boolean;
    audioPath: string | null;
    storageFullError: boolean;
  }>;
  
  clearTempAudio(): Promise<void>;
}

export const VilmWidget = registerPlugin<VilmWidgetPlugin>('VilmWidget');
