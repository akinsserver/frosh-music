import type { Song, PlayHistoryEvent } from '@/types/music';
import { searchMusic } from '@/lib/api';
import { createClient } from '@/lib/supabase';

export interface ArtistAffinity {
  name: string;
  id?: string;
  score: number;
}

export interface RecommendationResult {
  shelfTitle: string;
  subtitle: string;
  songs: Song[];
  topArtists: string[];
}

/**
 * Robustly resolves artist names for any song item.
 * If artists is missing or only contains "Unknown Artist", tries:
 * 1. Splitting from title ("Artist - Song Title")
 * 2. Playlist / Album fallback context ("Presenting Asake" -> "Asake")
 */
export function resolveSongArtists(
  song: { title: string; artists?: { id?: string; name: string }[] },
  fallbackContext?: string
): { id?: string; name: string }[] {
  const currentArtists = song.artists || [];
  const valid = currentArtists.filter(
    (a) => a && a.name && a.name.trim() !== '' && a.name.toLowerCase() !== 'unknown artist'
  );
  if (valid.length > 0) return valid;

  // 1. Check title for "Artist - Title" pattern
  const rawTitle = song.title || '';
  if (rawTitle.includes(' - ') || rawTitle.includes(' – ') || rawTitle.includes(' — ')) {
    const parts = rawTitle.split(/\s*[-–—]\s*/);
    if (parts.length >= 2 && parts[0].trim()) {
      return [{ name: parts[0].trim() }];
    }
  }

  // 2. Check playlist fallback context (e.g. "Presenting Asake" -> "Asake")
  if (fallbackContext) {
    const match = fallbackContext.match(/(?:presenting|this is|best of|essentials of)\s+(.+)/i);
    if (match && match[1]) {
      return [{ name: match[1].trim() }];
    }
    if (!fallbackContext.toLowerCase().includes('playlist')) {
      return [{ name: fallbackContext.trim() }];
    }
  }

  return [{ name: 'Various Artists' }];
}

/**
 * Computes the user's top artists by combining:
 * 1. Liked songs (+5 score)
 * 2. Recent listening history (+2 score, +4 if in last 7 days)
 * 3. Total stream events
 */
export function getUserTasteProfile(
  history: Song[] = [],
  likedSongs: Song[] = [],
  playEvents: PlayHistoryEvent[] = []
): ArtistAffinity[] {
  const scores = new Map<string, { name: string; id?: string; score: number }>();
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  // 1. Process Liked Songs (strongest positive signal)
  for (const song of likedSongs) {
    if (!song.artists) continue;
    for (const artist of song.artists) {
      if (!artist.name || artist.name.toLowerCase() === 'unknown artist') continue;
      const key = artist.name.toLowerCase().trim();
      const existing = scores.get(key) || { name: artist.name, id: artist.id, score: 0 };
      existing.score += 5;
      if (artist.id && !existing.id) existing.id = artist.id;
      scores.set(key, existing);
    }
  }

  // 2. Process Play Events (frequency & recency)
  for (const event of playEvents) {
    if (!event.artists) continue;
    const isRecent = now - event.timestamp < SEVEN_DAYS_MS;
    const weight = isRecent ? 4 : 2;
    for (const artist of event.artists) {
      if (!artist.name || artist.name.toLowerCase() === 'unknown artist') continue;
      const key = artist.name.toLowerCase().trim();
      const existing = scores.get(key) || { name: artist.name, id: artist.id, score: 0 };
      existing.score += weight;
      if (artist.id && !existing.id) existing.id = artist.id;
      scores.set(key, existing);
    }
  }

  // 3. Process History (fallback if playEvents is small)
  for (const song of history) {
    if (!song.artists) continue;
    for (const artist of song.artists) {
      if (!artist.name || artist.name.toLowerCase() === 'unknown artist') continue;
      const key = artist.name.toLowerCase().trim();
      const existing = scores.get(key) || { name: artist.name, id: artist.id, score: 0 };
      existing.score += 1.5;
      if (artist.id && !existing.id) existing.id = artist.id;
      scores.set(key, existing);
    }
  }

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

/**
 * Detects the user's favorite musical genre based on listening taste profile
 */
export function detectUserTopGenre(
  history: Song[] = [],
  likedSongs: Song[] = [],
  playEvents: PlayHistoryEvent[] = []
): string {
  const affinities = getUserTasteProfile(history, likedSongs, playEvents);
  const artistNames = affinities.map((a) => a.name.toLowerCase());

  const AFROBEATS = [
    'asake', 'wizkid', 'burna boy', 'davido', 'tiwa savage', 'rema', 'olamide',
    'ayra starr', 'fireboy dml', 'blaqbonez', 'tems', 'kizz daniel', 'seyi vibez',
    'ruger', 'victony', 'ckay', 'joeboy', 'bnxn', 'shallipopi', 'flavour', 'omah lay',
  ];

  const HIP_HOP = [
    'drake', '21 savage', 'travis scott', 'metro boomin', 'kendrick lamar',
    'future', 'kanye west', 'lil baby', 'eminem', 'j. cole', 'playboi carti',
    'lil wayne', 'gunna', 'young thug', 'dr. dre', 'snoop dogg', '50 cent',
  ];

  const RNB = [
    'the weeknd', 'sza', 'frank ocean', 'chris brown', 'brent faiyaz',
    'daniel caesar', 'summer walker', 'bryson tiller', 'giveon', 'partynextdoor',
  ];

  const POP = [
    'taylor swift', 'billie eilish', 'ariana grande', 'justin bieber', 'dua lipa',
    'bruno mars', 'ed sheeran', 'olivia rodrigo', 'harry styles', 'rihanna',
    'sabrina carpenter', 'michael jackson',
  ];

  for (const name of artistNames) {
    if (AFROBEATS.some((a) => name.includes(a))) return 'Afrobeats';
    if (HIP_HOP.some((a) => name.includes(a))) return 'Hip Hop';
    if (RNB.some((a) => name.includes(a))) return 'R&B';
    if (POP.some((a) => name.includes(a))) return 'Pop';
  }

  return 'Afrobeats'; // Default genre if no history yet
}

/**
 * Fetches "You May Also Like" personalized recommendations
 */
export async function fetchPersonalizedRecommendations(
  history: Song[] = [],
  likedSongs: Song[] = [],
  playEvents: PlayHistoryEvent[] = []
): Promise<RecommendationResult | null> {
  const affinities = getUserTasteProfile(history, likedSongs, playEvents);
  if (affinities.length === 0) return null;

  const topArtists = affinities.slice(0, 2);
  const knownSongIds = new Set([
    ...history.map((s) => s.id),
    ...likedSongs.map((s) => s.id),
  ]);

  const candidatePool: Song[] = [];

  for (const artist of topArtists) {
    try {
      const res = await searchMusic(artist.name, 'song');
      const results = (res as any)?.results || [];
      for (const track of results) {
        if (track && track.id && !knownSongIds.has(track.id)) {
          candidatePool.push(track);
        }
      }
    } catch (err) {
      console.warn(`[RecEngine] Failed search for ${artist.name}:`, err);
    }
  }

  if (candidatePool.length === 0) return null;

  const seenIds = new Set<string>();
  const uniqueCandidates: Song[] = [];
  for (const song of candidatePool) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id);
      uniqueCandidates.push(song);
    }
    if (uniqueCandidates.length >= 14) break;
  }

  const artistNames = topArtists.map((a) => a.name).join(' & ');

  return {
    shelfTitle: 'You May Also Like',
    subtitle: `Tailored for you based on ${artistNames}`,
    songs: uniqueCandidates,
    topArtists: topArtists.map((a) => a.name),
  };
}

/**
 * Fetches Top Releases & Trending Hits this week (with millions of views/streams)
 */
export async function fetchTopReleasesThisWeek(limit: number = 15): Promise<Song[]> {
  try {
    const res = await searchMusic('Trending Songs This Week', 'song');
    const results = (res as any)?.results || [];
    return results.slice(0, limit);
  } catch (err) {
    console.warn('[TopReleases] Failed to fetch top releases:', err);
    return [];
  }
}

/**
 * Fetches trending songs in the user's favorite genre
 */
export async function fetchGenreTrending(genre: string, limit: number = 15): Promise<Song[]> {
  try {
    const res = await searchMusic(`Trending ${genre} Hits`, 'song');
    const results = (res as any)?.results || [];
    return results.slice(0, limit);
  } catch (err) {
    console.warn(`[GenreTrending] Failed to fetch trending for ${genre}:`, err);
    return [];
  }
}

/**
 * Fetches "Other Users Liked" from Supabase ecosystem
 */
export async function fetchCommunityTrending(limit: number = 15): Promise<Song[]> {
  try {
    const supabase = createClient();
    if (!supabase) return [];

    const { data, error } = await supabase.rpc('get_community_trending_songs', {
      p_limit: limit,
    });

    if (error) {
      console.warn('[CommunityRecs] RPC error:', error);
      return [];
    }

    if (Array.isArray(data)) {
      return data.filter((s: any) => s && s.id && s.title) as Song[];
    }
    return [];
  } catch (err) {
    console.warn('[CommunityRecs] Fetch error:', err);
    return [];
  }
}
