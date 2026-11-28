import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import type { Playlist, Song } from '../types/index.js';

export const playlistRouter = Router();

playlistRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ error: 'Playlist ID is required' });
      return;
    }

    const yt = await getInnertube();
    const playlistData: any = await yt.music.getPlaylist(id);

    const title = playlistData.header?.title?.text || playlistData.title?.text || playlistData.title || 'Playlist';
    const author = playlistData.header?.author?.name || playlistData.header?.author?.text || '';
    const description = playlistData.header?.description?.text;
    const { bestUrl } = getBestThumbnail(playlistData.header?.thumbnails || playlistData.thumbnails);

    const tracks: Song[] = [];
    const fallbackContext = author || title;
    if (playlistData.contents) {
      for (const item of playlistData.contents) {
        const song = formatTrackItem(item, fallbackContext);
        if (song) tracks.push(song);
      }
    }

    const response: Playlist = {
      id,
      title,
      author,
      description,
      thumbnail: bestUrl,
      trackCount: tracks.length,
      tracks
    };

    res.json(response);
  } catch (error: any) {
    console.error(`[Playlist API] Error fetching playlist ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch playlist' });
  }
});
