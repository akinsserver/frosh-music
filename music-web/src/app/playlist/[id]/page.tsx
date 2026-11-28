'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play, Pause, Loader2, ListMusic, ArrowLeft, Radio, Heart, Download, CheckCircle2 } from 'lucide-react';
import { fetchPlaylist, getStreamUrl } from '@/lib/api';
import type { Playlist } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';
import { useOffline } from '@/context/OfflineContext';
import { TrackRow } from '@/components/TrackRow';
import { resolveSongArtists } from '@/lib/recommendations';
import { getCachedData, setCachedData } from '@/lib/clientCache';

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id || ''));
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLibrary();
  const { isDownloaded, isDownloading, downloadingProgress, downloadTrack, removeDownload } = useOffline();

  useEffect(() => {
    if (!id) return;
    const cacheKey = `playlist:${id}`;
    const cached = getCachedData<Playlist>(cacheKey, 10 * 60 * 1000);
    if (cached) {
      setPlaylist(cached.data);
      setLoading(false);
      if (!cached.isStale) return;
    } else {
      setLoading(true);
    }

    fetchPlaylist(id)
      .then((data) => {
        const isPodcast =
          id.startsWith('VLSP') || id.startsWith('MPSP') || /podcast/i.test(data.title || '');
        const showBrowseId = id.startsWith('VLSP') ? `MPSP${id.slice(2)}` : id;
        const showName = data.title || data.author || 'Podcast';
        const fallbackContext = data.title || data.author;

        const cleanedTracks = (data.tracks || []).map((t) => ({
          ...t,
          artists: isPodcast
            ? [{ id: showBrowseId, name: showName }]
            : resolveSongArtists(t, fallbackContext),
        }));
        const formatted = { ...data, tracks: cleanedTracks };
        setPlaylist(formatted);
        setCachedData(cacheKey, formatted);
        setError(null);

        // Pre-warm the first episode of a podcast show so tapping Play starts fast
        if (isPodcast && cleanedTracks[0]?.id) {
          fetch(`${getStreamUrl(cleanedTracks[0].id)}/info`).catch(() => {});
        }
      })
      .catch((err) => {
        if (!cached) setError(err.message || 'Failed to load playlist');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span>Loading playlist...</span>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300">
        {error || 'Playlist not found'}
      </div>
    );
  }

  const isPodcastShow =
    id.startsWith('VLSP') ||
    id.startsWith('MPSP') ||
    /podcast/i.test(playlist.title || '');

  return (
    <div className="space-y-6">
      {/* Sticky Minimal Back Button */}
      <div className="sticky top-3 z-30 flex items-center pointer-events-none">
        <button
          onClick={() => router.back()}
          data-focusable="true"
          aria-label="Go back"
          title="Go back"
          className="pointer-events-auto w-10 h-10 rounded-full bg-zinc-900/75 hover:bg-zinc-800/95 active:scale-95 text-white border border-white/15 backdrop-blur-xl shadow-lg shadow-black/40 flex items-center justify-center transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-white/10">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl bg-zinc-800 shrink-0">
          {playlist.thumbnail ? (
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ListMusic className="w-16 h-16 text-zinc-600" />
            </div>
          )}
        </div>

        <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {isPodcastShow ? 'Podcast Show' : 'Playlist'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white truncate">
            {playlist.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {playlist.author ? `${playlist.author} · ` : ''}
            {playlist.tracks.length} {isPodcastShow ? 'episodes' : 'tracks'}
          </p>

          {playlist.description && isPodcastShow && (
            <p className="text-xs sm:text-sm text-zinc-400/90 line-clamp-2 max-w-2xl">
              {playlist.description}
            </p>
          )}

          {playlist.tracks.length > 0 && (
            <div className="pt-3">
              <button
                onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                data-focusable="true"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-transform hover:scale-105 shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                {isPodcastShow ? 'Play Latest Episode' : 'Play All'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isPodcastShow ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              All Episodes
            </h2>
            <span className="text-xs text-zinc-400">{playlist.tracks.length} episodes</span>
          </div>

          <div className="space-y-2.5">
            {playlist.tracks.map((ep, idx) => {
              const isActive = currentTrack?.id === ep.id;
              const liked = isLiked(ep.id);
              const downloaded = isDownloaded(ep.id);
              const downloading = isDownloading(ep.id);
              const pct = downloadingProgress[ep.id];

              return (
                <div
                  key={`${ep.id}-${idx}`}
                  onClick={() => (isActive ? togglePlay() : playTrack(ep, playlist.tracks))}
                  data-focusable="true"
                  className={`group flex items-start gap-3.5 sm:gap-4 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5'
                  }`}
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                    {ep.thumbnail || playlist.thumbnail ? (
                      <img
                        src={ep.thumbnail || playlist.thumbnail}
                        alt={ep.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-indigo-400">
                        <Radio className="w-7 h-7" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <h3
                      className={`text-sm sm:text-base font-semibold line-clamp-2 leading-snug ${
                        isActive ? 'text-emerald-400' : 'text-white group-hover:text-emerald-300'
                      }`}
                    >
                      {ep.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{playlist.title}</span>
                      {ep.durationText && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-300 font-medium">{ep.durationText}</span>
                        </>
                      )}
                      {isActive && isPlaying && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Playing
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          isActive ? togglePlay() : playTrack(ep, playlist.tracks);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-zinc-950 hover:bg-emerald-400 text-xs font-bold transition-colors"
                      >
                        {isActive && isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Play
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (downloading) return;
                          downloaded ? removeDownload(ep.id) : downloadTrack(ep);
                        }}
                        title={downloaded ? 'Remove offline download' : 'Download episode'}
                        className={`p-1.5 rounded-full border transition-colors ${
                          downloaded || downloading
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : downloaded ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(ep);
                        }}
                        title={liked ? 'Saved' : 'Save episode'}
                        className={`p-1.5 rounded-full border transition-colors ${
                          liked
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
                      </button>

                      {downloading && pct !== undefined && (
                        <span className="text-[11px] text-emerald-400 tabular-nums">{pct}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {playlist.tracks.map((track, idx) => (
            <TrackRow
              key={`${track.id}-${idx}`}
              track={track}
              index={idx}
              queue={playlist.tracks}
              showIndex
              fallbackContext={playlist.title || playlist.author}
            />
          ))}
        </div>
      )}
    </div>
  );
}
