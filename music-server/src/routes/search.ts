import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import { cachedFetch } from '../services/cache.js';
import type { Song } from '../types/index.js';

export const searchRouter = Router();
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function extractPlayCount(item: any): string | undefined {
  if (typeof item?.views === 'string') return item.views;
  if (Array.isArray(item?.flex_columns)) {
    for (const fc of item.flex_columns) {
      const txt = fc?.title?.text || '';
      if (/\b(plays|views)\b/i.test(txt)) {
        // Sometimes it's "Asake • 17M plays" or just "32M plays"
        const match = txt.match(/[\d.,]+[KMB]?\s+(?:plays|views)/i);
        if (match) return match[0];
      }
    }
  }
  return undefined;
}

function formatTrackWithPlays(item: any, fallbackArtist?: { id: string; name: string }): Song | null {
  const formatted = formatTrackItem(item);
  if (!formatted) return null;
  const playCount = extractPlayCount(item);
  if (playCount) {
    formatted.playCount = playCount;
  }
  if (
    fallbackArtist &&
    (formatted.artists.length === 0 || formatted.artists[0]?.name === 'Unknown Artist')
  ) {
    formatted.artists = [fallbackArtist];
  }
  return formatted;
}

searchRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    const type = (req.query.type as string) || 'all';

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Search query parameter "q" is required' });
      return;
    }

    const cacheKey = `search:${type}:${q.trim().toLowerCase()}`;
    const data = await cachedFetch(cacheKey, SEARCH_CACHE_TTL, () => executeSearch(q, type));
    res.json(data);
  } catch (error: any) {
    console.error('[Search API] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to search YouTube Music' });
  }
});

async function executeSearch(q: string, type: string): Promise<any> {
    const yt = await getInnertube();

    if (type === 'song') {
      const results = await yt.music.search(q, { type: 'song' });
      const shelf: any = results.contents?.[0];
      const songs: Song[] = [];

      if (shelf?.contents) {
        for (const item of shelf.contents) {
          const formatted = formatTrackWithPlays(item);
          if (formatted) songs.push(formatted);
        }
      }

      return { type: 'song', results: songs };
    }

    if (type === 'album') {
      const results = await yt.music.search(q, { type: 'album' });
      const shelf: any = results.contents?.[0];
      const albums = [];

      if (shelf?.contents) {
        for (const item of shelf.contents) {
          const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
          albums.push({
            id: item.id || item.browse_id,
            title: typeof item.title === 'string' ? item.title : item.title?.text || '',
            artists: item.artists
              ? item.artists.map((a: any) => ({ id: a.channel_id || a.id, name: a.name || a.text }))
              : [],
            year: item.year?.text || item.year,
            thumbnail: bestUrl,
          });
        }
      }

      return { type: 'album', results: albums };
    }

    if (type === 'artist') {
      const results = await yt.music.search(q, { type: 'artist' });
      const shelf: any = results.contents?.[0];
      const artists = [];

      if (shelf?.contents) {
        for (const item of shelf.contents) {
          const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
          artists.push({
            id: item.id || item.browse_id,
            name: typeof item.name === 'string' ? item.name : item.name?.text || item.title?.text || '',
            subscribers: item.subscribers?.text || item.subtitle?.text,
            thumbnail: bestUrl,
          });
        }
      }

      return { type: 'artist', results: artists };
    }

    if (type === 'podcast') {
      const results = await yt.music.search(`${q} podcast`);
      const podcastItems: any[] = [];
      const seenIds = new Set<string>();

      for (const shelf of results.contents || []) {
        for (const item of (shelf as any).contents || []) {
          const itemType = item.item_type;
          if (itemType === 'podcast_show') {
            const rawId = item.id || item.browse_id || item.endpoint?.payload?.browseId;
            const id = rawId ? (rawId.startsWith('MPSP') ? `VL${rawId.slice(4)}` : rawId) : rawId;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
              podcastItems.push({
                type: 'show',
                id,
                title: typeof item.title === 'string' ? item.title : item.title?.text || '',
                author: item.author?.name || item.subtitle?.text || 'Podcast Show',
                thumbnail: bestUrl,
                isPodcast: true,
              });
            }
          } else if (
            itemType === 'non_music_track' ||
            itemType === 'episode' ||
            itemType === 'song' ||
            itemType === 'video'
          ) {
            const formatted = formatTrackWithPlays(item);
            if (formatted && !seenIds.has(formatted.id)) {
              seenIds.add(formatted.id);
              podcastItems.push({
                type: 'episode',
                ...formatted,
                isPodcast: true,
              });
            }
          }
        }
      }

      return { type: 'podcast', results: podcastItems };
    }

    // Default: 'all' - smart unified search with Top Result card + categorized tracks, albums, artists, playlists
    const results = await yt.music.search(q);
    const contents: any[] = results.contents || [];

    let topResult: any = null;
    const tracks: Song[] = [];
    const albums: any[] = [];
    const artists: any[] = [];
    const playlists: any[] = [];

    const seenTrackIds = new Set<string>();
    const seenAlbumIds = new Set<string>();
    const seenArtistIds = new Set<string>();
    const seenPlaylistIds = new Set<string>();

    for (const section of contents) {
      if (section.type === 'MusicCardShelf' && !topResult) {
        const payload = section.on_tap?.payload || {};
        const pageType =
          payload.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
        const browseId = payload.browseId;
        const videoId = payload.videoId;

        let cardType: 'artist' | 'album' | 'playlist' | 'song' = 'song';
        let cardId = videoId || browseId || '';

        if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || (!videoId && browseId?.startsWith('UC'))) {
          cardType = 'artist';
        } else if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || (!videoId && browseId?.startsWith('MPRE'))) {
          cardType = 'album';
        } else if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') {
          cardType = 'playlist';
        }

        const title = typeof section.title === 'string' ? section.title : section.title?.text || '';
        const subtitle = typeof section.subtitle === 'string' ? section.subtitle : section.subtitle?.text || '';
        const { bestUrl } = getBestThumbnail(section.thumbnail || section.header?.thumbnail);

        const cardSongs: Song[] = [];
        if (Array.isArray(section.contents)) {
          const fallbackArtist = cardType === 'artist' && cardId ? { id: cardId, name: title } : undefined;
          for (const item of section.contents) {
            const formatted = formatTrackWithPlays(item, fallbackArtist);
            if (formatted) {
              cardSongs.push(formatted);
            }
          }
        }

        topResult = {
          type: cardType,
          id: cardId,
          title,
          subtitle,
          thumbnail: bestUrl,
          songs: cardSongs,
        };
        continue;
      }

      const sectionItems: any[] = Array.isArray(section.contents) ? section.contents : [];
      for (const item of sectionItems) {
        if (!item) continue;
        const itemType = item.item_type;

        if (
          itemType === 'song' ||
          itemType === 'video' ||
          itemType === 'non_music_track' ||
          itemType === 'episode'
        ) {
          const formatted = formatTrackWithPlays(item);
          if (formatted && !seenTrackIds.has(formatted.id)) {
            seenTrackIds.add(formatted.id);
            tracks.push(formatted);
          }
        } else if (itemType === 'album') {
          const id = item.id || item.browse_id || item.endpoint?.payload?.browseId;
          if (id && !seenAlbumIds.has(id)) {
            seenAlbumIds.add(id);
            const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
            albums.push({
              id,
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              artists: Array.isArray(item.artists)
                ? item.artists.map((a: any) => ({ id: a.channel_id || a.id, name: a.name || a.text }))
                : item.author
                ? [{ id: item.author.channel_id || item.author.id, name: item.author.name || item.author }]
                : [],
              year: item.year?.text || item.year,
              thumbnail: bestUrl,
            });
          }
        } else if (itemType === 'artist') {
          const id = item.id || item.browse_id || item.endpoint?.payload?.browseId;
          if (id && !seenArtistIds.has(id)) {
            seenArtistIds.add(id);
            const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
            artists.push({
              id,
              name: typeof item.name === 'string' ? item.name : item.name?.text || item.title?.text || '',
              subscribers: item.subscribers?.text || item.subtitle?.text,
              thumbnail: bestUrl,
            });
          }
        } else if (itemType === 'playlist') {
          const id = item.id || item.browse_id || item.endpoint?.payload?.browseId;
          if (id && !seenPlaylistIds.has(id)) {
            seenPlaylistIds.add(id);
            const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
            playlists.push({
              id,
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              author: item.author?.name || item.subtitle?.text,
              thumbnail: bestUrl,
            });
          }
        } else if (itemType === 'podcast_show') {
          const rawId = item.id || item.browse_id || item.endpoint?.payload?.browseId;
          const id = rawId ? (rawId.startsWith('MPSP') ? `VL${rawId.slice(4)}` : rawId) : rawId;
          if (id && !seenPlaylistIds.has(id)) {
            seenPlaylistIds.add(id);
            const { bestUrl } = getBestThumbnail(item.thumbnail || item.thumbnails);
            playlists.push({
              id,
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              author: item.author?.name || item.subtitle?.text || 'Podcast Show',
              thumbnail: bestUrl,
            });
          }
        }
      }
    }

    return {
      type: 'all',
      query: q,
      topResult,
      tracks,
      albums,
      artists,
      playlists,
    };
}
