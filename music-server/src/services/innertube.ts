import { Innertube, UniversalCache } from 'youtubei.js';
import type { Song, Album, Artist, Playlist, ArtistReference, ThumbnailItem } from '../types/index.js';

let innertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

export async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) {
    return innertubeInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('[InnerTube] Initializing YouTube.js client...');
      const yt = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
      innertubeInstance = yt;
      console.log('[InnerTube] Client initialized successfully.');
      return yt;
    } catch (error) {
      console.error('[InnerTube] Initialization failed:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Upgrade YouTube Music thumbnail URLs to higher resolution (e.g. 544x544 or 1080x1080)
 */
export function upgradeThumbnailUrl(url?: string, size = 544): string {
  if (!url) return '';
  if (url.includes('=w') && url.includes('-h')) {
    return url.replace(/=w\d+-h\d+[^=]*/, `=w${size}-h${size}-l90-rj`);
  }
  return url;
}

/**
 * Normalize duration string (e.g. "3:45") to seconds
 */
export function parseDuration(durationStr?: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

/**
 * Extract best thumbnail URL from any thumbnail payload (Array, MusicThumbnail, object with contents, or string)
 */
export function getBestThumbnail(input: any): { bestUrl: string; list: ThumbnailItem[] } {
  if (!input) return { bestUrl: '', list: [] };

  let rawList: any[] = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (Array.isArray(input.contents)) {
    rawList = input.contents;
  } else if (Array.isArray(input.thumbnails)) {
    rawList = input.thumbnails;
  } else if (input.url) {
    rawList = [input];
  } else if (typeof input === 'string') {
    return { bestUrl: upgradeThumbnailUrl(input), list: [{ url: input }] };
  }

  if (rawList.length === 0) {
    return { bestUrl: '', list: [] };
  }

  const list: ThumbnailItem[] = rawList
    .map((t: any) => ({
      url: typeof t === 'string' ? t : t?.url || '',
      width: t?.width,
      height: t?.height,
    }))
    .filter((t) => Boolean(t.url));

  if (list.length === 0) {
    return { bestUrl: '', list: [] };
  }

  // Find the largest thumbnail by dimensions or fallback to last item
  let best = list[0].url;
  let maxDim = 0;
  for (const item of list) {
    const dim = (item.width || 0) * (item.height || 0);
    if (dim > maxDim) {
      maxDim = dim;
      best = item.url;
    }
  }

  return {
    bestUrl: upgradeThumbnailUrl(best || list[list.length - 1]?.url),
    list,
  };
}

/**
 * Format a raw InnerTube track item into a clean Song model
 */
export function formatTrackItem(item: any, fallbackContext?: string): Song | null {
  if (!item) return null;

  const id = item.id || item.video_id;
  if (!id) return null;

  let title = typeof item.title === 'string' ? item.title : item.title?.text || 'Unknown Title';

  const artists: ArtistReference[] = [];

  // 1. Direct artists array
  if (Array.isArray(item.artists)) {
    for (const a of item.artists) {
      const name = a?.name || a?.text;
      if (name && name !== 'Unknown Artist') {
        artists.push({
          id: a.channel_id || a.id || a.endpoint?.payload?.browseId,
          name,
        });
      }
    }
  }

  // 2. Direct authors array (plural)
  if (artists.length === 0 && Array.isArray(item.authors)) {
    for (const a of item.authors) {
      const name = a?.name || a?.text;
      if (name && name !== 'Unknown Artist') {
        artists.push({
          id: a.channel_id || a.id || a.endpoint?.payload?.browseId,
          name,
        });
      }
    }
  }

  // 3. Single author
  if (artists.length === 0 && item.author) {
    const name = typeof item.author === 'string' ? item.author : item.author.name || item.author.text;
    if (name && name !== 'Unknown Artist') {
      artists.push({
        id: item.author.channel_id || item.author.id || item.author.endpoint?.payload?.browseId,
        name,
      });
    }
  }

  // 4. Uploader or Channel
  if (artists.length === 0 && (item.uploader || item.channel)) {
    const target = item.uploader || item.channel;
    const name = typeof target === 'string' ? target : target.name || target.text || target.title;
    if (name && name !== 'Unknown Artist') {
      artists.push({
        id: target.id || target.channel_id,
        name,
      });
    }
  }

  // 5. flex_columns runs (Column 1 is almost always Artist in InnerTube MusicResponsiveListItem)
  if (artists.length === 0 && Array.isArray(item.flex_columns) && item.flex_columns[1]) {
    const col = item.flex_columns[1];
    const runs = col?.title?.runs || col?.runs;
    if (Array.isArray(runs)) {
      for (const r of runs) {
        const text = r?.text?.trim();
        if (
          text &&
          !/^[•·|]\s*$/.test(text) &&
          !/^\d+(?:\.\d+)?[KMB]?\s+(?:plays|views)$/i.test(text) &&
          !/^\d+:\d+$/.test(text) &&
          text !== 'Unknown Artist'
        ) {
          artists.push({ id: r.endpoint?.payload?.browseId, name: text });
          break;
        }
      }
    } else if (col?.title?.text) {
      const parts = col.title.text.split(/•|·|\|/);
      if (parts[0]?.trim() && parts[0].trim() !== 'Unknown Artist') {
        artists.push({ name: parts[0].trim() });
      }
    }
  }

  // 6. Subtitle runs / text
  if (artists.length === 0 && item.subtitle) {
    const runs = item.subtitle?.runs;
    if (Array.isArray(runs) && runs[0]?.text) {
      if (runs[0].text !== 'Unknown Artist') {
        artists.push({ id: runs[0].endpoint?.payload?.browseId, name: runs[0].text });
      }
    } else if (typeof item.subtitle?.text === 'string') {
      const parts = item.subtitle.text.split(/•|·|\|/);
      if (parts[0]?.trim() && parts[0].trim() !== 'Unknown Artist') {
        artists.push({ name: parts[0].trim() });
      }
    }
  }

  // 7. Title splitting if "Artist - Title" (standard YouTube music video upload pattern)
  if (artists.length === 0 && (title.includes(' - ') || title.includes(' – ') || title.includes(' — '))) {
    const splitMatch = title.split(/\s*[-–—]\s*/);
    if (splitMatch.length >= 2 && splitMatch[0].trim() && splitMatch[1].trim()) {
      artists.push({ name: splitMatch[0].trim() });
      title = splitMatch.slice(1).join(' - ').trim();
    }
  }

  // 8. Playlist fallback context (e.g. "Presenting Asake" -> "Asake")
  if (artists.length === 0 && fallbackContext) {
    const match = fallbackContext.match(/(?:presenting|this is|best of|essentials of)\s+(.+)/i);
    if (match && match[1]) {
      artists.push({ name: match[1].trim() });
    } else if (fallbackContext && !fallbackContext.toLowerCase().includes('playlist')) {
      artists.push({ name: fallbackContext.trim() });
    }
  }

  const album = item.album
    ? {
        id: item.album.id || item.album.endpoint?.payload?.browseId,
        name: typeof item.album === 'string' ? item.album : item.album.name || item.album.title || '',
      }
    : null;

  const durationSec =
    typeof item.duration?.seconds === 'number'
      ? item.duration.seconds
      : parseDuration(item.duration?.text || item.duration);

  const durationText =
    item.duration?.text ||
    `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;

  const { bestUrl, list } = getBestThumbnail(
    item.thumbnail || item.thumbnails || item.thumbnail?.contents || item.thumbnail?.thumbnails
  );

  return {
    id,
    title,
    artists: artists.length > 0 ? artists : [{ name: 'Unknown Artist' }],
    album,
    duration: durationSec,
    durationText,
    thumbnail: bestUrl,
    thumbnails: list,
    isExplicit: !!(
      item.badges?.some((b: any) => b.label?.toLowerCase().includes('explicit')) || item.is_explicit
    ),
  };
}
