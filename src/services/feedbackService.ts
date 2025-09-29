import { CapacitorHttp } from '@capacitor/core';

interface FeedbackSubmission {
  message: string;
  timestamp: string;
  appVersion: string;
}

class FeedbackService {
  private readonly endpoint = 'https://submit-form.com/utj9PoQO4';
  
  async submitFeedback(message: string): Promise<boolean> {
    try {
      // Formspark expects form-encoded data, not JSON
      const formData = new URLSearchParams();
      formData.append('message', message.trim());
      formData.append('timestamp', new Date().toISOString());
      formData.append('appVersion', '1.0.0');

      const response = await CapacitorHttp.post({
        url: this.endpoint,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*',
          'Origin': window.location.origin,
        },
        data: formData.toString(),
        webFetchExtra: {
          mode: 'no-cors',
          credentials: 'omit'
        }
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      return false;
    }
  }
}

export const feedbackService = new FeedbackService();