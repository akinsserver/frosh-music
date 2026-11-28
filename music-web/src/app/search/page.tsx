'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
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
  Clock,
  X,
  TrendingUp,
} from 'lucide-react';
import { searchMusic, fetchArtist, fetchHome } from '@/lib/api';
import { fetchTopReleasesThisWeek, getArtistOrPodcastHref } from '@/lib/recommendations';
import type { SearchAllResponse, Song } from '@/types/music';
import { TrackRow } from '@/components/TrackRow';
import { usePlayer } from '@/context/PlayerContext';
import { useLibrary } from '@/context/LibraryContext';

type SearchTab = 'all' | 'song' | 'album' | 'artist' | 'podcast';

function isPodcastSong(song: Song): boolean {
  return Boolean(
    song.artists?.some((a) => a.id?.startsWith('MPSP')) ||
      (song.duration && song.duration > 1200) ||
      /\b(podcast|episode|ep\.\s*\d+)\b/i.test(song.title || '')
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as SearchTab) || 'all';

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>(
    ['all', 'song', 'album', 'artist', 'podcast'].includes(initialType) ? initialType : 'all'
  );
  const [allData, setAllData] = useState<SearchAllResponse | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shufflingTop, setShufflingTop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Discovery feed state (for empty search state)
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [topTracks, setTopTracks] = useState<Song[]>([]);
  const [topAlbums, setTopAlbums] = useState<any[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [topPodcasts, setTopPodcasts] = useState<any[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('frosh_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const addRecentSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== t.toLowerCase());
      const updated = [t, ...filtered].slice(0, 8); // max 8 pills
      try {
        localStorage.setItem('frosh_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem('frosh_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('frosh_recent_searches');
    } catch {}
  };

  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { history, likedSongs } = useLibrary();

  // Load discovery feed for empty search state (Spotify / YouTube Music style)
  useEffect(() => {
    let mounted = true;
    setDiscoverLoading(true);

    Promise.allSettled([
      fetchTopReleasesThisWeek(12),
      fetchHome(),
      searchMusic('top albums', 'album'),
      searchMusic('top artists', 'artist'),
      searchMusic('top podcasts', 'podcast'),
    ])
      .then(([releasesRes, homeRes, albumsRes, artistsRes, podcastsRes]) => {
        if (!mounted) return;

        // 1. Top tracks
        const tracks: Song[] = [];
        const seenTrackIds = new Set<string>();
        if (releasesRes.status === 'fulfilled' && Array.isArray(releasesRes.value)) {
          for (const s of releasesRes.value) {
            if (s?.id && !seenTrackIds.has(s.id)) {
              seenTrackIds.add(s.id);
              tracks.push(s);
            }
          }
        }
        if (homeRes.status === 'fulfilled' && homeRes.value?.shelves) {
          for (const shelf of homeRes.value.shelves) {
            for (const item of shelf.items || []) {
              if (!item?.id || seenTrackIds.has(item.id)) continue;
              if ('type' in item) {
                if (item.type === 'song') {
                  seenTrackIds.add(item.id);
                  tracks.push({
                    id: item.id,
                    title: item.title,
                    artists: [{ name: item.subtitle || 'Artist' }],
                    thumbnail: item.thumbnail,
                    duration: 0,
                    durationText: '',
                  });
                }
              } else if ('artists' in item) {
                seenTrackIds.add(item.id);
                tracks.push(item);
              }
            }
          }
        }
        setTopTracks(tracks.slice(0, 15));

        // 2. Top albums
        if (albumsRes.status === 'fulfilled' && albumsRes.value && 'results' in albumsRes.value) {
          setTopAlbums((albumsRes.value.results || []).slice(0, 10));
        }

        // 3. Top artists
        if (artistsRes.status === 'fulfilled' && artistsRes.value && 'results' in artistsRes.value) {
          setTopArtists((artistsRes.value.results || []).slice(0, 10));
        }

        // 4. Top podcasts
        if (podcastsRes.status === 'fulfilled' && podcastsRes.value && 'results' in podcastsRes.value) {
          setTopPodcasts((podcastsRes.value.results || []).slice(0, 12));
        }
      })
      .finally(() => {
        if (mounted) setDiscoverLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Derive user's recent categories from library history & likes
  const { recentTracks, recentPodcasts, recentAlbums, recentArtists } = useMemo(() => {
    const rTracks: Song[] = [];
    const rPodcasts: Song[] = [];
    const rAlbumsMap = new Map<string, { id: string; title: string; thumbnail: string; artist: string }>();
    const rArtistsMap = new Map<string, { id: string; name: string; thumbnail: string }>();

    const combined = [...history, ...likedSongs];
    const seenSongs = new Set<string>();

    for (const s of combined) {
      if (!s?.id) continue;
      if (!seenSongs.has(s.id)) {
        seenSongs.add(s.id);
        if (isPodcastSong(s)) {
          rPodcasts.push(s);
        } else {
          rTracks.push(s);
        }
      }

      if (s.album?.id && !rAlbumsMap.has(s.album.id)) {
        rAlbumsMap.set(s.album.id, {
          id: s.album.id,
          title: s.album.name || s.title,
          thumbnail: s.thumbnail,
          artist: s.artists?.map((a) => a.name).join(', ') || 'Album',
        });
      }

      for (const a of s.artists || []) {
        if (a?.id && !a.id.startsWith('MPSP') && a.name && a.name !== 'Unknown Artist' && !rArtistsMap.has(a.id)) {
          rArtistsMap.set(a.id, {
            id: a.id,
            name: a.name,
            thumbnail: s.thumbnail,
          });
        }
      }
    }

    return {
      recentTracks: rTracks.slice(0, 8),
      recentPodcasts: rPodcasts.slice(0, 8),
      recentAlbums: Array.from(rAlbumsMap.values()).slice(0, 8),
      recentArtists: Array.from(rArtistsMap.values()).slice(0, 8),
    };
  }, [history, likedSongs]);

  // Sync URL query params if navigated to /search?q=...
  useEffect(() => {
    const paramQ = searchParams.get('q');
    const paramType = searchParams.get('type') as SearchTab | null;
    if (paramQ !== null && paramQ !== query) {
      setQuery(paramQ);
    }
    if (paramType && ['all', 'song', 'album', 'artist', 'podcast'].includes(paramType) && paramType !== tab) {
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    inputRef.current?.blur();
  };

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
        <form onSubmit={handleSearchSubmit} className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums, podcasts..."
            className="w-full pl-12 pr-24 py-3.5 rounded-full bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm sm:text-base"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              data-focusable="true"
              aria-label="Search"
              className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-semibold text-xs transition-all flex items-center gap-1"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SearchIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </form>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: 'all', label: 'All', icon: Sparkles },
              { id: 'song', label: 'Tracks', icon: Music },
              { id: 'album', label: 'Albums', icon: Disc3 },
              { id: 'artist', label: 'Artists', icon: User },
              { id: 'podcast', label: 'Podcasts', icon: Radio },
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

        {/* Recent Searches Pills (Max 8 items, easy quick tap) */}
        {recentSearches.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Recent Searches
              </span>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {recentSearches.map((term) => (
                <div
                  key={term}
                  onClick={() => setQuery(term)}
                  data-focusable="true"
                  className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all shrink-0 border ${
                    query.toLowerCase() === term.toLowerCase()
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-500 font-semibold'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="truncate max-w-[130px]">{term}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentSearch(term);
                    }}
                    className="p-0.5 rounded-full hover:bg-white/20 text-zinc-400 hover:text-white transition-colors"
                    title="Remove from history"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category-Filtered Discovery Feed when search box is empty (Spotify / YT Music style) */}
      {!query.trim() && (
        <div className="space-y-8 pt-2">
          {/* Quick Suggestions */}
          {tab === 'all' && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Try searching for
              </p>
              <div className="flex flex-wrap gap-2">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setQuery(tag);
                      addRecentSearch(tag);
                    }}
                    data-focusable="true"
                    className="px-4 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm text-zinc-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {discoverLoading && topTracks.length === 0 && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Loading recommendations...</span>
            </div>
          )}

          {/* ALL: Recently Played Mix */}
          {tab === 'all' && history.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Jump Back In
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {history.slice(0, 6).map((song, idx) => (
                  <button
                    key={`jump-${song.id}-${idx}`}
                    onClick={() => playTrack(song, history)}
                    data-focusable="true"
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 text-left transition-all group"
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                      {song.thumbnail && (
                        <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {song.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {song.artists?.map((a) => a.name).join(', ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* TRACKS: Recently Played Tracks */}
          {tab === 'song' && recentTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Recently Played Tracks
                </h2>
              </div>
              <div className="space-y-1">
                {recentTracks.slice(0, 6).map((song, idx) => (
                  <TrackRow
                    key={`rec-trk-${song.id}-${idx}`}
                    track={song}
                    index={idx}
                    queue={recentTracks}
                    showIndex
                  />
                ))}
              </div>
            </section>
          )}

          {/* TRACKS & ALL: Top Ranking Tracks */}
          {(tab === 'all' || tab === 'song') && topTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Top Ranking Tracks
                  </h2>
                </div>
                {tab === 'all' && (
                  <button
                    onClick={() => setTab('song')}
                    className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {(tab === 'all' ? topTracks.slice(0, 5) : topTracks).map((song, idx) => (
                  <TrackRow
                    key={`top-trk-${song.id}-${idx}`}
                    track={song}
                    index={idx}
                    queue={topTracks}
                    showIndex
                  />
                ))}
              </div>
            </section>
          )}

          {/* ARTISTS: Recently Played / Searched Artists */}
          {tab === 'artist' && recentArtists.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Your Recent Artists
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recentArtists.map((artist, idx) => (
                  <Link
                    key={`rec-art-${artist.id}-${idx}`}
                    href={getArtistOrPodcastHref(artist)}
                    data-focusable="true"
                    className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col items-center text-center"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-zinc-800 mb-3 shadow-lg">
                      {artist.thumbnail ? (
                        <img
                          src={artist.thumbnail}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white truncate w-full">{artist.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Recent Artist</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ARTISTS & ALL: Top Ranking Artists */}
          {(tab === 'all' || tab === 'artist') && topArtists.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Top Ranking Artists
                  </h2>
                </div>
                {tab === 'all' && (
                  <button
                    onClick={() => setTab('artist')}
                    className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(tab === 'all' ? topArtists.slice(0, 5) : topArtists).map((artist: any, idx: number) => (
                  <Link
                    key={`top-art-${artist.id}-${idx}`}
                    href={`/artist/${encodeURIComponent(artist.id)}`}
                    data-focusable="true"
                    className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col items-center text-center"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-zinc-800 mb-3 shadow-lg">
                      {artist.thumbnail ? (
                        <img
                          src={artist.thumbnail}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                          <User className="w-10 h-10" />
                        </div>
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

          {/* ALBUMS: Recently Played Albums */}
          {tab === 'album' && recentAlbums.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Recently Played Albums
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recentAlbums.map((album, idx) => (
                  <Link
                    key={`rec-alb-${album.id}-${idx}`}
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
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{album.artist}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ALBUMS & ALL: Top Ranking Albums */}
          {(tab === 'all' || tab === 'album') && topAlbums.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Top Ranking Albums
                  </h2>
                </div>
                {tab === 'all' && (
                  <button
                    onClick={() => setTab('album')}
                    className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(tab === 'all' ? topAlbums.slice(0, 5) : topAlbums).map((album: any, idx: number) => (
                  <Link
                    key={`top-alb-${album.id}-${idx}`}
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
            </section>
          )}

          {/* PODCASTS: Recently Played Podcasts */}
          {tab === 'podcast' && recentPodcasts.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Recently Played Podcasts
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentPodcasts.map((item, idx) => (
                  <div
                    key={`rec-pod-${item.id}-${idx}`}
                    onClick={() => playTrack(item, recentPodcasts)}
                    data-focusable="true"
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 cursor-pointer group transition-all"
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-indigo-400">
                          <Radio className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 mb-0.5 inline-block">
                        Recent Episode
                      </span>
                      <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {item.artists?.map((a) => a.name).join(', ') || 'Podcast'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PODCASTS & ALL: Top Ranking Podcasts */}
          {(tab === 'all' || tab === 'podcast') && topPodcasts.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Top Ranking Podcasts
                  </h2>
                </div>
                {tab === 'all' && (
                  <button
                    onClick={() => setTab('podcast')}
                    className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(tab === 'all' ? topPodcasts.slice(0, 6) : topPodcasts).map((item: any, idx: number) => {
                  const isEpisode = item.type === 'episode' || typeof item.duration === 'number';
                  if (isEpisode) {
                    return (
                      <div
                        key={`top-pod-${item.id}-${idx}`}
                        onClick={() =>
                          playTrack(
                            item,
                            topPodcasts.filter((r) => r.type === 'episode' || typeof r.duration === 'number')
                          )
                        }
                        data-focusable="true"
                        className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 cursor-pointer group transition-all"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-indigo-400">
                              <Radio className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              Episode
                            </span>
                            {item.durationText && (
                              <span className="text-[11px] text-zinc-500">{item.durationText}</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">
                            {item.artists?.map((a: any) => a.name).join(', ') || item.author || 'Podcast'}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={`top-pod-show-${item.id}-${idx}`}
                      href={`/playlist/${encodeURIComponent(item.id)}`}
                      data-focusable="true"
                      className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 group transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Radio className="w-6 h-6 text-indigo-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-0.5 inline-block">
                          Podcast Show
                        </span>
                        <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{item.author || 'Full Show'}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
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

      {tab === 'podcast' && results.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((item: any, idx: number) => {
              const isEpisode = item.type === 'episode' || typeof item.duration === 'number';
              if (isEpisode) {
                return (
                  <div
                    key={`pod-${item.id}-${idx}`}
                    onClick={() =>
                      playTrack(
                        item,
                        results.filter((r) => r.type === 'episode' || typeof r.duration === 'number')
                      )
                    }
                    data-focusable="true"
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 cursor-pointer group transition-all"
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-indigo-400">
                          <Radio className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          Episode
                        </span>
                        {item.durationText && (
                          <span className="text-[11px] text-zinc-500">{item.durationText}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">
                        {item.artists?.map((a: any) => a.name).join(', ') || item.author || 'Podcast'}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={`pod-show-${item.id}-${idx}`}
                  href={`/playlist/${encodeURIComponent(item.id)}`}
                  data-focusable="true"
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 group transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Radio className="w-6 h-6 text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-0.5 inline-block">
                      Podcast Show
                    </span>
                    <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">{item.author || 'Full Show'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
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
