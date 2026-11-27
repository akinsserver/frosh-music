import { Router, Request, Response } from 'express';
import { getInnertube, formatTrackItem, getBestThumbnail } from '../services/innertube.js';
import type { Artist, Song, Album, RelatedArtist, FeaturedPlaylist } from '../types/index.js';

export const artistRouter = Router();

artistRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ error: 'Artist ID is required' });
      return;
    }

    const yt = await getInnertube();

    // Fetch parsed artist page and raw browse response in parallel
    const [artistData, rawBrowse]: [any, any] = await Promise.all([
      yt.music.getArtist(id),
      yt.actions.execute('/browse', { browseId: id, client: 'YTMUSIC' }).catch(() => null),
    ]);

    const name =
      artistData.header?.title?.text ||
      artistData.header?.name?.text ||
      artistData.name ||
      'Unknown Artist';
    const description = artistData.header?.description?.text;

    // Extract official Monthly Audience / Listeners & Subscribers
    const immHeader =
      rawBrowse?.data?.header?.musicImmersiveHeaderRenderer ||
      rawBrowse?.data?.header?.musicVisualHeaderRenderer;

    const monthlyListeners =
      immHeader?.monthlyListenerCount?.runs?.[0]?.text ||
      immHeader?.monthlyListenerCount?.text ||
      immHeader?.monthlyListenerCount?.accessibility?.accessibilityData?.label ||
      undefined;

    const subscribers =
      immHeader?.subscriptionButton?.subscribeButtonRenderer?.longSubscriberCountText?.runs?.[0]?.text ||
      immHeader?.subscriptionButton?.subscribeButtonRenderer?.shortSubscriberCountText?.runs?.[0]?.text ||
      artistData.header?.subscribers?.text ||
      undefined;

    const { bestUrl } = getBestThumbnail(
      artistData.header?.thumbnail ||
      artistData.header?.thumbnails ||
      artistData.thumbnails ||
      immHeader?.thumbnail
    );

    let allSongs: Song[] = [];
    try {
      const all = await artistData.getAllSongs();
      if (all?.contents && Array.isArray(all.contents)) {
        allSongs = all.contents
          .map((item: any) => {
            const s = formatTrackItem(item);
            if (s && (!s.artists || s.artists.length === 0 || s.artists[0]?.name === 'Unknown Artist')) {
              s.artists = [{ id, name }];
            }
            return s;
          })
          .filter((s: any): s is Song => Boolean(s));
      }
    } catch (err: any) {
      console.warn(`[Artist API] getAllSongs() error for ${id}:`, err.message);
    }

    // Fallback if getAllSongs was empty
    if (allSongs.length === 0 && artistData.sections?.[0]?.contents) {
      allSongs = artistData.sections[0].contents
        .map((item: any) => {
          const s = formatTrackItem(item);
          if (s && (!s.artists || s.artists.length === 0 || s.artists[0]?.name === 'Unknown Artist')) {
            s.artists = [{ id, name }];
          }
          return s;
        })
        .filter((s: any): s is Song => Boolean(s));
    }

    const topSongs = allSongs.slice(0, 10);

    const albums: Album[] = [];
    const singles: Album[] = [];
    const featuredOn: FeaturedPlaylist[] = [];
    const similarArtists: RelatedArtist[] = [];

    // Parse all carousel sections
    for (const section of artistData.sections || []) {
      const headerTitle = (
        section.header?.title?.text ||
        section.header?.title ||
        section.title?.text ||
        section.title ||
        ''
      ).toLowerCase();
      const contents = section.contents || [];

      if (headerTitle.includes('album')) {
        for (const item of contents) {
          const { bestUrl: thumb } = getBestThumbnail(
            item.thumbnail || item.thumbnails || item.thumbnail?.contents
          );
          const albumId = item.id || item.browse_id;
          if (albumId) {
            albums.push({
              id: String(albumId),
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              artists: [{ id, name }],
              year: item.year?.text || item.year || item.subtitle?.text || item.subtitle,
              thumbnail: thumb,
              tracks: [],
            });
          }
        }
      } else if (headerTitle.includes('single') || headerTitle.includes('ep')) {
        for (const item of contents) {
          const { bestUrl: thumb } = getBestThumbnail(
            item.thumbnail || item.thumbnails || item.thumbnail?.contents
          );
          const singleId = item.id || item.browse_id;
          if (singleId) {
            singles.push({
              id: String(singleId),
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              artists: [{ id, name }],
              year: item.year?.text || item.year || item.subtitle?.text || item.subtitle,
              thumbnail: thumb,
              tracks: [],
            });
          }
        }
      } else if (headerTitle.includes('featured') || headerTitle.includes('appears on')) {
        for (const item of contents) {
          const { bestUrl: thumb } = getBestThumbnail(
            item.thumbnail || item.thumbnails || item.thumbnail?.contents
          );
          const playId = item.id || item.browse_id;
          if (playId) {
            featuredOn.push({
              id: String(playId),
              title: typeof item.title === 'string' ? item.title : item.title?.text || '',
              thumbnail: thumb,
              author: item.subtitle?.text || item.author?.text,
            });
          }
        }
      } else if (
        headerTitle.includes('fans might') ||
        headerTitle.includes('similar') ||
        headerTitle.includes('like')
      ) {
        for (const item of contents) {
          const { bestUrl: thumb } = getBestThumbnail(
            item.thumbnail || item.thumbnails || item.thumbnail?.contents
          );
          const artistItemId = item.id || item.browse_id;
          if (artistItemId) {
            similarArtists.push({
              id: String(artistItemId),
              name: typeof item.title === 'string' ? item.title : item.title?.text || '',
              thumbnail: thumb,
              subscribers: item.subtitle?.text,
            });
          }
        }
      }
    }

    const response: Artist = {
      id,
      name,
      thumbnail: bestUrl,
      description,
      subscribers,
      monthlyListeners,
      topSongs,
      allSongs,
      albums,
      singles,
      featuredOn,
      similarArtists,
    };

    res.json(response);
  } catch (error: any) {
    console.error(`[Artist API] Error fetching artist ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch artist' });
  }
});
