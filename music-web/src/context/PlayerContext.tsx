'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type { Song } from '@/types/music';
import { getStreamUrl } from '@/lib/api';
import { getOfflineAudioUrl } from '@/lib/offlineStorage';
import { useLibrary } from './LibraryContext';
import { useOffline } from './OfflineContext';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextValue {
  currentTrack: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isFullScreen: boolean;
  showLyrics: boolean;
  showQueue: boolean;
  error: string | null;
  playTrack: (track: Song, newQueue?: Song[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Song) => void;
  playNext: (track: Song) => void;
  removeFromQueue: (index: number) => void;
  setIsFullScreen: (open: boolean) => void;
  setShowLyrics: (open: boolean) => void;
  setShowQueue: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const { recordPlay } = useLibrary();
  const { isDownloaded } = useOffline();

  const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for latest state inside audio event listeners
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const isShuffleRef = useRef(isShuffle);
  const repeatModeRef = useRef(repeatMode);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const startAudioPlayback = useCallback((audio: HTMLAudioElement, url: string) => {
    if (audio.src !== url) {
      audio.src = url;
    }
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError') {
          setIsPlaying(false);
        } else if (err.name !== 'AbortError') {
          console.error('[Player] Playback failed:', err);
          setError('Could not start playback. Check if music-server is running.');
          setIsPlaying(false);
        }
        setIsLoading(false);
      });
  }, []);

  const loadAndPlay = useCallback(
    (track: Song) => {
      const audio = audioRef.current;
      if (!audio) return;

      setError(null);
      setIsLoading(true);
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      recordPlay(track);

      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
        activeObjectUrlRef.current = null;
      }

      // Synchronous path for online streams so iOS Safari preserves user-gesture activation
      if (!isDownloaded(track.id)) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setError('You are offline and this track is not downloaded.');
          setIsPlaying(false);
          setIsLoading(false);
          return;
        }
        startAudioPlayback(audio, getStreamUrl(track.id));
        return;
      }

      // Offline downloaded track path
      getOfflineAudioUrl(track.id).then((offlineUrl) => {
        if (offlineUrl) {
          activeObjectUrlRef.current = offlineUrl;
          startAudioPlayback(audio, offlineUrl);
        } else {
          startAudioPlayback(audio, getStreamUrl(track.id));
        }
      });
    },
    [recordPlay, isDownloaded, startAudioPlayback]
  );

  const playTrack = useCallback(
    (track: Song, newQueue?: Song[]) => {
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.id === track.id);
        setQueueIndex(idx >= 0 ? idx : 0);
      } else {
        setQueue((prev) => {
          const existingIdx = prev.findIndex((t) => t.id === track.id);
          if (existingIdx >= 0) {
            setQueueIndex(existingIdx);
            return prev;
          }
          const updated = [track, ...prev];
          setQueueIndex(0);
          return updated;
        });
      }
      loadAndPlay(track);
    },
    [loadAndPlay]
  );

  const nextTrack = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;

    if (repeatModeRef.current === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }

    let nextIdx: number;
    if (isShuffleRef.current && q.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * q.length);
      } while (nextIdx === idx);
    } else {
      nextIdx = idx + 1;
      if (nextIdx >= q.length) {
        if (repeatModeRef.current === 'all') {
          nextIdx = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }

    setQueueIndex(nextIdx);
    loadAndPlay(q[nextIdx]);
  }, [loadAndPlay]);

  const prevTrack = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;

    const prevIdx = idx - 1 < 0 ? q.length - 1 : idx - 1;
    setQueueIndex(prevIdx);
    loadAndPlay(q[prevIdx]);
  }, [loadAndPlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('[Player] Play error:', err));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(time, audio.duration || time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = clamped === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffle((p) => !p), []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const addToQueue = useCallback((track: Song) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const playNext = useCallback((track: Song) => {
    setQueue((prev) => {
      const copy = [...prev];
      const insertAt = Math.max(0, queueIndexRef.current + 1);
      copy.splice(insertAt, 0, track);
      return copy;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setQueueIndex((prevIdx) => (index < prevIdx ? prevIdx - 1 : prevIdx));
  }, []);

  // Attach listeners to DOM-mounted <audio> element once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.85;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => nextTrack();
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      const mediaErr = audio.error;
      if (mediaErr?.code === 1) return; // Ignore benign track-switch aborts
      if (audio.src) {
        const detail = mediaErr?.message || (mediaErr?.code ? `code ${mediaErr.code}` : '');
        console.error('[Player] Media error:', mediaErr?.code, mediaErr?.message, audio.src);
        setError(detail ? `Stream unavailable (${detail}).` : 'Stream interrupted or unavailable.');
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [nextTrack]);

  // Native MediaSession API for OS lock-screen, Bluetooth, & Fire TV remotes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artists.map((a) => a.name).join(', '),
      album: currentTrack.album?.name || 'Frosh Music',
      artwork: currentTrack.thumbnail
        ? [
            { src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      const audio = audioRef.current;
      if (audio) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setIsPlaying(false);
      }
    });
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const audio = audioRef.current;
      if (audio) seek(Math.max(0, audio.currentTime - (details.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const audio = audioRef.current;
      if (audio) seek(Math.min(audio.duration || 0, audio.currentTime + (details.seekOffset || 10)));
    });
  }, [currentTrack, nextTrack, prevTrack, seek]);

  // Keep OS Lock Screen playback state & scrubber synchronized (essential for iOS background audio)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function' ||
      !currentTrack ||
      !duration ||
      duration <= 0
    ) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.max(0, Math.min(currentTime, duration)),
      });
    } catch {
      // Ignore transient duration/position mismatches
    }
  }, [currentTrack, currentTime, duration]);

  // Global keyboard shortcuts (Desktop + Media Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' && !target.closest('[data-focusable="true"]')) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        nextTrack();
      } else if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        prevTrack();
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        setIsFullScreen((p) => !p);
      } else if (e.key.toLowerCase() === 'l') {
        setShowLyrics((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextTrack, prevTrack, toggleMute]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        isFullScreen,
        showLyrics,
        showQueue,
        error,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        addToQueue,
        playNext,
        removeFromQueue,
        setIsFullScreen,
        setShowLyrics,
        setShowQueue,
      }}
    >
      <audio ref={audioRef} preload="auto" playsInline className="hidden" />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
