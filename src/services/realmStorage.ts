import Realm from 'realm';
import { VilmObject, realmConfig } from '@/schemas/VilmSchema';
import { Vilm } from '@/types/vilm';

class RealmVilmStorage {
  private realm: Realm | null = null;

  async init(): Promise<void> {
    if (!this.realm) {
      this.realm = await Realm.open(realmConfig);
    }
  }

  private async ensureRealm(): Promise<Realm> {
    if (!this.realm) {
      await this.init();
    }
    return this.realm!;
  }

  private vilmObjectToVilm(vilmObject: VilmObject): Vilm {
    return {
      id: vilmObject.id,
      title: vilmObject.title,
      transcript: vilmObject.transcript || '',
      duration: vilmObject.duration,
      createdAt: vilmObject.timestamp,
      updatedAt: vilmObject.timestamp,
      audioFilename: vilmObject.audioFilename,
      audioPath: undefined // Will be constructed when needed
    };
  }

  async saveVilm(vilm: Omit<Vilm, 'createdAt' | 'updatedAt'>): Promise<void> {
    const realm = await this.ensureRealm();
    
    realm.write(() => {
      const now = new Date();
      realm.create('Vilm', {
        id: vilm.id,
        title: vilm.title,
        transcript: vilm.transcript,
        timestamp: now,
        audioFilename: vilm.audioFilename,
        duration: vilm.duration
      });
    });
  }

  async getAllVilms(): Promise<Vilm[]> {
    const realm = await this.ensureRealm();
    const vilmObjects = realm.objects<VilmObject>('Vilm').sorted('timestamp', true);
    
    return Array.from(vilmObjects).map(obj => this.vilmObjectToVilm(obj));
  }

  async getVilmById(id: string): Promise<Vilm | null> {
    const realm = await this.ensureRealm();
    const vilmObject = realm.objectForPrimaryKey<VilmObject>('Vilm', id);
    
    return vilmObject ? this.vilmObjectToVilm(vilmObject) : null;
  }

  async deleteVilm(id: string): Promise<void> {
    const realm = await this.ensureRealm();
    
    realm.write(() => {
      const vilmObject = realm.objectForPrimaryKey('Vilm', id);
      if (vilmObject) {
        realm.delete(vilmObject);
      }
    });
  }

  async searchVilms(query: string): Promise<Vilm[]> {
    const realm = await this.ensureRealm();
    const lowercaseQuery = query.toLowerCase();
    
    const vilmObjects = realm.objects<VilmObject>('Vilm').filtered(
      'title CONTAINS[c] $0 OR transcript CONTAINS[c] $0',
      query
    ).sorted('timestamp', true);
    
    return Array.from(vilmObjects).map(obj => this.vilmObjectToVilm(obj));
  }

  async updateVilm(id: string, updates: Partial<Omit<Vilm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const realm = await this.ensureRealm();
    
    realm.write(() => {
      const vilmObject = realm.objectForPrimaryKey<VilmObject>('Vilm', id);
      if (vilmObject) {
        if (updates.title !== undefined) vilmObject.title = updates.title;
        if (updates.transcript !== undefined) vilmObject.transcript = updates.transcript;
        if (updates.duration !== undefined) vilmObject.duration = updates.duration;
        if (updates.audioFilename !== undefined) vilmObject.audioFilename = updates.audioFilename;
      }
    });
  }

  async close(): Promise<void> {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
      this.realm = null;
    }
  }
}

export const realmVilmStorage = new RealmVilmStorage();