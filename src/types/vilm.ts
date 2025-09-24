export interface Vilm {
  id: string;
  title: string;
  transcript: string;
  duration: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  isProcessing: boolean;
}

export type AppView = 'feed' | 'detail' | 'recording';