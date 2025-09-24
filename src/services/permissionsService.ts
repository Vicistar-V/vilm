import { Device } from '@capacitor/device';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface PermissionStatus {
  microphone: boolean;
  speechRecognition: boolean;
  deviceInfo?: any;
}

class PermissionsService {
  private permissionStatus: PermissionStatus = {
    microphone: false,
    speechRecognition: false
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
    }
  }

  async checkAllPermissions(): Promise<PermissionStatus> {
    try {
      // Check microphone permissions (handled by audio recording service)
      this.permissionStatus.microphone = true; // Will be checked by audio service

      // Check speech recognition availability and permissions
      const { available } = await SpeechRecognition.available();
      if (available) {
        const permissionResult = await SpeechRecognition.requestPermissions();
        this.permissionStatus.speechRecognition = 
          permissionResult.speechRecognition === 'granted';
      } else {
        this.permissionStatus.speechRecognition = false;
      }

      return this.permissionStatus;
    } catch (error) {
      console.error('Failed to check permissions:', error);
      return this.permissionStatus;
    }
  }

  async requestSpeechRecognitionPermission(): Promise<boolean> {
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        return false;
      }

      const permissionResult = await SpeechRecognition.requestPermissions();
      const granted = permissionResult.speechRecognition === 'granted';
      
      this.permissionStatus.speechRecognition = granted;
      return granted;
    } catch (error) {
      console.error('Failed to request speech recognition permission:', error);
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