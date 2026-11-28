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
 * Fetches "You May Also Like" personalized recommendations
 * Queries related songs based on the user's top affinities, filtering out already known tracks.
 */
export async function fetchPersonalizedRecommendations(
  history: Song[] = [],
  likedSongs: Song[] = [],
  playEvents: PlayHistoryEvent[] = []
): Promise<RecommendationResult | null> {
  const affinities = getUserTasteProfile(history, likedSongs, playEvents);
  if (affinities.length === 0) return null;

  // Select top 1 to 2 artists
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

  // Interleave and take up to 14 tracks
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
 * Fetches "Other Users Liked" from Supabase ecosystem
 * Aggregates listening and likes across all user libraries.
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
