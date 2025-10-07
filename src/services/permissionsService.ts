import { Device } from '@capacitor/device';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface PermissionStatus {
  microphone: boolean;
  speechRecognition: boolean | null;
  deviceInfo?: any;
  isCheckingPermissions?: boolean;
}

class PermissionsService {
  private permissionStatus: PermissionStatus = {
    microphone: false,
    speechRecognition: null,
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

      // Check if we're on web - skip speech recognition on web
      const deviceInfo = await Device.getInfo();
      if (deviceInfo.platform === 'web') {
        this.permissionStatus.speechRecognition = false;
        this.permissionStatus.isCheckingPermissions = false;
        return this.permissionStatus;
      }

      // Check speech recognition availability and permissions (native only)
      try {
        const { available } = await SpeechRecognition.available();
        if (available) {
          const permissionResult = await SpeechRecognition.requestPermissions();
          this.permissionStatus.speechRecognition = 
            permissionResult.speechRecognition === 'granted';
        } else {
          this.permissionStatus.speechRecognition = false;
        }
      } catch (error) {
        console.log('Speech recognition not available on this platform');
        this.permissionStatus.speechRecognition = false;
      }

      this.permissionStatus.isCheckingPermissions = false;
      return this.permissionStatus;
    } catch (error) {
      console.error('Failed to check permissions:', error);
      this.permissionStatus.isCheckingPermissions = false;
      return this.permissionStatus;
    }
  }

  async requestSpeechRecognitionPermission(): Promise<boolean> {
    try {
      // Check platform first
      const deviceInfo = await Device.getInfo();
      if (deviceInfo.platform === 'web') {
        console.log('Speech recognition not supported on web');
        return false;
      }

      const { available } = await SpeechRecognition.available();
      if (!available) {
        return false;
      }

      const permissionResult = await SpeechRecognition.requestPermissions();
      const granted = permissionResult.speechRecognition === 'granted';
      
      this.permissionStatus.speechRecognition = granted;
      return granted;
    } catch (error) {
      console.log('Speech recognition permission request failed:', error);
      return false;
    }
  }

  getPermissionStatus(): PermissionStatus {
    return { ...this.permissionStatus };
  }

  isSpeechRecognitionAvailable(): boolean {
    return this.permissionStatus.speechRecognition;
  }

  async checkDeviceCapabilities(): Promise<{
    canRecord: boolean;
    canTranscribe: boolean;
    canShare: boolean;
    platform: string;
  }> {
    try {
      const deviceInfo = await Device.getInfo();
      const { available: speechAvailable } = await SpeechRecognition.available();

      return {
        canRecord: true, // Audio recording is supported on all platforms
        canTranscribe: speechAvailable,
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