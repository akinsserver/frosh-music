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
    const author =
      playlistData.header?.author?.name ||
      playlistData.header?.author?.text ||
      playlistData.header?.strapline_text_one?.text ||
      playlistData.author?.name ||
      playlistData.author ||
      '';
    const description = playlistData.header?.description?.text || playlistData.description?.text || playlistData.description;
    const { bestUrl } = getBestThumbnail(
      playlistData.header?.thumbnail ||
      playlistData.header?.thumbnails ||
      playlistData.thumbnail ||
      playlistData.thumbnails
    );

    const tracks: Song[] = [];
    const isGenericAuthor = !author || ['youtube music', 'spotify', 'apple music', 'various artists', 'frosh'].some(w => author.toLowerCase().includes(w));
    const fallbackContext = (!isGenericAuthor ? author : '') || title;
    const contents = playlistData.contents || playlistData.items || playlistData.videos || [];
    if (Array.isArray(contents)) {
      for (const item of contents) {
        const song = formatTrackItem(item, fallbackContext);
        if (song) {
          // Extra safety: If song still shows Unknown Artist, infer from title / author (e.g. "Presenting Asake" -> "Asake")
          if (
            !song.artists ||
            song.artists.length === 0 ||
            song.artists.every((a) => !a.name || a.name.toLowerCase() === 'unknown artist')
          ) {
            const contextText = `${title} ${author}`.trim();
            const match = contextText.match(/(?:presenting|this is|best of|essentials of)\s+([^•\-|]+)/i);
            const suffixMatch = contextText.match(/([^•\-|]+)\s+(?:essentials|radio|mix|hits|discography)/i);
            const resolvedName = match ? match[1].trim() : (suffixMatch ? suffixMatch[1].trim() : (!isGenericAuthor ? author.trim() : ''));
            if (resolvedName) {
              song.artists = [{ name: resolvedName }];
            }
          }
          tracks.push(song);
        }
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
