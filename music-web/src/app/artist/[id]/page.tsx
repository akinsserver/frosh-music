'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  Pause,
  Shuffle,
  Loader2,
  User,
  BadgeCheck,
  Disc,
  Music,
  Users,
  Radio,
  ChevronDown,
  ChevronUp,
  Search,
  Heart,
  Share2,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { fetchArtist, fetchAlbum } from '@/lib/api';
import type { Artist, Song, Album } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { TrackRow } from '@/components/TrackRow';

type TabType = 'overview' | 'songs' | 'albums' | 'singles' | 'similar';

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id || ''));
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAllTopSongs, setShowAllTopSongs] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

  useEffect(() => {
    if (!id) return;

    // Defense-in-depth: Podcast show browse IDs start with MPSP and are playlists in YouTube Music
    if (id.startsWith('MPSP')) {
      router.replace(`/playlist/VL${id.slice(4)}`);
      return;
    }

    setLoading(true);
    fetchArtist(id)
      .then((data) => {
        setArtist(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load artist'))
      .finally(() => setLoading(false));

    // Load follow state
    try {
      const stored = localStorage.getItem('vyla_followed_artists');
      if (stored) {
        const list: string[] = JSON.parse(stored);
        setIsFollowing(list.includes(id));
      }
    } catch {}
  }, [id]);

  const toggleFollow = () => {
    try {
      const stored = localStorage.getItem('vyla_followed_artists');
      const list: string[] = stored ? JSON.parse(stored) : [];
      let updated: string[];
      if (list.includes(id)) {
        updated = list.filter((aId) => aId !== id);
        setIsFollowing(false);
      } else {
        updated = [...list, id];
        setIsFollowing(true);
      }
      localStorage.setItem('vyla_followed_artists', JSON.stringify(updated));
    } catch {}
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allSongsList = useMemo(() => {
    if (!artist) return [];
    return artist.allSongs && artist.allSongs.length > 0
      ? artist.allSongs
      : artist.topSongs;
  }, [artist]);

  const filteredAllSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return allSongsList;
    const q = songSearchQuery.toLowerCase();
    return allSongsList.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artists.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [allSongsList, songSearchQuery]);

  const visibleTopSongs = useMemo(() => {
    if (!artist) return [];
    const source = artist.topSongs.length > 0 ? artist.topSongs : allSongsList;
    return showAllTopSongs ? source.slice(0, 20) : source.slice(0, 5);
  }, [artist, showAllTopSongs, allSongsList]);

  const handlePlayArtist = (shuffle = false) => {
    if (!artist || allSongsList.length === 0) return;
    if (shuffle) {
      const shuffled = [...allSongsList].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    } else {
      playTrack(allSongsList[0], allSongsList);
    }
  };

  const handlePlayAlbum = async (e: React.MouseEvent, alb: Album) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const fullAlbum = await fetchAlbum(alb.id);
      if (fullAlbum.tracks && fullAlbum.tracks.length > 0) {
        playTrack(fullAlbum.tracks[0], fullAlbum.tracks);
      }
    } catch (err) {
      console.error('Failed to play album:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Loading artist discography...</span>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 max-w-xl mx-auto text-center space-y-3">
        <h3 className="text-lg font-bold">Could not load artist</h3>
        <p className="text-sm text-red-400/80">{error || 'Artist not found'}</p>
        <Link
          href="/"
          className="inline-block px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const isCurrentArtistPlaying =
    isPlaying &&
    currentTrack &&
    (currentTrack.artists.some((a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()));

  return (
    <div className="space-y-8 pb-16">
      {/* Sticky Minimal Back Button */}
      <div className="sticky top-3 z-30 flex items-center pointer-events-none -mb-12">
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

      {/* ── Ambient Hero Banner ──────────────────────────────────────────────── */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 px-4 sm:px-8 pt-16 pb-8 overflow-hidden rounded-b-3xl border-b border-white/10">
        {/* Blurred ambient background glow */}
        {artist.thumbnail && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-3xl scale-125 pointer-events-none -z-10"
            style={{ backgroundImage: `url(${artist.thumbnail})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none -z-10" />

        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8 max-w-7xl mx-auto">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden shadow-2xl bg-zinc-900 border-2 border-white/10 transition-transform group-hover:scale-[1.02]">
              {artist.thumbnail ? (
                <img
                  src={artist.thumbnail}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-20 h-20 text-zinc-600" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="text-center md:text-left space-y-3 flex-1 min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <BadgeCheck className="w-4 h-4 fill-emerald-500/20 text-emerald-400" />
                Verified Artist
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight truncate drop-shadow-sm">
              {artist.name}
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-zinc-400">
              {artist.monthlyListeners && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  {artist.monthlyListeners}
                </span>
              )}
              {artist.subscribers && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-zinc-400" />
                  {artist.subscribers}
                </span>
              )}
              {artist.albums.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Disc className="w-4 h-4 text-zinc-400" />
                  {artist.albums.length} Albums
                </span>
              )}
              {allSongsList.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-zinc-400" />
                  {allSongsList.length}+ Songs
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                onClick={() => (isCurrentArtistPlaying ? togglePlay() : handlePlayArtist(false))}
                data-focusable="true"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
              >
                {isCurrentArtistPlaying ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Play Artist
                  </>
                )}
              </button>

              <button
                onClick={() => handlePlayArtist(true)}
                data-focusable="true"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 border border-white/10"
                title="Shuffle Artist Discography"
              >
                <Shuffle className="w-4 h-4" />
                Shuffle
              </button>

              <button
                onClick={toggleFollow}
                data-focusable="true"
                className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-full font-bold text-sm transition-all border ${
                  isFollowing
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFollowing ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>

              <button
                onClick={handleShare}
                data-focusable="true"
                className="p-3.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-all hover:scale-105"
                title="Copy artist profile link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'songs', label: `All Songs (${allSongsList.length})` },
          { key: 'albums', label: `Albums (${artist.albums.length})` },
          { key: 'singles', label: `Singles & EPs (${artist.singles.length})` },
          ...(artist.similarArtists && artist.similarArtists.length > 0
            ? [{ key: 'similar', label: `Similar Artists` }]
            : []),
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            data-focusable="true"
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
              activeTab === tab.key
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-12">
          {/* Popular Songs */}
          {visibleTopSongs.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Popular Tracks</h2>
                {allSongsList.length > 5 && (
                  <button
                    onClick={() => setShowAllTopSongs((p) => !p)}
                    data-focusable="true"
                    className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    {showAllTopSongs ? (
                      <>
                        Show less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-1 bg-white/[0.01] border border-white/5 rounded-2xl p-2 sm:p-3">
                {visibleTopSongs.map((song, idx) => (
                  <TrackRow
                    key={`${song.id}-${idx}`}
                    track={song}
                    index={idx}
                    queue={allSongsList}
                    showIndex
                  />
                ))}
              </div>

              {allSongsList.length > 20 && (
                <button
                  onClick={() => setActiveTab('songs')}
                  data-focusable="true"
                  className="w-full py-3 text-center rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-sm font-semibold text-emerald-400 border border-white/5 transition-all"
                >
                  View full catalog ({allSongsList.length} tracks) &rarr;
                </button>
              )}
            </section>
          )}

          {/* Albums Section */}
          {artist.albums.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Albums</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Full-length studio albums and live records</p>
                </div>
                <button
                  onClick={() => setActiveTab('albums')}
                  data-focusable="true"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  See all ({artist.albums.length})
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {artist.albums.map((alb) => (
                  <Link
                    key={alb.id}
                    href={`/album/${encodeURIComponent(alb.id)}`}
                    data-focusable="true"
                    className="group relative p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all hover:shadow-xl"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                      {alb.thumbnail ? (
                        <img
                          src={alb.thumbnail}
                          alt={alb.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Disc className="w-12 h-12 text-zinc-700" />
                        </div>
                      )}
                      <button
                        onClick={(e) => handlePlayAlbum(e, alb)}
                        data-focusable="true"
                        className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
                        title="Play Album"
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>

                    <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {alb.title}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {alb.year ? `Album • ${alb.year}` : 'Album'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Singles & EPs Section */}
          {artist.singles.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Singles & EPs</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Standalone releases and extended plays</p>
                </div>
                <button
                  onClick={() => setActiveTab('singles')}
                  data-focusable="true"
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  See all ({artist.singles.length})
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {artist.singles.slice(0, 5).map((single) => (
                  <Link
                    key={single.id}
                    href={`/album/${encodeURIComponent(single.id)}`}
                    data-focusable="true"
                    className="group relative p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all hover:shadow-xl"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                      {single.thumbnail ? (
                        <img
                          src={single.thumbnail}
                          alt={single.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Disc className="w-12 h-12 text-zinc-700" />
                        </div>
                      )}
                      <button
                        onClick={(e) => handlePlayAlbum(e, single)}
                        data-focusable="true"
                        className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
                        title="Play Single"
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    </div>

                    <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                      {single.title}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {single.year ? single.year : 'Single'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Featured On Playlists */}
          {artist.featuredOn && artist.featuredOn.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Featured On</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Playlists and compilations including {artist.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {artist.featuredOn.slice(0, 5).map((pl) => (
                  <Link
                    key={pl.id}
                    href={`/playlist/${encodeURIComponent(pl.id)}`}
                    data-focusable="true"
                    className="group p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 transition-all"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3">
                      {pl.thumbnail && (
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <p className="text-sm font-bold text-white truncate">{pl.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{pl.author || 'Playlist'}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Similar Artists */}
          {artist.similarArtists && artist.similarArtists.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Fans Also Like</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Artists with a similar sound and vibe</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {artist.similarArtists.slice(0, 6).map((sim) => (
                  <Link
                    key={sim.id}
                    href={`/artist/${encodeURIComponent(sim.id)}`}
                    data-focusable="true"
                    className="group p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 transition-all text-center space-y-3"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full overflow-hidden bg-zinc-800 shadow-md">
                      {sim.thumbnail ? (
                        <img
                          src={sim.thumbnail}
                          alt={sim.name}
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
                      <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {sim.name}
                      </p>
                      {sim.subscribers && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{sim.subscribers}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bio / Description */}
          {artist.description && (
            <section className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <h3 className="text-lg font-bold text-white">About {artist.name}</h3>
              <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed max-w-4xl">
                {artist.description}
              </p>
            </section>
          )}
        </div>
      )}

      {/* ── TAB 2: ALL SONGS ───────────────────────────────────────────────── */}
      {activeTab === 'songs' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-white">All Tracks</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Complete catalog of {allSongsList.length} songs
              </p>
            </div>

            {/* Quick search filter */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search artist songs..."
                value={songSearchQuery}
                onChange={(e) => setSongSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1 bg-white/[0.01] border border-white/5 rounded-2xl p-2 sm:p-3">
            {filteredAllSongs.map((song, idx) => (
              <TrackRow
                key={`${song.id}-${idx}`}
                track={song}
                index={idx}
                queue={filteredAllSongs}
                showIndex
              />
            ))}
            {filteredAllSongs.length === 0 && (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No songs matched "{songSearchQuery}"
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TAB 3: ALBUMS ─────────────────────────────────────────────────── */}
      {activeTab === 'albums' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Albums</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Full studio releases</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artist.albums.map((alb) => (
              <Link
                key={alb.id}
                href={`/album/${encodeURIComponent(alb.id)}`}
                data-focusable="true"
                className="group relative p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all hover:shadow-xl"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                  {alb.thumbnail ? (
                    <img
                      src={alb.thumbnail}
                      alt={alb.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-12 h-12 text-zinc-700" />
                    </div>
                  )}
                  <button
                    onClick={(e) => handlePlayAlbum(e, alb)}
                    data-focusable="true"
                    className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>

                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {alb.title}
                </p>
                <p className="text-xs text-zinc-400 mt-1">{alb.year ? `Album • ${alb.year}` : 'Album'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 4: SINGLES & EPS ───────────────────────────────────────────── */}
      {activeTab === 'singles' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Singles & EPs</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Extended plays and standalone hits</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artist.singles.map((single) => (
              <Link
                key={single.id}
                href={`/album/${encodeURIComponent(single.id)}`}
                data-focusable="true"
                className="group relative p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 hover:border-white/10 transition-all hover:shadow-xl"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                  {single.thumbnail ? (
                    <img
                      src={single.thumbnail}
                      alt={single.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-12 h-12 text-zinc-700" />
                    </div>
                  )}
                  <button
                    onClick={(e) => handlePlayAlbum(e, single)}
                    data-focusable="true"
                    className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>

                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {single.title}
                </p>
                <p className="text-xs text-zinc-400 mt-1">{single.year ? single.year : 'Single'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 5: SIMILAR ARTISTS ─────────────────────────────────────────── */}
      {activeTab === 'similar' && artist.similarArtists && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Fans Also Like</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Explore related artists and collaborators</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {artist.similarArtists.map((sim) => (
              <Link
                key={sim.id}
                href={`/artist/${encodeURIComponent(sim.id)}`}
                data-focusable="true"
                className="group p-5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/90 border border-white/5 transition-all text-center space-y-3"
              >
                <div className="w-28 h-28 sm:w-36 sm:h-36 mx-auto rounded-full overflow-hidden bg-zinc-800 shadow-md">
                  {sim.thumbnail ? (
                    <img
                      src={sim.thumbnail}
                      alt={sim.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-zinc-600" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-base font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                    {sim.name}
                  </p>
                  {sim.subscribers && (
                    <p className="text-xs text-zinc-400 mt-1 truncate">{sim.subscribers}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
