import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import type { HomeShelf } from '../types/index.js';

export const homeRouter = Router();

homeRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
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
          const { bestUrl } = getBestThumbnail(item.thumbnails || item.thumbnail?.thumbnails);
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

    res.json({ shelves });
  } catch (error: any) {
    console.error('[Home API] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch home feed' });
  }
});
