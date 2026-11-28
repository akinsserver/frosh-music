'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Shuffle,
  Play,
  Share2,
  Calendar,
  Clock,
  Music2,
  Disc3,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  BarChart2,
  TrendingUp,
} from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { usePlayer } from '@/context/PlayerContext';
import { UserAvatarButton } from '@/components/UserAvatarButton';
import type { Song, PlayHistoryEvent } from '@/types/music';

type TimeRange =
  | '1-week'
  | '1-month'
  | '3-months'
  | '6-months'
  | '1-year'
  | 'lifetime'
  | string;

interface AggregatedTrack {
  trackId: string;
  title: string;
  artists: { id?: string; name: string }[];
  album?: { id?: string; name: string } | null;
  thumbnail: string;
  duration: number;
  playCount: number;
  totalSeconds: number;
  lastPlayed: number;
}

interface AggregatedArtist {
  id?: string;
  name: string;
  thumbnail?: string;
  playCount: number;
  totalSeconds: number;
}

interface AggregatedAlbum {
  id?: string;
  name: string;
  artistName: string;
  thumbnail?: string;
  playCount: number;
  totalSeconds: number;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StatisticsPage() {
  const { playEvents } = useLibrary();
  const { playTrack } = usePlayer();

  const [timeRange, setTimeRange] = useState<TimeRange>('1-week');
  const [continuous, setContinuous] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Dynamic years: only show years where user actually has listening data, max 3 years
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const eventYears = playEvents
      .map((e) => new Date(e.timestamp).getFullYear())
      .filter((y) => !isNaN(y) && y <= currentYear);

    const distinct = Array.from(new Set([currentYear, ...eventYears])).sort((a, b) => b - a);
    return distinct.slice(0, 3);
  }, [playEvents]);

  const tracksScrollRef = useRef<HTMLDivElement>(null);
  const albumsScrollRef = useRef<HTMLDivElement>(null);
  const artistsScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const distance = 400;
    ref.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  // ── Filter events by timeframe ──────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return playEvents.filter((event) => {
      const eventTime = event.timestamp;
      if (timeRange === '1-week') return eventTime >= now - 7 * 86400 * 1000;
      if (timeRange === '1-month') return eventTime >= now - 30 * 86400 * 1000;
      if (timeRange === '3-months') return eventTime >= now - 90 * 86400 * 1000;
      if (timeRange === '6-months') return eventTime >= now - 180 * 86400 * 1000;
      if (timeRange === '1-year') return eventTime >= now - 365 * 86400 * 1000;
      if (timeRange === 'lifetime') return true;

      // Calendar years
      const eventYear = new Date(eventTime).getFullYear().toString();
      return eventYear === timeRange;
    });
  }, [playEvents, timeRange]);

  // ── Aggregate Top Tracks ───────────────────────────────────────────────────
  const topTracks = useMemo(() => {
    const map = new Map<string, AggregatedTrack>();
    for (const ev of filteredEvents) {
      const existing = map.get(ev.trackId);
      const listened = ev.listenedSeconds || ev.duration || 180;
      if (existing) {
        existing.playCount += 1;
        existing.totalSeconds += listened;
        if (ev.timestamp > existing.lastPlayed) {
          existing.lastPlayed = ev.timestamp;
        }
      } else {
        map.set(ev.trackId, {
          trackId: ev.trackId,
          title: ev.title,
          artists: ev.artists,
          album: ev.album,
          thumbnail: ev.thumbnail,
          duration: ev.duration,
          playCount: 1,
          totalSeconds: listened,
          lastPlayed: ev.timestamp,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.playCount - a.playCount || b.totalSeconds - a.totalSeconds);
  }, [filteredEvents]);

  // ── Aggregate Top Artists ──────────────────────────────────────────────────
  const topArtists = useMemo(() => {
    const map = new Map<string, AggregatedArtist>();
    for (const ev of filteredEvents) {
      for (const artist of ev.artists) {
        const key = artist.id || artist.name.toLowerCase();
        const existing = map.get(key);
        const listened = ev.listenedSeconds || ev.duration || 180;
        if (existing) {
          existing.playCount += 1;
          existing.totalSeconds += listened;
          if (!existing.thumbnail && ev.thumbnail) existing.thumbnail = ev.thumbnail;
        } else {
          map.set(key, {
            id: artist.id,
            name: artist.name,
            thumbnail: ev.thumbnail,
            playCount: 1,
            totalSeconds: listened,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.playCount - a.playCount || b.totalSeconds - a.totalSeconds);
  }, [filteredEvents]);

  // ── Aggregate Top Albums ───────────────────────────────────────────────────
  const topAlbums = useMemo(() => {
    const map = new Map<string, AggregatedAlbum>();
    for (const ev of filteredEvents) {
      if (!ev.album || !ev.album.name) continue;
      const key = ev.album.id || ev.album.name.toLowerCase();
      const existing = map.get(key);
      const listened = ev.listenedSeconds || ev.duration || 180;
      if (existing) {
        existing.playCount += 1;
        existing.totalSeconds += listened;
        if (!existing.thumbnail && ev.thumbnail) existing.thumbnail = ev.thumbnail;
      } else {
        map.set(key, {
          id: ev.album.id,
          name: ev.album.name,
          artistName: ev.artists?.[0]?.name || 'Unknown Artist',
          thumbnail: ev.thumbnail,
          playCount: 1,
          totalSeconds: listened,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.playCount - a.playCount || b.totalSeconds - a.totalSeconds);
  }, [filteredEvents]);

  // ── Overall Summary Stats ──────────────────────────────────────────────────
  const totalPlays = filteredEvents.length;
  const totalListeningSeconds = useMemo(() => {
    return filteredEvents.reduce((acc, ev) => acc + (ev.listenedSeconds || ev.duration || 180), 0);
  }, [filteredEvents]);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case '1-week':
        return '1 week';
      case '1-month':
        return '1 month';
      case '3-months':
        return '3 months';
      case '6-months':
        return '6 months';
      case '1-year':
        return '1 year';
      case 'lifetime':
        return 'Lifetime';
      default:
        return timeRange;
    }
  }, [timeRange]);

  // ── Activity by Day of Week ────────────────────────────────────────────────
  const activityDays = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const ev of filteredEvents) {
      const dayIdx = new Date(ev.timestamp).getDay();
      counts[dayIdx] += 1;
    }
    const max = Math.max(...counts, 1);
    return days.map((day, idx) => ({
      day,
      count: counts[idx],
      pct: Math.round((counts[idx] / max) * 100),
    }));
  }, [filteredEvents]);

  // ── Shuffle Top Songs ──────────────────────────────────────────────────────
  const handleShuffleTop = () => {
    if (topTracks.length === 0) return;
    const songs: Song[] = topTracks.map((t) => ({
      id: t.trackId,
      title: t.title,
      artists: t.artists.length > 0 ? t.artists : [{ name: 'Unknown Artist' }],
      album: t.album,
      duration: t.duration,
      durationText: formatTime(t.duration),
      thumbnail: t.thumbnail,
      thumbnails: [],
    }));
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  const handleCopySummary = () => {
    const lines = [
      `🎵 My Frosh Music Stats (${timeRangeLabel})`,
      `🎧 ${totalPlays} plays · ${formatDuration(totalListeningSeconds)} listening time`,
      '',
      '🔥 Top Songs:',
      ...topTracks.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} - ${t.artists.map((a) => a.name).join(', ')} (${t.playCount} plays)`),
      '',
      '👑 Top Artists:',
      ...topArtists.slice(0, 5).map((a, i) => `${i + 1}. ${a.name} (${a.playCount} plays · ${formatDuration(a.totalSeconds)})`),
    ];
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-10 pb-24 relative max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Statistics
          </h1>
          <UserAvatarButton />
        </div>
        <p className="text-sm sm:text-base text-zinc-400">
          {timeRangeLabel}: <span className="text-zinc-200 font-semibold">{totalPlays} plays</span>,{' '}
          <span className="text-zinc-200 font-semibold">{formatDuration(totalListeningSeconds)}</span> of listening.
        </p>
      </div>

      {/* ── Shuffle Button (Matching User Screenshot 1) ──────────────────────── */}
      <div>
        <button
          onClick={handleShuffleTop}
          disabled={topTracks.length === 0}
          data-focusable="true"
          className="w-full py-3.5 px-6 rounded-full bg-[#9ed5ea] hover:bg-[#8cc7dc] active:bg-[#7cb7cb] text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
        >
          <Shuffle className="w-5 h-5 stroke-[2.5]" />
          Shuffle
        </button>
      </div>

      {/* ── Time Filter Pills (Matching User Screenshot 1) ──────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setContinuous((p) => !p)}
          data-focusable="true"
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 border ${
            continuous
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          Continuous ▾
        </button>

        {[
          { key: '1-week', label: '1 week' },
          { key: '1-month', label: '1 month' },
          { key: '3-months', label: '3 months' },
          { key: '6-months', label: '6 months' },
          { key: '1-year', label: '1 year' },
          { key: 'lifetime', label: 'Lifetime' },
          ...availableYears.map((y) => ({ key: String(y), label: String(y) })),
        ].map((pill) => (
          <button
            key={pill.key}
            onClick={() => setTimeRange(pill.key as TimeRange)}
            data-focusable="true"
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 border ${
              timeRange === pill.key
                ? 'bg-[#9ed5ea] text-zinc-950 border-[#9ed5ea] font-bold shadow-sm'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-white border-white/5 hover:border-white/10'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Tracks Carousel (Matching User Screenshot 1) ────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {topTracks.length} {topTracks.length === 1 ? 'track' : 'tracks'}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollContainer(tracksScrollRef, 'left')}
              data-focusable="true"
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollContainer(tracksScrollRef, 'right')}
              data-focusable="true"
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {topTracks.length > 0 ? (
          <div
            ref={tracksScrollRef}
            className="flex items-stretch gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
          >
            {topTracks.map((track, idx) => (
              <div
                key={track.trackId}
                onClick={() =>
                  playTrack(
                    {
                      id: track.trackId,
                      title: track.title,
                      artists: track.artists,
                      album: track.album,
                      duration: track.duration,
                      durationText: formatTime(track.duration),
                      thumbnail: track.thumbnail,
                      thumbnails: [],
                    },
                    topTracks.map((t) => ({
                      id: t.trackId,
                      title: t.title,
                      artists: t.artists,
                      album: t.album,
                      duration: t.duration,
                      durationText: formatTime(t.duration),
                      thumbnail: t.thumbnail,
                      thumbnails: [],
                    }))
                  )
                }
                data-focusable="true"
                className="group w-36 sm:w-44 shrink-0 p-2.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-2.5 shadow-md">
                  {track.thumbnail ? (
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {idx + 1}. {track.title}
                </p>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">
                  {track.playCount} {track.playCount === 1 ? 'time' : 'times'} · {formatTime(track.duration)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
            No track playback recorded in this period yet. Play songs to see your statistics!
          </div>
        )}
      </section>

      {/* ── Albums Section (Matching User Screenshot 1) ─────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {topAlbums.length} {topAlbums.length === 1 ? 'album' : 'albums'}
          </h2>
          {topAlbums.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollContainer(albumsScrollRef, 'left')}
                data-focusable="true"
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollContainer(albumsScrollRef, 'right')}
                data-focusable="true"
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {topAlbums.length > 0 ? (
          <div
            ref={albumsScrollRef}
            className="flex items-stretch gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
          >
            {topAlbums.map((album, idx) => (
              <Link
                key={album.id || album.name}
                href={album.id ? `/album/${encodeURIComponent(album.id)}` : `/search?q=${encodeURIComponent(album.name)}&type=album`}
                data-focusable="true"
                className="group w-36 sm:w-44 shrink-0 p-2.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-2.5 shadow-md">
                  {album.thumbnail ? (
                    <img
                      src={album.thumbnail}
                      alt={album.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc3 className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {idx + 1}. {album.name}
                </p>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">
                  {album.artistName} · {album.playCount} {album.playCount === 1 ? 'play' : 'plays'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
            No album streams recorded for this period yet.
          </div>
        )}
      </section>

      {/* ── Artists Section (Matching User Screenshot 2) ────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {topArtists.length} {topArtists.length === 1 ? 'artist' : 'artists'}
          </h2>
          {topArtists.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollContainer(artistsScrollRef, 'left')}
                data-focusable="true"
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollContainer(artistsScrollRef, 'right')}
                data-focusable="true"
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {topArtists.length > 0 ? (
          <div
            ref={artistsScrollRef}
            className="flex items-stretch gap-5 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
          >
            {topArtists.map((artist, idx) => (
              <Link
                key={artist.id || artist.name}
                href={artist.id ? `/artist/${encodeURIComponent(artist.id)}` : `/search?q=${encodeURIComponent(artist.name)}&type=artist`}
                data-focusable="true"
                className="group w-32 sm:w-40 shrink-0 text-center space-y-2.5 p-2 rounded-2xl hover:bg-white/[0.03] transition-all"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full overflow-hidden bg-zinc-800 shadow-md border-2 border-white/5 group-hover:border-emerald-500/40 transition-all">
                  {artist.thumbnail ? (
                    <img
                      src={artist.thumbnail}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-zinc-600" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                    {idx + 1}. {artist.name}
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
                    {artist.playCount} {artist.playCount === 1 ? 'time' : 'times'} · {formatDuration(artist.totalSeconds)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 text-center text-zinc-500 text-sm">
            No artists streamed in this period yet.
          </div>
        )}
      </section>

      {/* ── Overview Section (Matching User Screenshot 2) ───────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Overview</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#131b1f] border border-white/5 space-y-1">
            <p className="text-xs font-semibold text-zinc-400">Plays</p>
            <p className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">{totalPlays}</p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#131b1f] border border-white/5 space-y-1">
            <p className="text-xs font-semibold text-zinc-400">Time</p>
            <p className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {formatDuration(totalListeningSeconds)}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#131b1f] border border-white/5 space-y-1">
            <p className="text-xs font-semibold text-zinc-400">Artists</p>
            <p className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">{topArtists.length}</p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#131b1f] border border-white/5 space-y-1">
            <p className="text-xs font-semibold text-zinc-400">Albums</p>
            <p className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">{topAlbums.length}</p>
          </div>
        </div>
      </section>

      {/* ── Activity Breakdown ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Activity</h2>
          <span className="text-xs text-zinc-400">Weekly listening pattern</span>
        </div>

        <div className="p-6 rounded-2xl bg-[#131b1f] border border-white/5 space-y-4">
          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-32 pt-4">
            {activityDays.map((d) => (
              <div key={d.day} className="flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full max-w-[36px] bg-zinc-800 rounded-t-lg relative flex items-end overflow-hidden h-24">
                  <div
                    className="w-full bg-gradient-to-t from-emerald-500 to-[#9ed5ea] rounded-t-lg transition-all duration-500"
                    style={{ height: `${Math.max(8, d.pct)}%` }}
                  />
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-zinc-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Floating Share Button (Matching User Screenshot 1 & 2) ──────────── */}
      <div className="fixed bottom-20 md:bottom-28 right-6 z-40">
        <button
          onClick={handleCopySummary}
          data-focusable="true"
          title="Share listening stats"
          className="w-14 h-14 rounded-full bg-[#1b3b48] hover:bg-[#254b5b] text-[#9ed5ea] flex items-center justify-center shadow-2xl border border-[#9ed5ea]/20 transition-all hover:scale-110 active:scale-95 group"
        >
          {copied ? <Check className="w-6 h-6 text-emerald-400" /> : <Share2 className="w-6 h-6" />}
        </button>
        {copied && (
          <div className="absolute -top-10 right-0 bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 shadow-xl whitespace-nowrap">
            Stats copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
}
