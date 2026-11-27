'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search as SearchIcon,
  Loader2,
  Disc3,
  User,
  Music,
  Sparkles,
  Play,
  Shuffle,
  Radio,
  ListMusic,
  ArrowRight,
} from 'lucide-react';
import { searchMusic, fetchArtist } from '@/lib/api';
import type { SearchAllResponse, Song } from '@/types/music';
import { TrackRow } from '@/components/TrackRow';
import { usePlayer } from '@/context/PlayerContext';

type SearchTab = 'all' | 'song' | 'album' | 'artist';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as SearchTab) || 'all';

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>(
    ['all', 'song', 'album', 'artist'].includes(initialType) ? initialType : 'all'
  );
  const [allData, setAllData] = useState<SearchAllResponse | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shufflingTop, setShufflingTop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { playTrack, currentTrack, isPlaying } = usePlayer();

  // Sync URL query params if navigated to /search?q=...
  useEffect(() => {
    const paramQ = searchParams.get('q');
    const paramType = searchParams.get('type') as SearchTab | null;
    if (paramQ !== null && paramQ !== query) {
      setQuery(paramQ);
    }
    if (paramType && ['all', 'song', 'album', 'artist'].includes(paramType) && paramType !== tab) {
      setTab(paramType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setAllData(null);
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchMusic(trimmed, tab)
        .then((data: any) => {
          if (tab === 'all') {
            setAllData(data as SearchAllResponse);
            setResults([]);
          } else {
            setAllData(null);
            setResults(data.results || []);
          }
        })
        .catch((err) => {
          setError(err.message || 'Search failed');
        })
        .finally(() => {
          setLoading(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [query, tab]);

  const handleShuffleTopResult = async () => {
    const top = allData?.topResult;
    if (!top) return;

    if (top.type === 'artist' && top.id) {
      setShufflingTop(true);
      try {
        const artistData = await fetchArtist(top.id);
        const pool =
          artistData.allSongs && artistData.allSongs.length > 0
            ? artistData.allSongs
            : artistData.topSongs.length > 0
            ? artistData.topSongs
            : top.songs || [];
        if (pool.length > 0) {
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          playTrack(shuffled[0], shuffled);
        }
      } catch {
        if (top.songs && top.songs.length > 0) {
          const shuffled = [...top.songs].sort(() => Math.random() - 0.5);
          playTrack(shuffled[0], shuffled);
        }
      } finally {
        setShufflingTop(false);
      }
      return;
    }

    if (top.songs && top.songs.length > 0) {
      const shuffled = [...top.songs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else if (allData?.tracks && allData.tracks.length > 0) {
      const shuffled = [...allData.tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleMixTopResult = () => {
    const top = allData?.topResult;
    if (!top) return;
    const queue = [
      ...(top.songs || []),
      ...(allData?.tracks || []).filter((t) => !(top.songs || []).some((s) => s.id === t.id)),
    ];
    if (queue.length > 0) {
      playTrack(queue[0], queue);
    }
  };

  const quickTags = ['Asake', 'Burna Boy', 'The Weeknd', 'Kendrick Lamar', 'Wizkid', 'Afrobeats'];

  const hasAllResults =
    allData &&
    (allData.topResult ||
      allData.tracks.length > 0 ||
      allData.albums.length > 0 ||
      allData.artists.length > 0 ||
      (allData.playlists && allData.playlists.length > 0));

  return (
    <div className="space-y-6 pb-8">
      {/* Search Input */}
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Search</h1>
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-12 pr-4 py-3.5 rounded-full bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm sm:text-base"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-emerald-400" />
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: 'all', label: 'All', icon: Sparkles },
              { id: 'song', label: 'Tracks', icon: Music },
              { id: 'album', label: 'Albums', icon: Disc3 },
              { id: 'artist', label: 'Artists', icon: User },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-focusable="true"
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all shrink-0 ${
                  active
                    ? 'bg-white text-zinc-950'
                    : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Suggestions when empty */}
      {!query.trim() && (
        <div className="space-y-3 pt-4">
          <p className="text-sm font-semibold text-zinc-400">Try searching for</p>
          <div className="flex flex-wrap gap-2">
            {quickTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                data-focusable="true"
                className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm text-zinc-200 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading &&
        query.trim() &&
        !error &&
        ((tab === 'all' && !hasAllResults) || (tab !== 'all' && results.length === 0)) && (
          <p className="text-zinc-500 py-8 text-sm">No results found for &ldquo;{query}&rdquo;.</p>
        )}

      {/* ALL TAB: Smart Unified Results */}
      {tab === 'all' && hasAllResults && allData && (
        <div className="space-y-8">
          {/* Top Results Hero Card */}
          {allData.topResult && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white tracking-tight">Top results</h2>
              <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 border border-white/10 p-5 sm:p-6 shadow-xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Left: Primary Entity (Artist / Album / Song) */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <Link
                      href={
                        allData.topResult.type === 'artist'
                          ? `/artist/${encodeURIComponent(allData.topResult.id)}`
                          : allData.topResult.type === 'album'
                          ? `/album/${encodeURIComponent(allData.topResult.id)}`
                          : allData.topResult.type === 'playlist'
                          ? `/playlist/${encodeURIComponent(allData.topResult.id)}`
                          : '#'
                      }
                      onClick={(e) => {
                        if (allData.topResult?.type === 'song') {
                          e.preventDefault();
                          handleMixTopResult();
                        }
                      }}
                      data-focusable="true"
                      className="flex items-center gap-4 group"
                    >
                      <div
                        className={`w-24 h-24 sm:w-28 sm:h-28 shrink-0 overflow-hidden bg-zinc-800 shadow-2xl border border-white/10 ${
                          allData.topResult.type === 'artist' ? 'rounded-full' : 'rounded-2xl'
                        }`}
                      >
                        {allData.topResult.thumbnail ? (
                          <img
                            src={allData.topResult.thumbnail}
                            alt={allData.topResult.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <User className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {allData.topResult.title}
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                          {allData.topResult.subtitle ||
                            (allData.topResult.type === 'artist' ? 'Artist' : 'Top Result')}
                        </p>
                      </div>
                    </Link>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleShuffleTopResult}
                        disabled={shufflingTop}
                        data-focusable="true"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/15 disabled:opacity-60"
                      >
                        {shufflingTop ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Shuffle className="w-4 h-4" />
                        )}
                        Shuffle
                      </button>

                      {allData.topResult.type === 'artist' ? (
                        <Link
                          href={`/artist/${encodeURIComponent(allData.topResult.id)}`}
                          data-focusable="true"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-sm transition-all"
                        >
                          View Artist
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <button
                          onClick={handleMixTopResult}
                          data-focusable="true"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-sm transition-all"
                        >
                          <Radio className="w-4 h-4" />
                          Mix
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Top 3 Songs inside Top Result */}
                  {allData.topResult.songs && allData.topResult.songs.length > 0 && (
                    <div className="lg:col-span-7 space-y-1.5 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                      {allData.topResult.songs.slice(0, 4).map((song) => {
                        const isActive = currentTrack?.id === song.id;
                        return (
                          <button
                            key={song.id}
                            onClick={() => playTrack(song, allData.topResult?.songs || [song])}
                            data-focusable="true"
                            className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all group ${
                              isActive
                                ? 'bg-emerald-500/15 border border-emerald-500/30'
                                : 'hover:bg-white/[0.06] border border-transparent'
                            }`}
                          >
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                              {song.thumbnail && (
                                <img
                                  src={song.thumbnail}
                                  alt={song.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="w-5 h-5 text-white fill-white" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-semibold truncate ${
                                  isActive ? 'text-emerald-400' : 'text-white'
                                }`}
                              >
                                {song.title}
                              </p>
                              <p className="text-xs text-zinc-400 truncate mt-0.5">
                                {song.durationText}
                                {song.playCount ? ` • ${song.playCount}` : ''}
                              </p>
                            </div>
                            {isActive && isPlaying && (
                              <span className="text-[11px] font-medium text-emerald-400 px-2">
                                Playing
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Tracks Section */}
          {allData.tracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">Tracks</h2>
                <button
                  onClick={() => setTab('song')}
                  data-focusable="true"
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  See all
                </button>
              </div>
              <div className="space-y-1">
                {allData.tracks.slice(0, 6).map((song, idx) => (
                  <TrackRow
                    key={`${song.id}-${idx}`}
                    track={song}
                    index={idx}
                    queue={allData.tracks}
                    showIndex
                  />
                ))}
              </div>
            </section>
          )}

          {/* Albums Section */}
          {allData.albums.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">Albums</h2>
                <button
                  onClick={() => setTab('album')}
                  data-focusable="true"
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  See all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allData.albums.slice(0, 5).map((album, idx) => (
                  <Link
                    key={`${album.id}-${idx}`}
                    href={`/album/${encodeURIComponent(album.id)}`}
                    data-focusable="true"
                    className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3">
                      {album.thumbnail && (
                        <img
                          src={album.thumbnail}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{album.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {album.artists?.map((a) => a.name).join(', ') || album.year || 'Album'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Artists Section */}
          {allData.artists.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">Artists</h2>
                <button
                  onClick={() => setTab('artist')}
                  data-focusable="true"
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  See all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allData.artists.slice(0, 5).map((artist, idx) => (
                  <Link
                    key={`${artist.id}-${idx}`}
                    href={`/artist/${encodeURIComponent(artist.id)}`}
                    data-focusable="true"
                    className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col items-center text-center"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-zinc-800 mb-3 shadow-lg">
                      {artist.thumbnail && (
                        <img
                          src={artist.thumbnail}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white truncate w-full">{artist.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate w-full">
                      {artist.subscribers || 'Artist'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Playlists Section */}
          {allData.playlists && allData.playlists.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white tracking-tight">Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allData.playlists.slice(0, 5).map((pl, idx) => (
                  <Link
                    key={`${pl.id}-${idx}`}
                    href={`/playlist/${encodeURIComponent(pl.id)}`}
                    data-focusable="true"
                    className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3 flex items-center justify-center">
                      {pl.thumbnail ? (
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <ListMusic className="w-10 h-10 text-zinc-600" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white truncate">{pl.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{pl.author || 'Playlist'}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* DEDICATED TABS */}
      {tab === 'song' && results.length > 0 && (
        <div className="space-y-1">
          {results.map((song: Song, idx: number) => (
            <TrackRow
              key={`${song.id}-${idx}`}
              track={song}
              index={idx}
              queue={results}
              showIndex
            />
          ))}
        </div>
      )}

      {tab === 'album' && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((album: any, idx: number) => (
            <Link
              key={`${album.id}-${idx}`}
              href={`/album/${encodeURIComponent(album.id)}`}
              data-focusable="true"
              className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3">
                {album.thumbnail && (
                  <img
                    src={album.thumbnail}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
              </div>
              <p className="text-sm font-semibold text-white truncate">{album.title}</p>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {album.artists?.map((a: any) => a.name).join(', ') || album.year || 'Album'}
              </p>
            </Link>
          ))}
        </div>
      )}

      {tab === 'artist' && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {results.map((artist: any, idx: number) => (
            <Link
              key={`${artist.id}-${idx}`}
              href={`/artist/${encodeURIComponent(artist.id)}`}
              data-focusable="true"
              className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col items-center text-center"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-zinc-800 mb-3 shadow-lg">
                {artist.thumbnail && (
                  <img
                    src={artist.thumbnail}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
              </div>
              <p className="text-sm font-semibold text-white truncate w-full">{artist.name}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{artist.subscribers || 'Artist'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
