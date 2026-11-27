'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  ListMusic,
  Heart,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';
import { fetchLyrics } from '@/lib/api';
import type { LyricsResponse } from '@/types/music';

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FullScreenPlayer() {
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    isFullScreen,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    toggleShuffle,
    cycleRepeat,
    removeFromQueue,
    setIsFullScreen,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  // Close with Escape key
  useEffect(() => {
    if (!isFullScreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullScreen, setIsFullScreen]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLyricsLoading(true);
    fetchLyrics(
      currentTrack.id,
      currentTrack.title,
      currentTrack.artists[0]?.name,
      currentTrack.duration
    )
      .then((data) => {
        if (!cancelled) setLyrics(data);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  // Compute current active lyric index
  const currentTimeMs = currentTime * 1000;
  let activeLyricIdx = -1;
  if (lyrics?.isSynced && lyrics.syncedLyrics) {
    for (let i = 0; i < lyrics.syncedLyrics.length; i++) {
      if (lyrics.syncedLyrics[i].time <= currentTimeMs + 250) {
        activeLyricIdx = i;
      } else {
        break;
      }
    }
  }

  // Auto-scroll active lyric line into view
  useEffect(() => {
    if (activeTab === 'lyrics' && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIdx, activeTab]);

  if (!isFullScreen || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
      {/* Blurred dynamic album backdrop */}
      {currentTrack.thumbnail && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-3xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-zinc-950/75 to-zinc-950 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          onClick={() => setIsFullScreen(false)}
          data-focusable="true"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2 bg-white/10 p-1 rounded-full">
          <button
            onClick={() => setActiveTab('lyrics')}
            data-focusable="true"
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'lyrics'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Lyrics
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            data-focusable="true"
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            Up Next ({queue.length})
          </button>
        </div>

        <div className="w-10" />
      </header>

      {/* Main Split Content */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 md:px-14 pb-8 min-h-0 items-center">
        {/* Left: Artwork & Controls */}
        <div className="flex flex-col items-center justify-center max-w-md mx-auto w-full">
          <div className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 mb-6">
            {currentTrack.thumbnail && (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="w-full flex items-center justify-between gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-zinc-400 truncate mt-0.5">
                {currentTrack.artists.map((a, i) => (
                  <span key={`${a.name}-${i}`}>
                    {i > 0 && ', '}
                    <Link
                      href={
                        a.id
                          ? `/artist/${encodeURIComponent(a.id)}`
                          : `/search?q=${encodeURIComponent(a.name)}&type=artist`
                      }
                      onClick={() => setIsFullScreen(false)}
                      className="hover:text-emerald-400 hover:underline transition-colors"
                    >
                      {a.name}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
            <button
              onClick={() => toggleLike(currentTrack)}
              data-focusable="true"
              className={`p-2 rounded-full transition-colors ${
                liked ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className={`w-6 h-6 ${liked ? 'fill-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Scrubber */}
          <div className="w-full mb-5">
            <div className="relative h-2 bg-white/15 rounded-full cursor-pointer">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full"
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
            <div className="flex justify-between text-xs text-zinc-400 mt-1.5 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between w-full max-w-xs">
            <button
              onClick={toggleShuffle}
              data-focusable="true"
              className={`p-2 transition-colors ${
                isShuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={prevTrack}
              data-focusable="true"
              className="p-2 text-white hover:scale-110 transition-transform"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              data-focusable="true"
              className="w-16 h-16 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
            >
              {isLoading ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              data-focusable="true"
              className="p-2 text-white hover:scale-110 transition-transform"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              data-focusable="true"
              className={`p-2 transition-colors ${
                repeatMode !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Right: Synced Lyrics or Queue */}
        <div className="h-full max-h-[65vh] lg:max-h-[75vh] overflow-y-auto px-2 sm:px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10">
          {activeTab === 'lyrics' ? (
            lyricsLoading ? (
              <div className="h-full flex items-center justify-center text-zinc-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Loading synced lyrics...</span>
              </div>
            ) : lyrics?.isSynced && lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0 ? (
              <div className="space-y-4 py-8">
                {lyrics.syncedLyrics.map((line, i) => {
                  const isCurrent = i === activeLyricIdx;
                  return (
                    <button
                      key={`${line.time}-${i}`}
                      ref={isCurrent ? activeLineRef : null}
                      onClick={() => seek(line.time / 1000)}
                      className={`block w-full text-left text-xl md:text-2xl font-bold transition-all duration-300 cursor-pointer ${
                        isCurrent
                          ? 'text-white scale-[1.02] origin-left'
                          : i < activeLyricIdx
                          ? 'text-zinc-500 hover:text-zinc-300'
                          : 'text-zinc-400/70 hover:text-zinc-200'
                      }`}
                    >
                      {line.text || '♪'}
                    </button>
                  );
                })}
              </div>
            ) : lyrics?.plainLyrics ? (
              <pre className="whitespace-pre-wrap font-sans text-lg text-zinc-300 leading-relaxed py-4">
                {lyrics.plainLyrics}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <Mic2 className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-base font-medium text-zinc-300">No lyrics available</p>
                <p className="text-xs mt-1">Instrumental or lyrics not yet indexed.</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {queue.map((item, idx) => {
                const isCurrent = idx === queueIndex;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => playTrack(item, queue)}
                    data-focusable="true"
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-emerald-500/15 border border-emerald-500/30'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isCurrent ? 'text-emerald-400' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          {item.artists.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
