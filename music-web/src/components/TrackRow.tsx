'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Pause, Heart, ListPlus, Plus, Check, Download, CheckCircle2, Loader2 } from 'lucide-react';
import type { Song } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';
import { useOffline } from '@/context/OfflineContext';
import { resolveSongArtists } from '@/lib/recommendations';

interface TrackRowProps {
  track: Song;
  index?: number;
  queue?: Song[];
  showIndex?: boolean;
}

export function TrackRow({ track, index, queue, showIndex = false }: TrackRowProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { isLiked, toggleLike, playlists, addTrackToPlaylist } = useLibrary();
  const { isDownloaded, isDownloading, downloadingProgress, downloadTrack, removeDownload } = useOffline();
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const isActive = currentTrack?.id === track.id;
  const liked = isLiked(track.id);
  const downloaded = isDownloaded(track.id);
  const downloading = isDownloading(track.id);
  const downloadPct = downloadingProgress[track.id];

  const handlePlay = () => {
    if (isActive) {
      togglePlay();
    } else {
      playTrack(track, queue);
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  return (
    <div
      onClick={handlePlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handlePlay();
        }
      }}
      tabIndex={0}
      data-focusable="true"
      className={`group relative flex items-center gap-3.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      {/* Track number or Play indicator */}
      {showIndex && index !== undefined && (
        <div className="w-6 text-center text-sm text-zinc-500 shrink-0 hidden sm:block">
          {isActive && isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-3.5">
              <span className="w-1 bg-emerald-400 rounded-full animate-eq-1 h-full" />
              <span className="w-1 bg-emerald-400 rounded-full animate-eq-2 h-full" />
              <span className="w-1 bg-emerald-400 rounded-full animate-eq-3 h-full" />
            </div>
          ) : (
            <span className="group-hover:hidden">{index + 1}</span>
          )}
          <Play className="w-4 h-4 text-white hidden group-hover:inline-block mx-auto fill-white" />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800" />
        )}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isActive && isPlaying ? (
            <Pause className="w-5 h-5 text-emerald-400 fill-emerald-400" />
          ) : (
            <Play className="w-5 h-5 text-white fill-white" />
          )}
        </div>
      </div>

      {/* Title & Artists */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium truncate ${
              isActive ? 'text-emerald-400' : 'text-white'
            }`}
          >
            {track.title}
          </p>
          {track.isExplicit && (
            <span className="px-1 py-0.2 text-[10px] font-bold bg-zinc-700 text-zinc-300 rounded">
              E
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-400 truncate mt-0.5 flex items-center gap-1">
          {resolveSongArtists(track).map((artist, i) => (
            <React.Fragment key={`${artist.name}-${i}`}>
              {i > 0 && <span>, </span>}
              {artist.id ? (
                <Link
                  href={`/artist/${encodeURIComponent(artist.id)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-emerald-400 hover:underline transition-colors"
                >
                  {artist.name}
                </Link>
              ) : (
                <Link
                  href={`/search?q=${encodeURIComponent(artist.name)}&type=artist`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-emerald-400 hover:underline transition-colors"
                >
                  {artist.name}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Album Name (Desktop) */}
      {track.album?.name && (
        <div className="hidden lg:block w-48 truncate text-xs text-zinc-400">
          {track.album.id ? (
            <Link
              href={`/album/${encodeURIComponent(track.album.id)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-white hover:underline"
            >
              {track.album.name}
            </Link>
          ) : (
            track.album.name
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (downloading) return;
            if (downloaded) {
              removeDownload(track.id);
            } else {
              downloadTrack(track);
            }
          }}
          title={
            downloading
              ? `Downloading (${downloadPct ?? 0}%)`
              : downloaded
              ? 'Downloaded offline (click to remove)'
              : 'Download for offline playback'
          }
          data-focusable="true"
          className={`p-1.5 rounded-lg transition-colors ${
            downloaded || downloading
              ? 'text-emerald-400 opacity-100'
              : 'text-zinc-400 sm:opacity-0 sm:group-hover:opacity-100 hover:text-white'
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
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(track);
          }}
          title={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          data-focusable="true"
          className={`p-1.5 rounded-lg transition-colors ${
            liked
              ? 'text-emerald-400 opacity-100'
              : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-emerald-400' : ''}`} />
        </button>

        <button
          onClick={handleAddToQueue}
          title="Add to Queue"
          data-focusable="true"
          className="p-1.5 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-colors"
        >
          {addedFeedback ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <ListPlus className="w-4 h-4" />
          )}
        </button>

        {playlists.length > 0 && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPlaylistMenu((p) => !p);
              }}
              title="Add to Playlist"
              className="p-1.5 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            {showPlaylistMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-8 z-50 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1.5"
              >
                <p className="text-[11px] font-semibold text-zinc-500 px-2.5 py-1">
                  Add to Playlist
                </p>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      addTrackToPlaylist(pl.id, track);
                      setShowPlaylistMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/10 rounded-lg truncate"
                  >
                    {pl.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-xs text-zinc-500 w-10 text-right tabular-nums">
          {track.durationText}
        </span>
      </div>
    </div>
  );
}
