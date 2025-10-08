import { Device } from '@capacitor/device';
import { browserTranscriptionService } from './browserTranscriptionService';

export interface PermissionStatus {
  microphone: boolean;
  deviceInfo?: any;
  isCheckingPermissions?: boolean;
}

class PermissionsService {
  private permissionStatus: PermissionStatus = {
    microphone: false,
    isCheckingPermissions: false
  };

  async initialize(): Promise<void> {
    try {
      // Get device info
      const deviceInfo = await Device.getInfo();
      this.permissionStatus.deviceInfo = deviceInfo;

      // Check initial permissions
      await this.checkAllPermissions();
    } catch (error) {
      console.error('Failed to initialize permissions service:', error);
      // Don't throw - gracefully continue without permissions
    }
  }

  async checkAllPermissions(): Promise<PermissionStatus> {
    this.permissionStatus.isCheckingPermissions = true;
    
    try {
      // Check microphone permissions (handled by audio recording service)
      this.permissionStatus.microphone = true; // Will be checked by audio service

      this.permissionStatus.isCheckingPermissions = false;
      return this.permissionStatus;
    } catch (error) {
      console.error('Failed to check permissions:', error);
      this.permissionStatus.isCheckingPermissions = false;
      return this.permissionStatus;
    }
  }

  getPermissionStatus(): PermissionStatus {
    return { ...this.permissionStatus };
  }

  async checkDeviceCapabilities(): Promise<{
    canRecord: boolean;
    canTranscribe: boolean;
    canShare: boolean;
    platform: string;
  }> {
    try {
      const deviceInfo = await Device.getInfo();
      const whisperAvailable = await browserTranscriptionService.isAvailable();

      return {
        canRecord: true, // Audio recording is supported on all platforms
        canTranscribe: whisperAvailable, // Whisper-based transcription
        canShare: true, // Share API is supported on all platforms
        platform: deviceInfo.platform
      };
    } catch (error) {
      console.error('Failed to check device capabilities:', error);
      return {
        canRecord: false,
        canTranscribe: false,
        canShare: false,
        platform: 'unknown'
      };
    }
  }
}

export const permissionsService = new PermissionsService();