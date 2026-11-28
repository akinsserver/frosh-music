import type { Album, Artist, HomeShelf, LyricsResponse, Playlist, SearchAllResponse, Song } from '@/types/music';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_MUSIC_API_URL?.replace(/\/$/, '') || '';

export function getStreamUrl(videoId: string): string {
  return `${API_BASE_URL}/api/stream/${encodeURIComponent(videoId)}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`API error (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function fetchHome(): Promise<{ shelves: HomeShelf[] }> {
  return fetchJson('/api/home');
}

export async function searchMusic(
  query: string,
  type: 'all' | 'song' | 'album' | 'artist' | 'podcast' = 'all'
): Promise<SearchAllResponse | { type: string; results: any[] }> {
  const params = new URLSearchParams({ q: query, type });
  return fetchJson(`/api/search?${params.toString()}`);
}

export async function fetchAlbum(id: string): Promise<Album> {
  return fetchJson(`/api/album/${encodeURIComponent(id)}`);
}

export async function fetchArtist(id: string): Promise<Artist> {
  return fetchJson(`/api/artist/${encodeURIComponent(id)}`);
}

export async function fetchPlaylist(id: string): Promise<Playlist> {
  return fetchJson(`/api/playlist/${encodeURIComponent(id)}`);
}

export async function fetchLyrics(
  videoId: string,
  title?: string,
  artist?: string,
  duration?: number
): Promise<LyricsResponse> {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  if (duration) params.set('duration', Math.round(duration).toString());
  const qs = params.toString();
  return fetchJson(`/api/lyrics/${encodeURIComponent(videoId)}${qs ? `?${qs}` : ''}`);
}

export async function checkServerHealth(): Promise<{ status: string; uptime: number }> {
  return fetchJson('/api/health');
}

export function isSongItem(item: Song | any): item is Song {
  return typeof item?.duration === 'number' && Array.isArray(item?.artists);
}
