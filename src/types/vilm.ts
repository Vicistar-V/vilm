export interface Vilm {
  id: string;
  title: string;
  transcript: string;
  duration: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
  audioFilename?: string; // filename of the audio file
  audioPath?: string; // full path to the audio file
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed'; // transcription state
  transcriptionError?: string; // error message if transcription failed
  transcriptionRetryCount?: number; // number of retry attempts
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  isProcessing: boolean;
}

export type AppView = 'feed' | 'detail' | 'recording' | 'settings';