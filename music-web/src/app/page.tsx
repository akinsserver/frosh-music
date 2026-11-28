'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Play,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  Users,
  Flame,
  TrendingUp,
  Radio,
} from 'lucide-react';
import { fetchHome, isSongItem } from '@/lib/api';
import type { HomeShelf, Song, HomeCardItem } from '@/types/music';
import { useLibrary } from '@/context/LibraryContext';
import {
  fetchPersonalizedRecommendations,
  fetchCommunityTrending,
  fetchTopReleasesThisWeek,
  detectUserTopGenre,
  fetchGenreTrending,
  resolveSongArtists,
  getArtistOrPodcastHref,
  getCurrentSeasonalTheme,
  type RecommendationResult,
} from '@/lib/recommendations';
import { SongBoxCard } from '@/components/SongBoxCard';
import { ShelfCarousel } from '@/components/ShelfCarousel';
import { SettingsModal } from '@/components/SettingsModal';
import { getAvatarById } from '@/lib/avatars';

export default function HomePage() {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; avatarId: string }>({
    name: '',
    avatarId: 'neon-beats',
  });

  const [personalizedRecs, setPersonalizedRecs] = useState<RecommendationResult | null>(null);
  const [communitySongs, setCommunitySongs] = useState<Song[]>([]);
  const [topReleases, setTopReleases] = useState<Song[]>([]);
  const [genreTrending, setGenreTrending] = useState<{ genre: string; songs: Song[] } | null>(null);

  const { history, likedSongs, playEvents } = useLibrary();

  // Load user profile for top-right avatar
  useEffect(() => {
    try {
      const cached = localStorage.getItem('vyla_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        setUserProfile({
          name: parsed.display_name || '',
          avatarId: parsed.avatar_id || 'neon-beats',
        });
      }
    } catch {}

    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user;
        if (user) {
          const metaName = user.user_metadata?.display_name || user.user_metadata?.full_name || '';
          const metaAvatar = user.user_metadata?.avatar_id || 'neon-beats';
          setUserProfile({ name: metaName, avatarId: metaAvatar });
        }
      })
      .catch(() => {});
  }, []);

  const userAvatar = getAvatarById(userProfile.avatarId);

  // 1. Fetch server home shelves
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

  // 2. Fetch personalized recommendations based on user listening taste
  useEffect(() => {
    let mounted = true;
    if (history.length === 0 && likedSongs.length === 0 && playEvents.length === 0) {
      setPersonalizedRecs(null);
      return;
    }

    fetchPersonalizedRecommendations(history, likedSongs, playEvents).then((recs) => {
      if (mounted) setPersonalizedRecs(recs);
    });

    return () => {
      mounted = false;
    };
  }, [history.length, likedSongs.length, playEvents.length]);

  // 3. Fetch community trending songs from Supabase ecosystem
  useEffect(() => {
    let mounted = true;
    fetchCommunityTrending(15).then((songs) => {
      if (mounted && songs.length > 0) {
        setCommunitySongs(songs);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // 4. Fetch Top Releases & Trending Hits this week (global millions of streams)
  useEffect(() => {
    let mounted = true;
    fetchTopReleasesThisWeek(16).then((songs) => {
      if (mounted && songs.length > 0) {
        setTopReleases(songs);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // 5. Fetch Trending in the user's favorite genre (e.g. Afrobeats, Hip Hop, etc.)
  useEffect(() => {
    let mounted = true;
    const genre = detectUserTopGenre(history, likedSongs, playEvents);
    fetchGenreTrending(genre, 16).then((songs) => {
      if (mounted && songs.length > 0) {
        setGenreTrending({ genre, songs });
      }
    });

    return () => {
      mounted = false;
    };
  }, [history.length, likedSongs.length, playEvents.length]);

  return (
    <div className="space-y-8 pb-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Home</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            data-focusable="true"
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-zinc-200 transition-all"
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Search songs, albums, artists...</span>
            <span className="sm:hidden">Search</span>
          </Link>

          {/* Top-Right Avatar Button (Click to open Settings) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            data-focusable="true"
            className="relative flex items-center justify-center p-0.5 rounded-2xl ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer shrink-0"
            title={userProfile.name ? `${userProfile.name} (Settings)` : 'Settings & Profile'}
            aria-label="Settings and Profile"
          >
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${userAvatar.gradient} flex items-center justify-center text-lg sm:text-xl shadow-inner border border-white/20 overflow-hidden`}
            >
              {userAvatar.imageUrl ? (
                <img src={userAvatar.imageUrl} alt={userAvatar.name} className="w-full h-full object-cover" />
              ) : (
                userAvatar.emoji
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 1. Continue Listening (Swipeable Horizontal Box Form) */}
      {history.length > 0 && (
        <ShelfCarousel
          title="Continue Listening"
          subtitle="Pick up right where you left off"
          icon={<Sparkles className="w-4 h-4 text-emerald-400" />}
        >
          {history.slice(0, 15).map((song) => (
            <SongBoxCard key={`history-${song.id}`} song={song} queue={history} />
          ))}
        </ShelfCarousel>
      )}

      {/* 2. Top Releases & Hits (This Week's Global Bestsellers & New Releases) */}
      {topReleases.length > 0 && (
        <ShelfCarousel
          title="Top Releases & Hits"
          subtitle="The most streamed tracks and major releases trending worldwide this week"
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        >
          {topReleases.map((song) => (
            <SongBoxCard key={`top-${song.id}`} song={song} queue={topReleases} />
          ))}
        </ShelfCarousel>
      )}

      {/* 3. Trending in Favorite Genre (Tailored to User's Style, e.g. Afrobeats, Hip Hop) */}
      {genreTrending && genreTrending.songs.length > 0 && (
        <ShelfCarousel
          title={`Trending in ${genreTrending.genre}`}
          subtitle={`Hottest releases and top weekly streams in ${genreTrending.genre}`}
          icon={<Radio className="w-4 h-4 text-emerald-400" />}
        >
          {genreTrending.songs.map((song) => (
            <SongBoxCard
              key={`genre-${genreTrending.genre}-${song.id}`}
              song={song}
              queue={genreTrending.songs}
            />
          ))}
        </ShelfCarousel>
      )}

      {/* 4. You May Also Like (Tailored Algorithmic Recommendations with Clickable Artists) */}
      {personalizedRecs && personalizedRecs.songs.length > 0 && (
        <ShelfCarousel
          title={personalizedRecs.shelfTitle}
          subtitle={
            <span>
              Tailored for you based on{' '}
              {personalizedRecs.topArtists.map((artist, idx) => (
                <React.Fragment key={`${artist.name}-${idx}`}>
                  {idx > 0 && ' & '}
                  <Link
                    href={getArtistOrPodcastHref(artist)}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline decoration-emerald-500/40 hover:decoration-emerald-400 transition-colors"
                  >
                    {artist.name}
                  </Link>
                </React.Fragment>
              ))}
            </span>
          }
          icon={<Flame className="w-4 h-4 text-emerald-400" />}
        >
          {personalizedRecs.songs.map((song) => (
            <SongBoxCard
              key={`rec-${song.id}`}
              song={song}
              queue={personalizedRecs.songs}
            />
          ))}
        </ShelfCarousel>
      )}

      {/* 5. Other Users Liked (Supabase Ecosystem Community Favorites) */}
      {communitySongs.length > 0 && (
        <ShelfCarousel
          title="Other Users Liked"
          subtitle="Trending across the Frosh Music community"
          icon={<Users className="w-4 h-4 text-emerald-400" />}
        >
          {communitySongs.map((song) => (
            <SongBoxCard
              key={`community-${song.id}`}
              song={song}
              queue={communitySongs}
            />
          ))}
        </ShelfCarousel>
      )}

      {/* Loading / Error State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Curating your personalized music feed...</p>
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

      {/* 6. Categorized Home Shelves (Swipeable Horizontal Form with Dynamic Seasonal Adaptation) */}
      {!loading &&
        shelves.map((shelf, idx) => {
          const songItems = shelf.items.filter(isSongItem) as Song[];
          const cardItems = shelf.items.filter((i) => !isSongItem(i)) as HomeCardItem[];

          // Dynamic seasonal adaptation for holiday/seasonal shelves
          const seasonalTheme = getCurrentSeasonalTheme();
          const isHolidayShelf =
            shelf.title.toLowerCase().includes('holiday') ||
            shelf.title.toLowerCase().includes('christmas');
          const displayTitle = isHolidayShelf ? seasonalTheme.title : shelf.title;
          const displaySubtitle = isHolidayShelf ? seasonalTheme.subtitle : shelf.subtitle;

          return (
            <ShelfCarousel
              key={`${shelf.title}-${idx}`}
              title={displayTitle}
              subtitle={displaySubtitle}
            >
              {songItems.length > 0 &&
                songItems.map((song) => (
                  <SongBoxCard
                    key={`shelf-${shelf.title}-${song.id}`}
                    song={song}
                    queue={songItems}
                    fallbackContext={displayTitle}
                  />
                ))}

              {cardItems.length > 0 &&
                cardItems.map((card, cIdx) => {
                  const href =
                    card.type === 'album'
                      ? `/album/${encodeURIComponent(card.id)}`
                      : card.type === 'artist'
                      ? getArtistOrPodcastHref(card)
                      : `/playlist/${encodeURIComponent(card.id)}`;

                  return (
                    <Link
                      key={`${card.id}-${cIdx}`}
                      href={href}
                      data-focusable="true"
                      className="group w-36 sm:w-44 shrink-0 snap-start flex flex-col p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-[0.98] border border-white/5 transition-all"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-800 mb-2.5 shadow-md">
                        {card.thumbnail ? (
                          <img
                            src={card.thumbnail}
                            alt={card.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-600 font-bold text-lg">
                            {card.type === 'artist' ? '👤' : '🎵'}
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105 transition-all shadow-xl">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {card.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {card.subtitle || card.type}
                      </p>
                    </Link>
                  );
                })}
            </ShelfCarousel>
          );
        })}

      {/* Settings & Profile Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdated={(updated) => setUserProfile(updated)}
      />
    </div>
  );
}
