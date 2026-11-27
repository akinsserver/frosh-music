export interface ArtistReference {
  id?: string;
  name: string;
}

export interface ThumbnailItem {
  url: string;
  width?: number;
  height?: number;
}

export interface Song {
  id: string;
  title: string;
  artists: ArtistReference[];
  album?: {
    id?: string;
    name: string;
  } | null;
  duration: number; // seconds
  durationText: string;
  thumbnail: string;
  thumbnails: ThumbnailItem[];
  isExplicit?: boolean;
  playCount?: string;
}

export interface Album {
  id: string;
  title: string;
  artists: ArtistReference[];
  year?: string;
  thumbnail: string;
  thumbnails?: ThumbnailItem[];
  trackCount?: number;
  duration?: string;
  tracks: Song[];
}

export interface RelatedArtist {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
}

export interface FeaturedPlaylist {
  id: string;
  title: string;
  thumbnail: string;
  author?: string;
}

export interface Artist {
  id: string;
  name: string;
  thumbnail: string;
  description?: string;
  subscribers?: string;
  monthlyListeners?: string;
  topSongs: Song[];
  allSongs?: Song[];
  albums: Album[];
  singles: Album[];
  featuredOn?: FeaturedPlaylist[];
  similarArtists?: RelatedArtist[];
}

export interface Playlist {
  id: string;
  title: string;
  author?: string;
  description?: string;
  thumbnail: string;
  trackCount?: number;
  tracks: Song[];
}

export interface HomeShelf {
  title: string;
  subtitle?: string;
  items: Array<Song | {
    id: string;
    title: string;
    type: 'album' | 'playlist' | 'artist' | 'song';
    subtitle?: string;
    thumbnail: string;
  }>;
}

export interface SyncedLyricLine {
  time: number; // in milliseconds
  timestamp: string; // e.g. "00:15.71"
  text: string;
}

export interface LyricsResponse {
  videoId: string;
  trackName?: string;
  artistName?: string;
  source: 'lrclib' | 'innertube' | 'none';
  isSynced: boolean;
  plainLyrics?: string;
  syncedLyrics?: SyncedLyricLine[];
}

export interface StreamFormatInfo {
  itag: number;
  mimeType: string;
  bitrate: number;
  contentLength?: number;
  audioSampleRate?: number;
  url: string;
}
