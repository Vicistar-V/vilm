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
      const submission: FeedbackSubmission = {
        message: message.trim(),
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0' // You can get this from package.json or config
      };

      const response = await CapacitorHttp.post({
        url: this.endpoint,
        headers: {
          'Content-Type': 'application/json',
        },
        data: submission,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      return false;
    }
  }
}

export const feedbackService = new FeedbackService();