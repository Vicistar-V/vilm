import { CapacitorHttp, Capacitor } from '@capacitor/core';

interface FeedbackSubmission {
  message: string;
  timestamp: string;
  appVersion: string;
}

class FeedbackService {
  private readonly endpoint = 'https://submit-form.com/utj9PoQO4';
  
  async submitFeedback(message: string): Promise<boolean> {
    try {
      const platform = Capacitor.getPlatform();
      const formData = new URLSearchParams();
      formData.append('message', message.trim());
      formData.append('timestamp', new Date().toISOString());
      formData.append('appVersion', '1.0.0');
      formData.append('platform', platform);

      console.debug('Submitting feedback on platform:', platform);

      if (platform === 'web') {
        // For web, use fetch with no-cors and return true if no error
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
          mode: 'no-cors',
          credentials: 'omit'
        });
        
        console.debug('Web fetch completed - treating as success (opaque response)');
        return true; // no-cors returns opaque response, can't check status
      } else {
        // For native platforms, use CapacitorHttp
        const response = await CapacitorHttp.post({
          url: this.endpoint,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: formData.toString(),
        });

        const success = response.status >= 200 && response.status < 300;
        console.debug('Native response status:', response.status, 'success:', success);
        return success;
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      return false;
    }
  }
}

export const feedbackService = new FeedbackService();