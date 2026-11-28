'use client';

import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import type { Song } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { resolveSongArtists, getArtistOrPodcastHref } from '@/lib/recommendations';

interface SongBoxCardProps {
  song: Song;
  queue: Song[];
  className?: string;
  fallbackContext?: string;
}

export function SongBoxCard({ song, queue, className = '', fallbackContext }: SongBoxCardProps) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const isCurrent = currentTrack?.id === song.id;
  const displayArtists = resolveSongArtists(song, fallbackContext);

  return (
    <div
      onClick={() => playTrack(song, queue)}
      data-focusable="true"
      className={`group w-36 sm:w-44 shrink-0 snap-start flex flex-col p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-[0.98] border border-white/5 transition-all cursor-pointer ${className}`}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-800 shadow-md mb-2.5">
        {song.thumbnail ? (
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600">
            ♪
          </div>
        )}

        {/* Hover / Active Play Button Overlay */}
        <div
          className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-xl transition-all duration-200 ${
            isCurrent
              ? 'opacity-100 scale-100 ring-2 ring-white/20'
              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105'
          }`}
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>

        {isCurrent && isPlaying && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-zinc-950 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
            Playing
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p
          className={`text-sm font-semibold truncate transition-colors ${
            isCurrent ? 'text-emerald-400' : 'text-white group-hover:text-emerald-300'
          }`}
          title={song.title}
        >
          {song.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <p className="text-xs text-zinc-400 truncate">
            {displayArtists.map((a, i) => (
              <React.Fragment key={`${a.name}-${i}`}>
                {i > 0 && ', '}
                <Link
                  href={getArtistOrPodcastHref(a)}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-emerald-400 hover:underline transition-colors"
                >
                  {a.name}
                </Link>
              </React.Fragment>
            ))}
          </p>
          {song.playCount && (
            <>
              <span className="text-zinc-600 text-[10px] shrink-0">•</span>
              <span className="text-[11px] text-emerald-400 font-medium shrink-0">
                {song.playCount}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
