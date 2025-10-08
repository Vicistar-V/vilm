import { pipeline } from '@huggingface/transformers';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isSuccess: boolean;
  error?: string;
}

export type TranscriptionPhase = 'idle' | 'downloading' | 'ready' | 'error';

type PhaseListener = (phase: TranscriptionPhase) => void;
type ProgressListener = (progress: number) => void;

class BrowserTranscriptionService {
  private transcriber: any = null;
  private isInitializing = false;
  private phase: TranscriptionPhase = 'idle';
  private listeners = new Set<PhaseListener>();
  private progressListeners = new Set<ProgressListener>();
  private downloadProgress: number = 0;
  private currentTaskId: string | null = null;
  private cancelledTaskIds = new Set<string>();

  getPhase(): TranscriptionPhase {
    return this.phase;
  }

  subscribe(listener: PhaseListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: PhaseListener): void {
    this.listeners.delete(listener);
  }

  subscribeProgress(listener: ProgressListener): void {
    this.progressListeners.add(listener);
  }

  unsubscribeProgress(listener: ProgressListener): void {
    this.progressListeners.delete(listener);
  }

  getDownloadProgress(): number {
    return this.downloadProgress;
  }

  isDownloading(): boolean {
    return this.phase === 'downloading';
  }

  private setPhase(phase: TranscriptionPhase): void {
    this.phase = phase;
    this.listeners.forEach(listener => listener(phase));
  }

  private setProgress(progress: number): void {
    this.downloadProgress = progress;
    this.progressListeners.forEach(listener => listener(progress));
  }

  async warmFromCache(): Promise<boolean> {
    if (this.transcriber) {
      console.log('Transcriber already initialized');
      return true;
    }

    try {
      console.log('Attempting to warm model from cache...');
      
      // Try WebGPU first, fallback to WASM
      let device: 'webgpu' | 'wasm' = 'wasm';
      
      if ((navigator as any).gpu) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
          }
        } catch {
          // Silently fallback to WASM
        }
      }
      
      // Try to load from cache only (no download)
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        { 
          device,
          cache_dir: 'whisper-models',
          local_files_only: true, // Only use cached files
        }
      );
      
      console.log('Model loaded from cache successfully');
      this.setPhase('ready');
      return true;
    } catch (error) {
      console.log('Model not in cache or failed to load:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (this.transcriber || this.isInitializing) return;

    this.isInitializing = true;
    
    // Check if model is already cached
    const isCached = await this.checkModelCache();
    if (isCached) {
      console.log('Model already cached, loading from cache...');
    } else {
      console.log('Model not cached, will download...');
    }
    
    this.setPhase('downloading');
    
    try {
      console.log('Initializing browser-based Whisper transcription...');
      
      // Try WebGPU first, fallback to WASM for broader compatibility
      let device: 'webgpu' | 'wasm' = 'wasm';
      
      if ((navigator as any).gpu) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
            console.log('Using WebGPU for transcription');
          }
        } catch (e) {
          console.log('WebGPU not available, falling back to WASM');
        }
      }
      
      // Use tiny.en model for speed, or 'base.en' for better accuracy
      // Configure persistent caching to avoid re-downloading model on app restart
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        { 
          device,
          cache_dir: 'whisper-models', // Store in IndexedDB for persistence
          local_files_only: false, // Allow download on first run
          progress_callback: (progress: any) => {
            // Track download progress
            if (progress.status === 'downloading' || progress.status === 'progress') {
              const percent = progress.progress ? Math.round(progress.progress * 100) : 0;
              this.setProgress(percent);
            }
          }
        }
      );
      
      console.log(`Whisper transcription initialized successfully on ${device}`);
      
      // Set localStorage flag to indicate model is downloaded
      localStorage.setItem('whisper_model_downloaded', 'true');
      
      this.setPhase('ready');
    } catch (error) {
      console.error('Failed to initialize transcription:', error);
      this.setPhase('error');
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  cancelTranscription(): void {
    if (this.currentTaskId) {
      this.cancelledTaskIds.add(this.currentTaskId);
      console.log(`Cancelled transcription task: ${this.currentTaskId}`);
      this.currentTaskId = null;
    }
  }

  async transcribeAudio(audioDataUrl: string): Promise<TranscriptionResult> {
    // Generate unique task ID
    const taskId = `task_${Date.now()}_${Math.random()}`;
    this.currentTaskId = taskId;

    try {
      await this.initialize();

      // Check if cancelled during initialization
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
        return {
          transcript: '',
          confidence: 0,
          isSuccess: false,
          error: 'Transcription cancelled'
        };
      }

      console.log('Starting transcription...');
      const result = await this.transcriber(audioDataUrl);
      
      // Check if cancelled after transcription
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
        return {
          transcript: '',
          confidence: 0,
          isSuccess: false,
          error: 'Transcription cancelled'
        };
      }
      
      console.log('Transcription complete:', result);

      // Clear task if it's still current
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }

      return {
        transcript: result.text || '',
        confidence: 0.9,
        isSuccess: true
      };
    } catch (error) {
      console.error('Transcription error:', error);
      
      // Clear cancelled flag if it exists
      if (this.cancelledTaskIds.has(taskId)) {
        this.cancelledTaskIds.delete(taskId);
      }
      
      // Clear task if it's still current
      if (this.currentTaskId === taskId) {
        this.currentTaskId = null;
      }
      
      return {
        transcript: '',
        confidence: 0,
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Whisper can work with both WebGPU and WASM
      // Check for basic browser compatibility
      return typeof navigator !== 'undefined' && typeof atob !== 'undefined';
    } catch {
      return false;
    }
  }

  private async checkModelCache(): Promise<boolean> {
    try {
      // Check if model is cached in IndexedDB (transformers.js uses IndexedDB for model storage)
      const databases = await indexedDB.databases();
      console.log('[ModelCache] Available databases:', databases.map(db => db.name));
      
      const hasCache = databases.some(db => 
        db.name?.includes('transformers') || 
        db.name?.includes('whisper') ||
        db.name?.includes('onnx') ||
        db.name?.includes('huggingface')
      );
      
      console.log('[ModelCache] Cache detected:', hasCache);
      
      // Also check if transcriber is already initialized
      if (this.transcriber) {
        console.log('[ModelCache] Transcriber already initialized');
        return true;
      }
      
      return hasCache;
    } catch {
      return false;
    }
  }

  async getCacheStatus(): Promise<{ isCached: boolean; estimatedSize?: number }> {
    try {
      const isCached = await this.checkModelCache();
      
      // Try to estimate cache size
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          isCached,
          estimatedSize: estimate.usage
        };
      }
      
      return { isCached };
    } catch {
      return { isCached: false };
    }
  }

  async clearCache(): Promise<void> {
    try {
      // Delete IndexedDB databases used by transformers.js
      const databases = await indexedDB.databases();
      const dbsToDelete = databases.filter(db => 
        db.name?.includes('transformers') || 
        db.name?.includes('whisper') ||
        db.name?.includes('onnx') ||
        db.name?.includes('huggingface')
      );
      
      for (const db of dbsToDelete) {
        if (db.name) {
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => {
              console.log(`Deleted IndexedDB: ${db.name}`);
              resolve();
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
              console.warn(`Deletion blocked for: ${db.name}`);
              resolve(); // Continue anyway
            };
          });
        }
      }
      
      // Clear Cache API
      const cacheKey = 'whisper-models';
      const cacheNames = await window.caches.keys();
      
      for (const name of cacheNames) {
        if (name.includes(cacheKey)) {
          await window.caches.delete(name);
          console.log(`Cleared cache: ${name}`);
        }
      }
      
      // Clear localStorage flag
      localStorage.removeItem('whisper_model_downloaded');
      
      // Reset transcriber to force re-initialization
      this.transcriber = null;
      this.setPhase('idle');
      this.setProgress(0);
      
      console.log('Model cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear model cache:', error);
      throw error;
    }
  }
}

export const browserTranscriptionService = new BrowserTranscriptionService();
