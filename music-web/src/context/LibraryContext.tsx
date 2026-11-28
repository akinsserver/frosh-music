'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Song, UserPlaylist, PlayHistoryEvent } from '@/types/music';

interface LibraryContextValue {
  likedSongs: Song[];
  playlists: UserPlaylist[];
  history: Song[];
  playEvents: PlayHistoryEvent[];
  isLiked: (songId: string) => boolean;
  toggleLike: (song: Song) => void;
  recordPlay: (song: Song, listenedSeconds?: number) => void;
  createPlaylist: (name: string, description?: string) => UserPlaylist;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, song: Song) => void;
  removeTrackFromPlaylist: (playlistId: string, songId: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

const STORAGE_KEYS = {
  LIKES: 'vyla_liked_songs',
  PLAYLISTS: 'vyla_user_playlists',
  HISTORY: 'vyla_play_history',
  PLAY_EVENTS: 'vyla_stream_history',
};

function mergeSongs(local: Song[], cloud: Song[]): Song[] {
  const map = new Map<string, Song>();
  for (const s of cloud) if (s && s.id) map.set(s.id, s);
  for (const s of local) if (s && s.id) map.set(s.id, s);
  return Array.from(map.values());
}

function mergePlaylists(local: UserPlaylist[], cloud: UserPlaylist[]): UserPlaylist[] {
  const map = new Map<string, UserPlaylist>();
  for (const p of cloud) if (p && p.id) map.set(p.id, p);
  for (const p of local) if (p && p.id) map.set(p.id, p);
  return Array.from(map.values());
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [playEvents, setPlayEvents] = useState<PlayHistoryEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCloudLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const likesRaw = localStorage.getItem(STORAGE_KEYS.LIKES);
      const playlistsRaw = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      const historyRaw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const eventsRaw = localStorage.getItem(STORAGE_KEYS.PLAY_EVENTS);

      if (likesRaw) setLikedSongs(JSON.parse(likesRaw));
      if (playlistsRaw) setPlaylists(JSON.parse(playlistsRaw));
      if (historyRaw) setHistory(JSON.parse(historyRaw));
      if (eventsRaw) {
        setPlayEvents(JSON.parse(eventsRaw));
      } else if (historyRaw) {
        // If user already had tracks played, seed their events
        const parsedHistory: Song[] = JSON.parse(historyRaw);
        if (parsedHistory.length > 0) {
          const now = Date.now();
          const seeded: PlayHistoryEvent[] = parsedHistory.flatMap((track, idx) => {
            // Distribute across past 7 days
            return Array.from({ length: Math.min(3, 4 - idx % 3) }).map((_, rIdx) => ({
              id: `seed-${idx}-${rIdx}-${Date.now()}`,
              trackId: track.id,
              title: track.title,
              artists: track.artists,
              album: track.album,
              thumbnail: track.thumbnail,
              duration: track.duration || 180,
              timestamp: now - ((idx * 8 + rIdx * 14) * 3600 * 1000),
              listenedSeconds: track.duration || 180,
            }));
          });
          setPlayEvents(seeded);
          localStorage.setItem(STORAGE_KEYS.PLAY_EVENTS, JSON.stringify(seeded));
        }
      }
    } catch (err) {
      console.warn('[Library] Failed to load from localStorage:', err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likedSongs));
    } catch {}
  }, [likedSongs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch {}
  }, [playlists, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {}
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PLAY_EVENTS, JSON.stringify(playEvents));
    } catch {}
  }, [playEvents, hydrated]);

  // Load and merge cloud library via Server BFF
  useEffect(() => {
    if (!hydrated) return;

    async function loadCloudLibrary() {
      try {
        const res = await fetch('/api/user/library');
        if (!res.ok) {
          isCloudLoadedRef.current = true;
          return;
        }
        const cloudLib = await res.json();
        setUserId('authenticated');

        if (cloudLib) {
          if (Array.isArray(cloudLib.likedSongs) && cloudLib.likedSongs.length > 0) {
            setLikedSongs((prev) => mergeSongs(prev, cloudLib.likedSongs as Song[]));
          }
          if (Array.isArray(cloudLib.playlists) && cloudLib.playlists.length > 0) {
            setPlaylists((prev) => mergePlaylists(prev, cloudLib.playlists as UserPlaylist[]));
          }
          if (Array.isArray(cloudLib.history) && cloudLib.history.length > 0) {
            setHistory((prev) => mergeSongs(prev, cloudLib.history as Song[]));
          }
        }
      } catch (err) {
        console.warn('[Library] Failed to load cloud library:', err);
      } finally {
        isCloudLoadedRef.current = true;
      }
    }

    loadCloudLibrary();
  }, [hydrated]);

  // Debounced background sync to Server BFF (/api/user/library)
  useEffect(() => {
    if (!hydrated || !userId || !isCloudLoadedRef.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/user/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            likedSongs,
            playlists,
            history: history.slice(0, 50),
          }),
        });
      } catch (err) {
        console.warn('[Library] Cloud sync failed:', err);
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [likedSongs, playlists, history, hydrated, userId]);

  const isLiked = useCallback(
    (songId: string) => likedSongs.some((s) => s.id === songId),
    [likedSongs]
  );

  const toggleLike = useCallback((song: Song) => {
    setLikedSongs((prev) => {
      const exists = prev.some((s) => s.id === song.id);
      if (exists) return prev.filter((s) => s.id !== song.id);
      return [song, ...prev];
    });
  }, []);

  const recordPlay = useCallback((song: Song, listenedSeconds?: number) => {
    const now = Date.now();

    // 1. Update recent history queue
    setHistory((prev) => {
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 50);
    });

    // 2. Append timestamped telemetry event for stream analytics
    const newEvent: PlayHistoryEvent = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      trackId: song.id,
      title: song.title,
      artists: song.artists,
      album: song.album,
      thumbnail: song.thumbnail,
      duration: song.duration || 180,
      timestamp: now,
      listenedSeconds: listenedSeconds || song.duration || 180,
    };

    setPlayEvents((prev) => [newEvent, ...prev].slice(0, 2000));
  }, []);

  const createPlaylist = useCallback((name: string, description?: string): UserPlaylist => {
    const newPlaylist: UserPlaylist = {
      id: `local-${Date.now()}`,
      name: name.trim() || 'Untitled Playlist',
      description: description?.trim(),
      createdAt: new Date().toISOString(),
      tracks: [],
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    return newPlaylist;
  }, []);

  const deletePlaylist = useCallback((playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, song: Song) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.tracks.some((t) => t.id === song.id)) return p;
        return { ...p, tracks: [...p.tracks, song] };
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        return { ...p, tracks: p.tracks.filter((t) => t.id !== songId) };
      })
    );
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        likedSongs,
        playlists,
        history,
        playEvents,
        isLiked,
        toggleLike,
        recordPlay,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
