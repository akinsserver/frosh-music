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
  thumbnails?: ThumbnailItem[];
  isExplicit?: boolean;
  playCount?: string;
}

export interface Album {
  id: string;
  title: string;
  artists: ArtistReference[];
  year?: string;
  thumbnail: string;
  trackCount?: number;
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

export interface PlayHistoryEvent {
  id: string;
  trackId: string;
  title: string;
  artists: { id?: string; name: string }[];
  album?: { id?: string; name: string } | null;
  thumbnail: string;
  duration: number; // in seconds
  timestamp: number; // Date.now()
  listenedSeconds?: number;
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

export interface HomeCardItem {
  id: string;
  title: string;
  type: 'album' | 'playlist' | 'artist' | 'song';
  subtitle?: string;
  thumbnail: string;
}

export interface HomeShelf {
  title: string;
  subtitle?: string;
  items: Array<Song | HomeCardItem>;
}

export interface SyncedLyricLine {
  time: number; // milliseconds
  timestamp: string;
  text: string;
}

export interface LyricsResponse {
  videoId: string;
  trackName?: string;
  artistName?: string;
  source: 'lrclib' | 'innertube' | 'captions' | 'none';
  isSynced: boolean;
  plainLyrics?: string;
  syncedLyrics?: SyncedLyricLine[];
}

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  tracks: Song[];
}

export interface SearchTopResult {
  type: 'artist' | 'album' | 'playlist' | 'song';
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  songs?: Song[];
}

export interface SearchAllResponse {
  type: 'all';
  query: string;
  topResult: SearchTopResult | null;
  tracks: Song[];
  albums: {
    id: string;
    title: string;
    artists: ArtistReference[];
    year?: string;
    thumbnail: string;
  }[];
  artists: RelatedArtist[];
  playlists?: FeaturedPlaylist[];
}
