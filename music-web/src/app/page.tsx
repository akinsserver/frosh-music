'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Search, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { fetchHome, isSongItem } from '@/lib/api';
import type { HomeShelf, Song, HomeCardItem } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';
import { TrackRow } from '@/components/TrackRow';

export default function HomePage() {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playTrack } = usePlayer();
  const { history } = useLibrary();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchHome()
      .then((data) => {
        if (mounted) {
          setShelves(data.shelves || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Could not reach music-server at http://localhost:4000');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Home
          </h1>
        </div>

        <Link
          href="/search"
          data-focusable="true"
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-zinc-200 transition-all w-full sm:w-auto"
        >
          <Search className="w-4 h-4 text-emerald-400" />
          <span>Search songs, albums, artists...</span>
        </Link>
      </div>

      {/* Continue Listening (from local history) */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Continue Listening</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {history.slice(0, 6).map((song) => (
              <button
                key={song.id}
                onClick={() => playTrack(song, history)}
                data-focusable="true"
                className="group flex items-center gap-3 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/5 transition-all text-left"
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-12 h-12 rounded-lg object-cover bg-zinc-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {song.artists.map((a) => a.name).join(', ')}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mr-1 shadow-lg">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Loading / Error State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Loading your music feed...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to connect to Frosh Music Server</p>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
            <p className="text-xs text-zinc-400 mt-2">
              Make sure <code className="text-white">music-server</code> is running on port 4000.
            </p>
          </div>
        </div>
      )}

      {/* Dynamic InnerTube Home Shelves */}
      {!loading &&
        shelves.map((shelf, idx) => {
          const songItems = shelf.items.filter(isSongItem) as Song[];
          const cardItems = shelf.items.filter((i) => !isSongItem(i)) as HomeCardItem[];

          return (
            <section key={`${shelf.title}-${idx}`} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">{shelf.title}</h2>
                {shelf.subtitle && (
                  <p className="text-xs text-zinc-400 mt-0.5">{shelf.subtitle}</p>
                )}
              </div>

              {songItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {songItems.slice(0, 8).map((song) => (
                    <TrackRow key={song.id} track={song} queue={songItems} />
                  ))}
                </div>
              )}

              {cardItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {cardItems.map((card, cIdx) => {
                    const href =
                      card.type === 'album'
                        ? `/album/${encodeURIComponent(card.id)}`
                        : card.type === 'artist'
                        ? `/artist/${encodeURIComponent(card.id)}`
                        : `/playlist/${encodeURIComponent(card.id)}`;

                    return (
                      <Link
                        key={`${card.id}-${cIdx}`}
                        href={href}
                        data-focusable="true"
                        className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col"
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                          {card.thumbnail && (
                            <img
                              src={card.thumbnail}
                              alt={card.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{card.title}</p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {card.subtitle || card.type}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
