import { Router, Request, Response } from 'express';
import { fetchLyrics } from '../services/lyrics.js';

export const lyricsRouter = Router();

/**
 * GET /api/lyrics/:videoId?title=...&artist=...&duration=...
 * Returns synced karaoke lyrics or plain text lyrics
 */
lyricsRouter.get('/:videoId', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.videoId;
    const videoId = Array.isArray(rawId) ? rawId[0] : rawId;
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    const duration = req.query.duration ? parseFloat(req.query.duration as string) : undefined;

    if (!videoId) {
      res.status(400).json({ error: 'Video ID is required' });
      return;
    }

    const lyrics = await fetchLyrics(videoId, title, artist, duration);
    res.json(lyrics);
  } catch (error: any) {
    console.error(`[Lyrics API] Error for ${req.params.videoId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch lyrics' });
  }
});
