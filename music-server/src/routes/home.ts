import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import { cachedFetch } from '../services/cache.js';
import type { HomeShelf } from '../types/index.js';

export const homeRouter = Router();
const HOME_CACHE_TTL = 20 * 60 * 1000; // 20 minutes

homeRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const payload = await cachedFetch('home:feed', HOME_CACHE_TTL, async () => {
      const yt = await getInnertube();
      const homeFeed = await yt.music.getHomeFeed();
      const shelves: HomeShelf[] = [];

      for (const section of homeFeed.sections || []) {
        const sec: any = section;
        const title = sec.header?.title?.text || sec.title?.text || sec.title || 'Recommended';
        const subtitle = sec.header?.subtitle?.text || sec.subtitle?.text;
        const items: any[] = [];

        for (const item of sec.contents || []) {
          if (item.type === 'MusicResponsiveListItem') {
            const song = formatTrackItem(item);
            if (song) items.push(song);
          } else if (item.type === 'MusicTwoRowItem') {
            const rawThumbs = item.thumbnail || item.thumbnails || item.thumbnail?.thumbnails;
            const { bestUrl } = getBestThumbnail(rawThumbs);
            items.push({
              id: item.id || item.browse_id || item.video_id,
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              type: item.endpoint?.payload?.browseId?.startsWith('MPRE') ? 'album' : (item.endpoint?.payload?.browseId?.startsWith('UC') ? 'artist' : 'playlist'),
              subtitle: item.subtitle?.text || item.author?.name || item.author?.text || '',
              thumbnail: bestUrl
            });
          }
        }

        if (items.length > 0) {
          shelves.push({
            title,
            subtitle,
            items
          });
        }
      }

      // If home feed is empty, fallback to search for popular charts
      if (shelves.length === 0) {
        const topHits = await yt.music.search('Top Hits 2026', { type: 'song' });
        const shelf: any = topHits.contents?.[0];
        const songs: any[] = [];
        if (shelf?.contents) {
          for (const item of shelf.contents) {
            const song = formatTrackItem(item);
            if (song) songs.push(song);
          }
        }
        shelves.push({
          title: 'Today\'s Biggest Hits',
          items: songs
        });
      }

      return { shelves };
    });

    res.json(payload);
  } catch (error: any) {
    console.error('[Home API] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch home feed' });
  }
});

/**
 * Real-time Weekly Trending Charts & Top Releases
 * Fetches the official YouTube Music Trending 20 United States chart
 */
homeRouter.get('/trending', async (_req: Request, res: Response): Promise<void> => {
  try {
    const payload = await cachedFetch('home:trending', HOME_CACHE_TTL, async () => {
      const yt = await getInnertube();
      // Official YouTube Music Weekly Trending chart playlist
      const pl: any = await yt.music.getPlaylist('VLOLAK5uy_kNWGJvgWVqlt5LsFDL9Sdluly4M8TvGkM');
      const songs: any[] = [];
      if (pl?.contents) {
        for (const item of pl.contents) {
          const song = formatTrackItem(item, 'Trending This Week');
          if (song) songs.push(song);
        }
      }
      return { title: 'Top Releases & Hits', songs };
    });

    res.json(payload);
  } catch (error: any) {
    console.error('[Trending API] Error fetching trending chart:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch trending chart' });
  }
});

/**
 * Real-time Genre Trending & New Releases
 */
homeRouter.get('/genre-trending', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawGenre = req.query.genre as string;
    const genre = rawGenre ? rawGenre.trim() : 'Afrobeats';

    const payload = await cachedFetch(`home:genre:${genre.toLowerCase()}`, HOME_CACHE_TTL, async () => {
      const yt = await getInnertube();
      const currentYear = new Date().getFullYear();

      const searchRes: any = await yt.music.search(`New ${genre} Songs ${currentYear}`, { type: 'song' });
      const shelf = searchRes.contents?.[0];
      const songs: any[] = [];

      if (shelf?.contents) {
        for (const item of shelf.contents) {
          const song = formatTrackItem(item, `${genre} Hits`);
          if (song) songs.push(song);
        }
      }

      return { genre, songs };
    });

    res.json(payload);
  } catch (error: any) {
    console.error('[Genre Trending API] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch genre trending' });
  }
});
