'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Song } from '@/types/music';
import { getStreamUrl } from '@/lib/api';
import {
  saveOfflineTrack,
  getAllOfflineTracks,
  deleteOfflineTrack,
  clearAllOfflineTracks,
  type DownloadedTrackSummary,
} from '@/lib/offlineStorage';

interface OfflineContextValue {
  downloadedTracks: DownloadedTrackSummary[];
  downloadedIds: Set<string>;
  downloadingProgress: Record<string, number>;
  totalBytes: number;
  isOffline: boolean;
  isDownloaded: (trackId: string) => boolean;
  isDownloading: (trackId: string) => boolean;
  downloadTrack: (song: Song) => Promise<boolean>;
  downloadTracks: (songs: Song[]) => Promise<void>;
  removeDownload: (trackId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  refreshDownloads: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrackSummary[]>([]);
  const [downloadingProgress, setDownloadingProgress] = useState<Record<string, number>>({});
  const [isOffline, setIsOffline] = useState(false);

  const refreshDownloads = useCallback(async () => {
    const list = await getAllOfflineTracks();
    setDownloadedTracks(list);
  }, []);

  useEffect(() => {
    refreshDownloads();

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      const onOnline = () => setIsOffline(false);
      const onOffline = () => setIsOffline(true);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  }, [refreshDownloads]);

  const downloadedIds = useMemo(
    () => new Set(downloadedTracks.map((t) => t.id)),
    [downloadedTracks]
  );

  const totalBytes = useMemo(
    () => downloadedTracks.reduce((acc, t) => acc + (t.sizeBytes || 0), 0),
    [downloadedTracks]
  );

  const isDownloaded = useCallback(
    (trackId: string) => downloadedIds.has(trackId),
    [downloadedIds]
  );

  const isDownloading = useCallback(
    (trackId: string) => trackId in downloadingProgress,
    [downloadingProgress]
  );

  const downloadTrack = useCallback(
    async (song: Song): Promise<boolean> => {
      if (downloadedIds.has(song.id) || song.id in downloadingProgress) {
        return true;
      }

      setDownloadingProgress((prev) => ({ ...prev, [song.id]: 0 }));

      try {
        const res = await fetch(getStreamUrl(song.id));
        if (!res.ok) {
          throw new Error(`Stream fetch failed (${res.status})`);
        }

        const contentType = res.headers.get('content-type') || 'audio/mp4';
        const contentLengthHeader = res.headers.get('content-length');
        const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

        let blob: Blob;
        if (res.body && total > 0) {
          const reader = res.body.getReader();
          const chunks: BlobPart[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              const pct = Math.min(99, Math.round((received / total) * 100));
              setDownloadingProgress((prev) => ({ ...prev, [song.id]: pct }));
            }
          }

          blob = new Blob(chunks, { type: contentType });
        } else {
          setDownloadingProgress((prev) => ({ ...prev, [song.id]: 50 }));
          blob = await res.blob();
        }

        // Best-effort cache artwork for offline display
        if (song.thumbnail && typeof window !== 'undefined' && 'caches' in window) {
          caches
            .open('frosh-offline-art')
            .then((cache) => cache.add(new Request(song.thumbnail, { mode: 'no-cors' })))
            .catch(() => {});
        }

        const summary = await saveOfflineTrack(song, blob, contentType);
        setDownloadedTracks((prev) => {
          const filtered = prev.filter((t) => t.id !== summary.id);
          return [summary, ...filtered];
        });

        setDownloadingProgress((prev) => {
          const copy = { ...prev };
          delete copy[song.id];
          return copy;
        });

        return true;
      } catch (err) {
        console.error('[Offline] Download failed for', song.title, err);
        setDownloadingProgress((prev) => {
          const copy = { ...prev };
          delete copy[song.id];
          return copy;
        });
        return false;
      }
    },
    [downloadedIds, downloadingProgress]
  );

  const downloadTracks = useCallback(
    async (songs: Song[]) => {
      for (const song of songs) {
        if (!downloadedIds.has(song.id)) {
          await downloadTrack(song);
        }
      }
    },
    [downloadedIds, downloadTrack]
  );

  const removeDownload = useCallback(async (trackId: string) => {
    await deleteOfflineTrack(trackId);
    setDownloadedTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const clearAllDownloads = useCallback(async () => {
    await clearAllOfflineTracks();
    setDownloadedTracks([]);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        downloadedTracks,
        downloadedIds,
        downloadingProgress,
        totalBytes,
        isOffline,
        isDownloaded,
        isDownloading,
        downloadTrack,
        downloadTracks,
        removeDownload,
        clearAllDownloads,
        refreshDownloads,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return ctx;
}
