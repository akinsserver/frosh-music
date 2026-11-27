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
  const scrollPanelRef = useRef<HTMLDivElement | null>(null);

  // Touch swipe-down-to-minimize state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{
    y: number;
    x: number;
    time: number;
    canDrag: boolean;
  } | null>(null);

  // Reset drag state when opened/closed
  useEffect(() => {
    if (!isFullScreen) {
      setDragOffsetY(0);
      setIsDragging(false);
      touchStartRef.current = null;
    }
  }, [isFullScreen]);

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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement;
    // Never hijack scrubber slider drags
    if (target.tagName === 'INPUT') return;

    const touch = e.touches[0];
    const insideScrollPanel = scrollPanelRef.current?.contains(target) ?? false;
    const isAtTop = !insideScrollPanel || (scrollPanelRef.current?.scrollTop ?? 0) <= 2;

    touchStartRef.current = {
      y: touch.clientY,
      x: touch.clientX,
      time: Date.now(),
      canDrag: isAtTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || !start.canDrag || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;

    // Only capture downward swipes
    if (deltaY > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
      setIsDragging(true);
      setDragOffsetY(deltaY);
    } else if (deltaY <= 0 && isDragging) {
      setDragOffsetY(0);
    }
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    if (start && isDragging) {
      const elapsed = Math.max(1, Date.now() - start.time);
      const velocity = dragOffsetY / elapsed; // px per ms
      if (dragOffsetY > 90 || (dragOffsetY > 40 && velocity > 0.45)) {
        setIsFullScreen(false);
        setDragOffsetY(0);
        setIsDragging(false);
        touchStartRef.current = null;
        return;
      }
    }
    setDragOffsetY(0);
    setIsDragging(false);
    touchStartRef.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
        opacity: dragOffsetY > 0 ? Math.max(0.4, 1 - dragOffsetY / 500) : 1,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
        borderRadius: dragOffsetY > 0 ? '24px' : undefined,
      }}
      className="fixed inset-0 z-50 h-[100dvh] bg-zinc-950 flex flex-col overflow-hidden overscroll-contain touch-pan-y select-none"
    >
      {/* Blurred dynamic album backdrop */}
      {currentTrack.thumbnail && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-3xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-zinc-950/75 to-zinc-950 pointer-events-none" />

      {/* Pinned Mobile-Friendly Top Header with Drag Handle */}
      <header className="relative z-10 shrink-0 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex flex-col gap-2">
        {/* Visual drag handle pill for touchscreen */}
        <div
          onClick={() => setIsFullScreen(false)}
          className="w-12 h-1.5 rounded-full bg-white/30 mx-auto cursor-pointer lg:hidden"
          title="Swipe down or tap to minimize"
        />

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setIsFullScreen(false)}
            data-focusable="true"
            aria-label="Minimize player"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all shrink-0"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-full">
            <button
              onClick={() => setActiveTab('lyrics')}
              data-focusable="true"
              className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
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
              className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'queue'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Up Next ({queue.length})
            </button>
          </div>

          <div className="w-11 shrink-0" />
        </div>
      </header>

      {/* Main Responsive Flex/Split Content */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-8 px-5 sm:px-8 md:px-14 pb-[max(1rem,env(safe-area-inset-bottom))] lg:items-center">
        {/* Left / Top: Artwork & Controls */}
        <div className="shrink-0 flex flex-col items-center justify-center max-w-md mx-auto w-full pt-1">
          <div className="w-40 h-40 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-96 lg:h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 mb-3 sm:mb-5">
            {currentTrack.thumbnail && (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="w-full flex items-center justify-between gap-3 mb-2.5 sm:mb-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">
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
              className={`p-2 rounded-full transition-colors shrink-0 ${
                liked ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className={`w-6 h-6 ${liked ? 'fill-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Scrubber */}
          <div className="w-full mb-3 sm:mb-5">
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
            <div className="flex justify-between text-[11px] sm:text-xs text-zinc-400 mt-1 tabular-nums">
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
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              data-focusable="true"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              data-focusable="true"
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
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

        {/* Right / Bottom: Flex-1 Scrollable Synced Lyrics or Queue */}
        <div
          ref={scrollPanelRef}
          className="flex-1 min-h-[140px] lg:h-full lg:max-h-[75vh] overflow-y-auto px-4 sm:px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10"
        >
          {activeTab === 'lyrics' ? (
            lyricsLoading ? (
              <div className="h-full flex items-center justify-center text-zinc-400 gap-2 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-sm">Loading synced lyrics...</span>
              </div>
            ) : lyrics?.isSynced && lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0 ? (
              <div className="space-y-3.5 py-4 sm:py-8">
                {lyrics.syncedLyrics.map((line, i) => {
                  const isCurrent = i === activeLyricIdx;
                  return (
                    <button
                      key={`${line.time}-${i}`}
                      ref={isCurrent ? activeLineRef : null}
                      onClick={() => seek(line.time / 1000)}
                      className={`block w-full text-left text-base sm:text-xl md:text-2xl font-bold transition-all duration-300 cursor-pointer ${
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
              <pre className="whitespace-pre-wrap font-sans text-sm sm:text-lg text-zinc-300 leading-relaxed py-3">
                {lyrics.plainLyrics}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <Mic2 className="w-8 h-8 sm:w-10 sm:h-10 mb-2.5 opacity-40" />
                <p className="text-sm sm:text-base font-medium text-zinc-300">No lyrics available</p>
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
