import Dexie, { Table } from 'dexie';

export interface VilmObject {
  id: string;
  title: string;
  transcript: string;
  timestamp: Date;
  audioFilename: string;
  duration: number;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionError?: string;
  transcriptionRetryCount?: number;
  isAudioReady?: boolean;
}

export class VilmDatabase extends Dexie {
  vilms!: Table<VilmObject>;

  constructor() {
    super('VilmDatabase');
    this.version(2).stores({
      vilms: 'id, title, transcript, timestamp, audioFilename, duration, transcriptionStatus, transcriptionError, transcriptionRetryCount, isAudioReady'
    });
  }
}

export const vilmDB = new VilmDatabase();