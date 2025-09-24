import { VilmObject } from '@/schemas/VilmSchema';
import { Vilm } from '@/types/vilm';

class RealmVilmStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'VilmDatabase';
  private readonly storeName = 'Vilm';
  private readonly version = 1;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await this.openDatabase();
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('transcript', 'transcript', { unique: false });
        }
      };
    });
  }

  private async ensureDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
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
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const now = new Date();
      const vilmObject: VilmObject = {
        id: vilm.id,
        title: vilm.title,
        transcript: vilm.transcript || '',
        timestamp: now,
        audioFilename: vilm.audioFilename || '',
        duration: vilm.duration
      };
      
      const request = store.add(vilmObject);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllVilms(): Promise<Vilm[]> {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Sort by timestamp descending
      
      const vilms: Vilm[] = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          vilms.push(this.vilmObjectToVilm(cursor.value));
          cursor.continue();
        } else {
          resolve(vilms);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getVilmById(id: string): Promise<Vilm | null> {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? this.vilmObjectToVilm(result) : null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVilm(id: string): Promise<void> {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async searchVilms(query: string): Promise<Vilm[]> {
    const db = await this.ensureDatabase();
    const lowercaseQuery = query.toLowerCase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      const results: Vilm[] = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const vilmObject = cursor.value as VilmObject;
          const titleMatch = vilmObject.title.toLowerCase().includes(lowercaseQuery);
          const transcriptMatch = vilmObject.transcript.toLowerCase().includes(lowercaseQuery);
          
          if (titleMatch || transcriptMatch) {
            results.push(this.vilmObjectToVilm(vilmObject));
          }
          
          cursor.continue();
        } else {
          // Sort by timestamp descending
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async updateVilm(id: string, updates: Partial<Omit<Vilm, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const db = await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const vilmObject = getRequest.result as VilmObject;
        if (vilmObject) {
          if (updates.title !== undefined) vilmObject.title = updates.title;
          if (updates.transcript !== undefined) vilmObject.transcript = updates.transcript;
          if (updates.duration !== undefined) vilmObject.duration = updates.duration;
          if (updates.audioFilename !== undefined) vilmObject.audioFilename = updates.audioFilename;
          
          const putRequest = store.put(vilmObject);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Vilm with id ${id} not found`));
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const realmVilmStorage = new RealmVilmStorage();