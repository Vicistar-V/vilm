import Dexie, { Table } from 'dexie';

export interface VilmObject {
  id: string;
  title: string;
  transcript: string;
  timestamp: Date;
  audioFilename: string;
  duration: number;
}

export class VilmDatabase extends Dexie {
  vilms!: Table<VilmObject>;

  constructor() {
    super('VilmDatabase');
    this.version(1).stores({
      vilms: 'id, title, transcript, timestamp, audioFilename, duration'
    });
  }
}

export const vilmDB = new VilmDatabase();