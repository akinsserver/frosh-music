import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import { cachedFetch } from '../services/cache.js';
import type { Album, Song, ArtistReference } from '../types/index.js';

export const albumRouter = Router();
const ALBUM_CACHE_TTL = 15 * 60 * 1000;

albumRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ error: 'Album ID is required' });
      return;
    }

    const response = await cachedFetch(`album:${id}`, ALBUM_CACHE_TTL, async () => {
      const yt = await getInnertube();
      const albumData: any = await yt.music.getAlbum(id);

      const title =
        albumData.header?.title?.text ||
        albumData.header?.title?.toString?.() ||
        albumData.title?.text ||
        albumData.title ||
        'Unknown Album';

      // Parse artists from header
      const artists: ArtistReference[] = [];
      if (albumData.header?.artists && Array.isArray(albumData.header.artists)) {
        for (const a of albumData.header.artists) {
          artists.push({
            id: a.channel_id || a.id || a.endpoint?.payload?.browseId,
            name: a.name || a.text || a.toString?.() || 'Unknown Artist',
          });
        }
      } else if (albumData.header?.strapline_text_one) {
        const strap = albumData.header.strapline_text_one;
        artists.push({
          id: strap.endpoint?.payload?.browseId,
          name: strap.text || strap.toString?.() || 'Unknown Artist',
        });
      } else if (albumData.header?.author) {
        const auth = albumData.header.author;
        artists.push({
          id: auth.channel_id || auth.id || auth.endpoint?.payload?.browseId,
          name: auth.name || auth.text || 'Unknown Artist',
        });
      }

      const subtitleText = albumData.header?.subtitle?.text || albumData.header?.subtitle?.toString?.() || '';
      const yearMatch = subtitleText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : albumData.header?.year?.text || albumData.year?.text || '';

      const duration =
        albumData.header?.second_subtitle?.text ||
        albumData.header?.second_subtitle?.toString?.() ||
        undefined;

      const { bestUrl, list } = getBestThumbnail(albumData.header?.thumbnails || albumData.thumbnails);

      const tracks: Song[] = [];
      if (albumData.contents) {
        for (const track of albumData.contents) {
          const song = formatTrackItem(track);
          if (song) {
            if (!song.thumbnail && bestUrl) song.thumbnail = bestUrl;
            if (!song.album) song.album = { id, name: title };
            if (
              (!song.artists || song.artists.length === 0 || song.artists[0]?.name === 'Unknown Artist') &&
              artists.length > 0
            ) {
              song.artists = artists;
            }
            tracks.push(song);
          }
        }
      }

      const payload: Album = {
        id,
        title,
        artists,
        year,
        duration,
        thumbnail: bestUrl,
        thumbnails: list,
        trackCount: tracks.length,
        tracks,
      };
      return payload;
    });

    res.json(response);
  } catch (error: any) {
    console.error(`[Album API] Error fetching album ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch album' });
  }
});
