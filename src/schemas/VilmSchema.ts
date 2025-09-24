import Realm from 'realm';

export class VilmObject extends Realm.Object<VilmObject> {
  id!: string;
  title!: string;
  transcript!: string;
  timestamp!: Date;
  audioFilename!: string;
  duration!: number;

  static schema: Realm.ObjectSchema = {
    name: 'Vilm',
    primaryKey: 'id',
    properties: {
      id: 'string',
      title: 'string',
      transcript: 'string?', // Optional in case transcription fails
      timestamp: 'date',
      audioFilename: 'string', // e.g., "uuid.m4a"
      duration: 'double' // number of seconds
    },
  };
}

export const realmConfig: Realm.Configuration = {
  schema: [VilmObject],
  schemaVersion: 1,
  onMigration: (oldRealm, newRealm) => {
    // Handle schema migration if needed in the future
  },
};