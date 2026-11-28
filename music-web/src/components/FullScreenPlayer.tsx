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
  Maximize2,
  Minimize2,
  Languages,
  Check,
  Cast,
  GripVertical,
  Subtitles,
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';
import { fetchLyrics } from '@/lib/api';
import { getArtistOrPodcastHref } from '@/lib/recommendations';
import type { LyricsResponse } from '@/types/music';

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TRANSLATION_LANGUAGES = [
  { code: 'off', label: 'Off' },
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba (Èdè Yorùbá)' },
  { code: 'ig', label: 'Igbo (Asụsụ Igbo)' },
  { code: 'sw', label: 'Swahili (Kiswahili)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'id', label: 'Indonesian (Bahasa)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh-CN', label: 'Chinese (中文)' },
] as const;

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
    reorderQueue,
    setIsFullScreen,
    castAudio,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const queueRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragOriginRef = useRef<{ y: number; active: boolean } | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('off');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedLines, setTranslatedLines] = useState<string[] | null>(null);

  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const scrollPanelRef = useRef<HTMLDivElement | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  const isPodcast = Boolean(
    currentTrack?.artists?.some((a) => a.id?.startsWith('MPSP')) ||
    (currentTrack?.duration && currentTrack.duration > 1200) ||
    /\b(podcast|episode|ep\.\s*\d+)\b/i.test(currentTrack?.title || '')
  );

  const hasLyricsOrCaptions = Boolean(
    lyrics &&
    lyrics.source !== 'none' &&
    (lyrics.plainLyrics || (lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0))
  );

  // If playing a podcast and no captions are available once loading finishes, dismiss the lyrics tab
  useEffect(() => {
    if (isPodcast && !lyricsLoading && !hasLyricsOrCaptions && activeTab === 'lyrics') {
      setActiveTab('queue');
    }
  }, [isPodcast, lyricsLoading, hasLyricsOrCaptions, activeTab]);

  // Close language menu on click outside
  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLangMenuOpen]);

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

  // Reset expanded state and line cache on track change
  useEffect(() => {
    setTranslatedLines(null);
    setIsLyricsExpanded(false);
    setIsLangMenuOpen(false);
  }, [currentTrack?.id]);

  // Fetch translation when selected language or lyrics change
  // For long podcasts (hundreds/thousands of lines), translate a rolling window around current playback first!
  useEffect(() => {
    if (selectedLanguage === 'off') {
      setTranslatedLines(null);
      setTranslating(false);
      return;
    }

    if (!lyrics) return;

    let allLines: string[] = [];
    if (lyrics.isSynced && lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0) {
      allLines = lyrics.syncedLyrics.map((l) => l.text || '');
    } else if (lyrics.plainLyrics) {
      allLines = lyrics.plainLyrics.split('\n');
    }

    if (allLines.length === 0) return;

    let cancelled = false;
    const WINDOW_SIZE = 100;

    // Fast path for normal songs (< 120 lines): translate all at once
    if (allLines.length <= 120) {
      setTranslating(true);
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: allLines,
          targetLang: selectedLanguage,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Translation failed');
          return res.json();
        })
        .then((data) => {
          if (!cancelled && data.translated) {
            setTranslatedLines(data.translated);
          }
        })
        .catch((err) => {
          console.warn('Lyrics translation error:', err);
        })
        .finally(() => {
          if (!cancelled) setTranslating(false);
        });

      return () => {
        cancelled = true;
      };
    }

    // Long podcast captions: translate in 100-line windows starting near current playback
    const approxIdx =
      lyrics.isSynced && lyrics.syncedLyrics
        ? Math.max(
            0,
            lyrics.syncedLyrics.findIndex((l) => l.time >= currentTime * 1000)
          )
        : 0;
    const startIdx = Math.max(0, approxIdx - 10);
    const endIdx = Math.min(allLines.length, startIdx + WINDOW_SIZE);
    const windowLines = allLines.slice(startIdx, endIdx);

    setTranslating(true);
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lines: windowLines,
        targetLang: selectedLanguage,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Translation failed');
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.translated)) {
          setTranslatedLines((prev) => {
            const next = prev && prev.length === allLines.length ? [...prev] : new Array(allLines.length).fill('');
            for (let i = 0; i < data.translated.length; i++) {
              next[startIdx + i] = data.translated[i];
            }
            return next;
          });
        }
      })
      .catch((err) => {
        console.warn('Podcast caption translation error:', err);
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLanguage, lyrics]);

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
            {(!isPodcast || hasLyricsOrCaptions || lyricsLoading) && (
              <button
                onClick={() => setActiveTab('lyrics')}
                data-focusable="true"
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'lyrics'
                    ? 'bg-white text-zinc-950'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {isPodcast ? <Subtitles className="w-3.5 h-3.5" /> : <Mic2 className="w-3.5 h-3.5" />}
                {isPodcast ? 'Captions' : 'Lyrics'}
              </button>
            )}
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

          <button
            onClick={castAudio}
            data-focusable="true"
            aria-label="Cast or AirPlay to TV / Speaker"
            title="Cast or AirPlay to TV / Speaker"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all shrink-0"
          >
            <Cast className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Responsive Flex/Split Content */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-2 gap-3 lg:gap-8 px-4 sm:px-8 md:px-14 pb-[max(1rem,env(safe-area-inset-bottom))] lg:items-center">
        {/* Left / Top: Artwork & Controls (Hidden on mobile when lyrics expanded) */}
        <div
          className={`shrink-0 flex flex-col items-center justify-center max-w-md mx-auto w-full pt-1 ${
            activeTab === 'lyrics' && isLyricsExpanded ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="w-36 h-36 sm:w-60 sm:h-60 md:w-72 md:h-72 lg:w-96 lg:h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900 mb-2.5 sm:mb-4">
            {currentTrack.thumbnail && (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="w-full flex items-center justify-between gap-3 mb-2 sm:mb-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 truncate mt-0.5">
                {currentTrack.artists.map((a, i) => (
                  <span key={`${a.name}-${i}`}>
                    {i > 0 && ', '}
                    <Link
                      href={getArtistOrPodcastHref(a)}
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
              <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${liked ? 'fill-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Scrubber */}
          <div className="w-full mb-2 sm:mb-4">
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
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
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

          {/* Spotify-Style Collapsed Lyrics/Captions Preview Card (Mobile Only) */}
          {activeTab === 'lyrics' && !isLyricsExpanded && (!isPodcast || hasLyricsOrCaptions) && (
            <div
              onClick={() => setIsLyricsExpanded(true)}
              data-focusable="true"
              className="w-full max-w-md mx-auto mt-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] active:bg-white/[0.12] border border-white/10 p-3 sm:p-3.5 cursor-pointer transition-all flex flex-col justify-between shrink-0 shadow-lg relative lg:hidden"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  {isPodcast ? (
                    <Subtitles className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Mic2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isPodcast ? 'Captions' : 'Lyrics'}</span>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* Translate dropdown button */}
                  <div className="relative">
                    <button
                      onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                      data-focusable="true"
                      title={isPodcast ? "Translate captions" : "Translate lyrics"}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                        selectedLanguage !== 'off'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/10 border-white/10 hover:bg-white/20 text-zinc-300'
                      }`}
                    >
                      {translating ? (
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                      ) : (
                        <Languages className="w-3 h-3" />
                      )}
                      <span>
                        {selectedLanguage === 'off'
                          ? 'Translate'
                          : TRANSLATION_LANGUAGES.find((l) => l.code === selectedLanguage)?.code.toUpperCase()}
                      </span>
                    </button>
                    {isLangMenuOpen && (
                      <div
                        ref={langMenuRef}
                        className="absolute right-0 bottom-full mb-2 w-52 max-h-60 overflow-y-auto rounded-xl bg-zinc-900 border border-white/20 shadow-2xl py-1 z-50 backdrop-blur-xl"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/10">
                          Translate {isPodcast ? 'captions' : 'lyrics'} to
                        </div>
                        {TRANSLATION_LANGUAGES.map((lang) => {
                          const isSelected = selectedLanguage === lang.code;
                          return (
                            <button
                              key={lang.code}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLanguage(lang.code);
                                setIsLangMenuOpen(false);
                              }}
                              data-focusable="true"
                              className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                  : 'text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              <span>{lang.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Expand button */}
                  <button
                    onClick={() => setIsLyricsExpanded(true)}
                    data-focusable="true"
                    title="Expand lyrics"
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Lyrics Preview Line */}
              <div className="min-h-[42px] flex flex-col justify-center">
                {lyricsLoading ? (
                  <div className="flex items-center gap-2 text-zinc-400 text-xs py-1">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Loading lyrics...</span>
                  </div>
                ) : activeLyricIdx >= 0 && lyrics?.syncedLyrics?.[activeLyricIdx] ? (
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                      {lyrics.syncedLyrics[activeLyricIdx].text || '♪'}
                    </p>
                    {selectedLanguage !== 'off' && translatedLines && translatedLines[activeLyricIdx] && (
                      <p className="text-[11px] sm:text-xs font-medium text-emerald-400 italic line-clamp-1 mt-0.5">
                        {translatedLines[activeLyricIdx]}
                      </p>
                    )}
                    {lyrics.syncedLyrics[activeLyricIdx + 1] && (
                      <p className="text-[11px] text-zinc-400/70 line-clamp-1 mt-0.5">
                        {lyrics.syncedLyrics[activeLyricIdx + 1].text}
                      </p>
                    )}
                  </div>
                ) : lyrics?.plainLyrics ? (
                  <div>
                    <p className="text-xs text-zinc-300 line-clamp-2">
                      {lyrics.plainLyrics.split('\n').filter(Boolean).slice(0, 2).join(' ')}
                    </p>
                    {selectedLanguage !== 'off' && translatedLines && translatedLines[0] && (
                      <p className="text-[11px] text-emerald-400 italic line-clamp-1 mt-0.5">
                        {translatedLines[0]}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">No lyrics available</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Sticky Now-Playing Pill when Lyrics Expanded */}
        {activeTab === 'lyrics' && isLyricsExpanded && (
          <div className="shrink-0 max-w-md w-full mx-auto mb-2 flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-2.5 lg:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{currentTrack.title}</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {currentTrack.artists.map((a) => a.name).join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => toggleLike(currentTrack)}
                data-focusable="true"
                className={`p-1.5 rounded-full transition-colors ${
                  liked ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
              </button>
              <button
                onClick={togglePlay}
                data-focusable="true"
                className="p-2 rounded-full bg-white text-zinc-950 hover:scale-105 active:scale-95 shadow"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Right / Bottom: Full Scrollable Synced Lyrics or Queue */}
        <div
          ref={scrollPanelRef}
          className={`flex-1 min-h-[140px] lg:h-full lg:max-h-[75vh] overflow-y-auto px-4 sm:px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col ${
            activeTab === 'lyrics' && !isLyricsExpanded ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeTab === 'lyrics' ? (
            <>
              {/* Sticky Lyrics/Captions Toolbar */}
              <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-4 px-4 sm:px-6 py-2.5 bg-zinc-950/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {isPodcast ? (
                    <Subtitles className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Mic2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isPodcast ? 'Captions' : 'Lyrics'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Translate dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                      data-focusable="true"
                      title={isPodcast ? "Translate captions" : "Translate lyrics"}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedLanguage !== 'off'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/10 border-white/10 hover:bg-white/20 text-zinc-300'
                      }`}
                    >
                      {translating ? (
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                      ) : (
                        <Languages className="w-3 h-3" />
                      )}
                      <span>
                        {selectedLanguage === 'off'
                          ? 'Translate'
                          : TRANSLATION_LANGUAGES.find((l) => l.code === selectedLanguage)?.code.toUpperCase()}
                      </span>
                    </button>
                    {isLangMenuOpen && (
                      <div
                        ref={langMenuRef}
                        className="absolute right-0 top-full mt-2 w-52 max-h-60 overflow-y-auto rounded-xl bg-zinc-900 border border-white/20 shadow-2xl py-1 z-50 backdrop-blur-xl"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/10">
                          Translate {isPodcast ? 'captions' : 'lyrics'} to
                        </div>
                        {TRANSLATION_LANGUAGES.map((lang) => {
                          const isSelected = selectedLanguage === lang.code;
                          return (
                            <button
                              key={lang.code}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLanguage(lang.code);
                                setIsLangMenuOpen(false);
                              }}
                              data-focusable="true"
                              className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                  : 'text-zinc-300 hover:bg-white/10'
                              }`}
                            >
                              <span>{lang.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Collapse / Expand Toggle */}
                  <button
                    onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
                    data-focusable="true"
                    title={isLyricsExpanded ? 'Collapse lyrics' : 'Expand lyrics'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                  >
                    {isLyricsExpanded ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Collapse</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Expand</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {lyricsLoading ? (
                <div className="h-full flex items-center justify-center text-zinc-400 gap-2 py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span className="text-sm">
                    {isPodcast ? 'Loading synced captions...' : 'Loading synced lyrics...'}
                  </span>
                </div>
              ) : lyrics?.isSynced && lyrics.syncedLyrics && lyrics.syncedLyrics.length > 0 ? (
                <div className="space-y-4 py-4 sm:py-6">
                  {lyrics.syncedLyrics.map((line, i) => {
                    const isCurrent = i === activeLyricIdx;
                    return (
                      <button
                        key={`${line.time}-${i}`}
                        ref={isCurrent ? activeLineRef : null}
                        onClick={() => seek(line.time / 1000)}
                        data-focusable="true"
                        className={`block w-full text-left py-1.5 px-2 rounded-xl transition-all duration-300 cursor-pointer ${
                          isCurrent
                            ? 'text-white scale-[1.01] origin-left bg-white/[0.04]'
                            : i < activeLyricIdx
                            ? 'text-zinc-500 hover:text-zinc-300'
                            : 'text-zinc-400/70 hover:text-zinc-200'
                        }`}
                      >
                        <span className="block text-base sm:text-xl md:text-2xl font-bold leading-snug">
                          {line.text || '♪'}
                        </span>
                        {selectedLanguage !== 'off' && translatedLines && translatedLines[i] && (
                          <span
                            className={`block text-xs sm:text-sm tracking-wide mt-1 transition-colors ${
                              isCurrent
                                ? 'text-emerald-400 font-semibold'
                                : 'text-emerald-400/60 italic'
                            }`}
                          >
                            {translatedLines[i]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : lyrics?.plainLyrics ? (
                <div className="py-4 space-y-3">
                  {lyrics.plainLyrics.split('\n').map((plainLine, i) => (
                    <div key={i} className="leading-relaxed">
                      <p className="text-sm sm:text-base text-zinc-200 font-medium">
                        {plainLine || '\u00A0'}
                      </p>
                      {selectedLanguage !== 'off' && translatedLines && translatedLines[i] && (
                        <p className="text-xs sm:text-sm text-emerald-400/80 italic mt-0.5">
                          {translatedLines[i]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                  {isPodcast ? (
                    <Subtitles className="w-8 h-8 sm:w-10 sm:h-10 mb-2.5 opacity-40 text-emerald-400" />
                  ) : (
                    <Mic2 className="w-8 h-8 sm:w-10 sm:h-10 mb-2.5 opacity-40" />
                  )}
                  <p className="text-sm sm:text-base font-medium text-zinc-300">
                    {isPodcast ? 'No captions available' : 'No lyrics available'}
                  </p>
                  <p className="text-xs mt-1">
                    {isPodcast ? 'Closed captions could not be found for this episode.' : 'Instrumental or lyrics not yet indexed.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div
              className="space-y-2"
              onTouchMove={(e) => {
                if (draggedIdx !== null && e.touches[0]) {
                  e.preventDefault();
                  const y = e.touches[0].clientY;
                  for (let i = 0; i < queue.length; i++) {
                    const rect = queueRowRefs.current[i]?.getBoundingClientRect();
                    if (rect && y >= rect.top && y <= rect.bottom) {
                      if (dragOverIdx !== i) setDragOverIdx(i);
                      break;
                    }
                  }
                } else if (touchDragOriginRef.current && !touchDragOriginRef.current.active && e.touches[0]) {
                  if (Math.abs(e.touches[0].clientY - touchDragOriginRef.current.y) > 8) {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }
                }
              }}
              onTouchEnd={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
                if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
                  reorderQueue(draggedIdx, dragOverIdx);
                }
                touchDragOriginRef.current = null;
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onTouchCancel={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
                touchDragOriginRef.current = null;
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
            >
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/10 text-xs text-zinc-400">
                <span>Drag handle or hold briefly to reorder</span>
                <span>{queue.length} track{queue.length === 1 ? '' : 's'}</span>
              </div>
              {queue.map((item, idx) => {
                const isCurrent = idx === queueIndex;
                const isBeingDragged = draggedIdx === idx;
                const isTarget = dragOverIdx === idx;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    ref={(el) => {
                      queueRowRefs.current[idx] = el;
                    }}
                    draggable
                    onTouchStart={(e) => {
                      if (!e.touches[0]) return;
                      touchDragOriginRef.current = { y: e.touches[0].clientY, active: false };
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = setTimeout(() => {
                        if (touchDragOriginRef.current) touchDragOriginRef.current.active = true;
                        setDraggedIdx(idx);
                        setDragOverIdx(idx);
                      }, 150);
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedIdx(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from =
                        draggedIdx !== null
                          ? draggedIdx
                          : parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (!isNaN(from) && from !== idx) {
                        reorderQueue(from, idx);
                      }
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onClick={() => {
                      if (draggedIdx !== null) return;
                      playTrack(item, queue);
                    }}
                    data-focusable="true"
                    className={`group relative flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-all select-none ${
                      isTarget ? 'border-t-2 border-emerald-400 bg-emerald-500/10' : ''
                    } ${
                      isBeingDragged ? 'opacity-60 scale-[0.98] ring-2 ring-emerald-400/50' : ''
                    } ${
                      isCurrent
                        ? 'bg-emerald-500/15 border border-emerald-500/30'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Instant Touch & Mouse Drag Handle */}
                      <div
                        className="touch-none cursor-grab active:cursor-grabbing p-2 -ml-1 text-zinc-400 hover:text-white transition-colors"
                        title="Drag to sort"
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                          touchDragOriginRef.current = { y: e.touches[0]?.clientY || 0, active: true };
                          setDraggedIdx(idx);
                          setDragOverIdx(idx);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {item.title}
                          </p>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Now Playing
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {item.artists.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetIdx = queueIndex >= 0 ? queueIndex + 1 : 0;
                            reorderQueue(idx, targetIdx);
                          }}
                          className="opacity-0 group-hover:opacity-100 sm:opacity-70 sm:hover:opacity-100 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 transition-all border border-white/5"
                          title="Move to Next Playing"
                        >
                          Play Next
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(idx);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
