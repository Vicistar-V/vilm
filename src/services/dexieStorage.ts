import { vilmDB, VilmObject } from '@/schemas/VilmSchema';
import { Vilm } from '@/types/vilm';

class DexieVilmStorage {
  async init(): Promise<void> {
    // Dexie automatically opens the database when first accessed
    await vilmDB.open();
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
    const now = new Date();
    
    await vilmDB.vilms.add({
      id: vilm.id,
      title: vilm.title,
      transcript: vilm.transcript,
      timestamp: now,
      audioFilename: vilm.audioFilename || '',
      duration: vilm.duration
    });
  }

  async getAllVilms(): Promise<Vilm[]> {
    const vilmObjects = await vilmDB.vilms.orderBy('timestamp').reverse().toArray();
    return vilmObjects.map(obj => this.vilmObjectToVilm(obj));
  }

  async getVilmById(id: string): Promise<Vilm | null> {
    const vilmObject = await vilmDB.vilms.get(id);
    return vilmObject ? this.vilmObjectToVilm(vilmObject) : null;
  }

  async deleteVilm(id: string): Promise<void> {
    await vilmDB.vilms.delete(id);
  }

  async searchVilms(query: string): Promise<Vilm[]> {
    const lowercaseQuery = query.toLowerCase();
    
    const vilmObjects = await vilmDB.vilms
      .filter(vilm => 
        vilm.title.toLowerCase().includes(lowercaseQuery) ||
        vilm.transcript.toLowerCase().includes(lowercaseQuery)
      )
      .reverse()
      .sortBy('timestamp');
    
    return vilmObjects.map(obj => this.vilmObjectToVilm(obj));
  }

  async updateVilm(id: string, updates: Partial<Omit<Vilm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const updateData: Partial<VilmObject> = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.transcript !== undefined) updateData.transcript = updates.transcript;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.audioFilename !== undefined) updateData.audioFilename = updates.audioFilename;
    
    await vilmDB.vilms.update(id, updateData);
  }

  async close(): Promise<void> {
    await vilmDB.close();
  }
}

export const dexieVilmStorage = new DexieVilmStorage();