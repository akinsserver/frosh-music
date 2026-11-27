import { Router, Request, Response } from 'express';
import { handleAudioStream, resolveStreamFormat } from '../services/streamer.js';

export const streamRouter = Router();

/**
 * GET /api/stream/:videoId/info
 * Returns stream resolution details, bitrate, mimeType, and direct URL without starting audio pipe
 */
streamRouter.get('/:videoId/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.videoId;
    const videoId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!videoId) {
      res.status(400).json({ error: 'Video ID is required' });
      return;
    }

    const format = await resolveStreamFormat(videoId);
    res.json(format);
  } catch (error: any) {
    console.error(`[Stream API Info] Error for ${req.params.videoId}:`, error);
    res.status(500).json({ error: error.message || 'Failed to resolve stream' });
  }
});

/**
 * HEAD /api/stream/:videoId
 * Probes stream headers (Accept-Ranges, Content-Length, Content-Type) for HTML5 audio
 */
streamRouter.head('/:videoId', async (req: Request, res: Response): Promise<void> => {
  const rawId = req.params.videoId;
  const videoId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!videoId) {
    res.status(400).end();
    return;
  }
  await handleAudioStream(req, res, videoId);
});

/**
 * GET /api/stream/:videoId
 * Direct binary audio streaming with full HTTP Range header support
 */
streamRouter.get('/:videoId', async (req: Request, res: Response): Promise<void> => {
  const rawId = req.params.videoId;
  const videoId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!videoId) {
    res.status(400).json({ error: 'Video ID is required' });
    return;
  }
  await handleAudioStream(req, res, videoId);
});
