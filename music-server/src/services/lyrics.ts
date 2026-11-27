import { getInnertube } from './innertube.js';
import type { LyricsResponse, SyncedLyricLine } from '../types/index.js';

const lyricsCache = new Map<string, LyricsResponse>();

/**
 * Parse raw LRC string into structured timed lines
 * Example line: [01:23.45] Some lyric text
 */
export function parseLrc(lrcText: string): SyncedLyricLine[] {
  const lines = lrcText.split(/\r?\n/);
  const result: SyncedLyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1] || '0', 10);
      const seconds = parseInt(match[2] || '0', 10);
      const centisecs = parseInt(match[3] || '0', 10);
      const ms = minutes * 60000 + seconds * 1000 + (match[3]?.length === 2 ? centisecs * 10 : centisecs);
      const text = (match[4] || '').trim();

      result.push({
        time: ms,
        timestamp: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centisecs).padStart(2, '0')}`,
        text
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(
  videoId: string,
  trackTitle?: string,
  artistName?: string,
  duration?: number
): Promise<LyricsResponse> {
  const cached = lyricsCache.get(videoId);
  if (cached) {
    return cached;
  }

  let title = trackTitle;
  let artist = artistName;
  let dur = duration;

  // If title/artist not supplied, resolve via InnerTube getBasicInfo
  if (!title || !artist) {
    try {
      const yt = await getInnertube();
      const info = await yt.getBasicInfo(videoId);
      title = title || info.basic_info.title;
      artist = artist || info.basic_info.author;
      dur = dur || info.basic_info.duration;
    } catch (e: any) {
      console.warn(`[Lyrics] Could not fetch basic info for ${videoId}:`, e.message);
    }
  }

  // 1. Try LRCLIB exact match
  if (title && artist) {
    try {
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|feat\..*|ft\..*/gi, '').trim();
      const cleanArtist = artist.replace(/\(.*?\)|\[.*?\]/gi, '').trim();

      const url = new URL('https://lrclib.net/api/get');
      url.searchParams.set('track_name', cleanTitle);
      url.searchParams.set('artist_name', cleanArtist);
      if (dur) url.searchParams.set('duration', Math.round(dur).toString());

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'FroshMusic/1.0.0 (https://github.com/frosh-music)'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const hasSynced = !!data.syncedLyrics;
        const parsedSynced = hasSynced ? parseLrc(data.syncedLyrics) : undefined;

        const response: LyricsResponse = {
          videoId,
          trackName: data.trackName || title,
          artistName: data.artistName || artist,
          source: 'lrclib',
          isSynced: hasSynced,
          plainLyrics: data.plainLyrics || undefined,
          syncedLyrics: parsedSynced
        };

        lyricsCache.set(videoId, response);
        return response;
      }
    } catch (e: any) {
      console.warn(`[Lyrics] LRCLIB exact match error:`, e.message);
    }

    // 2. Try LRCLIB search query
    try {
      const searchUrl = new URL('https://lrclib.net/api/search');
      searchUrl.searchParams.set('q', `${title} ${artist}`);

      const res = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'FroshMusic/1.0.0 (https://github.com/frosh-music)'
        }
      });

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          // Prefer one with synced lyrics
          const match = items.find((item: any) => item.syncedLyrics) || items[0];
          const hasSynced = !!match.syncedLyrics;
          const parsedSynced = hasSynced ? parseLrc(match.syncedLyrics) : undefined;

          const response: LyricsResponse = {
            videoId,
            trackName: match.trackName || title,
            artistName: match.artistName || artist,
            source: 'lrclib',
            isSynced: hasSynced,
            plainLyrics: match.plainLyrics || undefined,
            syncedLyrics: parsedSynced
          };

          lyricsCache.set(videoId, response);
          return response;
        }
      }
    } catch (e: any) {
      console.warn(`[Lyrics] LRCLIB search error:`, e.message);
    }
  }

  // 3. Fallback: InnerTube native lyrics
  try {
    const yt = await getInnertube();
    const lyricsTab = await yt.music.getLyrics(videoId);
    if (lyricsTab?.description?.text) {
      const response: LyricsResponse = {
        videoId,
        trackName: title,
        artistName: artist,
        source: 'innertube',
        isSynced: false,
        plainLyrics: lyricsTab.description.text
      };
      lyricsCache.set(videoId, response);
      return response;
    }
  } catch (e: any) {
    // InnerTube lyrics may not be present for all tracks
  }

  const notFound: LyricsResponse = {
    videoId,
    trackName: title,
    artistName: artist,
    source: 'none',
    isSynced: false
  };

  lyricsCache.set(videoId, notFound);
  return notFound;
}
