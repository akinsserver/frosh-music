import type { Song } from '@/types/music';

const DB_NAME = 'frosh_music_offline_db';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks';

export interface DownloadedTrackRecord {
  id: string;
  song: Song;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: number;
}

export interface DownloadedTrackSummary {
  id: string;
  song: Song;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const store = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline database'));
  });
}

export async function saveOfflineTrack(
  song: Song,
  blob: Blob,
  mimeType?: string
): Promise<DownloadedTrackSummary> {
  const db = await openDB();
  const record: DownloadedTrackRecord = {
    id: song.id,
    song,
    blob,
    mimeType: mimeType || blob.type || 'audio/mp4',
    sizeBytes: blob.size,
    downloadedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    store.put(record);

    tx.oncomplete = () => {
      db.close();
      resolve({
        id: record.id,
        song: record.song,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        downloadedAt: record.downloadedAt,
      });
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to save offline track'));
    };
  });
}

export async function getOfflineTrack(id: string): Promise<DownloadedTrackRecord | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as DownloadedTrackRecord) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function getOfflineAudioUrl(id: string): Promise<string | null> {
  const record = await getOfflineTrack(id);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function getAllOfflineTracks(): Promise<DownloadedTrackSummary[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const records = (req.result as DownloadedTrackRecord[]) || [];
        const summaries: DownloadedTrackSummary[] = records
          .map((r) => ({
            id: r.id,
            song: r.song,
            mimeType: r.mimeType,
            sizeBytes: r.sizeBytes,
            downloadedAt: r.downloadedAt,
          }))
          .sort((a, b) => b.downloadedAt - a.downloadedAt);
        resolve(summaries);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}

export async function deleteOfflineTrack(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to delete offline track'));
    };
  });
}

export async function clearAllOfflineTracks(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Failed to clear offline tracks'));
    };
  });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}
