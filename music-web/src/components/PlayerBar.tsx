'use client';

import React from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Mic2,
  ListMusic,
  Maximize2,
  Heart,
  Loader2,
  Cast,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    showLyrics,
    showQueue,
    error,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setIsFullScreen,
    setShowLyrics,
    setShowQueue,
    castAudio,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();

  if (!currentTrack) {
    return (
      <footer className="hidden md:flex items-center justify-between h-20 px-6 bg-zinc-950/95 border-t border-white/10 text-zinc-500 text-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-zinc-900 border border-white/5" />
          <span>Select a track to start streaming</span>
        </div>
        <div className="text-xs text-zinc-600">
          Space: Play/Pause · F: Fullscreen · L: Lyrics
        </div>
      </footer>
    );
  }

  const liked = isLiked(currentTrack.id);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <footer className="fixed bottom-14 md:static left-0 right-0 z-30 h-16 md:h-22 px-3 md:px-6 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-between gap-4 shrink-0">
      {/* Left: Track Info */}
      <div className="flex items-center gap-3 min-w-0 w-1/2 md:w-1/4">
        <button
          onClick={() => setIsFullScreen(true)}
          data-focusable="true"
          className="relative w-11 h-11 md:w-13 md:h-13 rounded-lg overflow-hidden bg-zinc-800 shrink-0 group cursor-pointer"
        >
          {currentTrack.thumbnail && (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </button>

        <div
          onClick={() => setIsFullScreen(true)}
          className="min-w-0 cursor-pointer flex-1"
        >
          <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : (
              currentTrack.artists.map((a, i) => (
                <span key={`${a.name}-${i}`}>
                  {i > 0 && ', '}
                  <Link
                    href={
                      a.id
                        ? `/artist/${encodeURIComponent(a.id)}`
                        : `/search?q=${encodeURIComponent(a.name)}&type=artist`
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-emerald-400 hover:underline transition-colors"
                  >
                    {a.name}
                  </Link>
                </span>
              ))
            )}
          </p>
        </div>

        <button
          onClick={() => toggleLike(currentTrack)}
          data-focusable="true"
          className={`hidden sm:block p-1.5 rounded-lg transition-colors ${
            liked ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Center: Playback Controls & Scrubber */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
        <div className="flex items-center gap-4 md:gap-5">
          <button
            onClick={toggleShuffle}
            data-focusable="true"
            title="Shuffle"
            className={`hidden md:block p-1 rounded transition-colors ${
              isShuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={prevTrack}
            data-focusable="true"
            title="Previous"
            className="hidden sm:block p-1 text-zinc-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            data-focusable="true"
            title={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            data-focusable="true"
            title="Next"
            className="p-1 text-zinc-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={cycleRepeat}
            data-focusable="true"
            title={`Repeat: ${repeatMode}`}
            className={`hidden md:block p-1 rounded transition-colors ${
              repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Desktop Scrubber */}
        <div className="hidden md:flex items-center gap-2.5 w-full">
          <span className="text-[11px] text-zinc-400 tabular-nums w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 h-1.5 bg-zinc-800 rounded-full group cursor-pointer">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full pointer-events-none"
              style={{ width: `${progressPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[11px] text-zinc-400 tabular-nums w-9">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Lyrics, Queue, Volume, Fullscreen */}
      <div className="hidden md:flex items-center justify-end gap-2.5 w-1/4">
        <button
          onClick={() => {
            setShowLyrics(!showLyrics);
            setIsFullScreen(true);
          }}
          data-focusable="true"
          title="Synced Lyrics (L)"
          className={`p-2 rounded-lg transition-colors ${
            showLyrics ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Mic2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setShowQueue(!showQueue);
            setIsFullScreen(true);
          }}
          data-focusable="true"
          title="Queue"
          className={`p-2 rounded-lg transition-colors ${
            showQueue ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ListMusic className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={toggleMute}
            data-focusable="true"
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-emerald-400 cursor-pointer"
          />
        </div>

        <button
          onClick={castAudio}
          data-focusable="true"
          title="Cast or AirPlay to TV / Speaker"
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Cast className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsFullScreen(true)}
          data-focusable="true"
          title="Full-Screen Player (F)"
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
}
