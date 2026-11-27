'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Loader2, Disc3, Download, CheckCircle2 } from 'lucide-react';
import { fetchAlbum } from '@/lib/api';
import type { Album } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { useOffline } from '@/context/OfflineContext';
import { TrackRow } from '@/components/TrackRow';

export default function AlbumPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id || ''));
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playTrack } = usePlayer();
  const { downloadedIds, downloadTracks } = useOffline();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchAlbum(id)
      .then((data) => {
        setAlbum(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load album'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span>Loading album...</span>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300">
        {error || 'Album not found'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-white/10">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl bg-zinc-800 shrink-0">
          {album.thumbnail ? (
            <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Disc3 className="w-16 h-16 text-zinc-600" />
            </div>
          )}
        </div>

        <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Album</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white truncate">
            {album.title}
          </h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-zinc-300">
            {album.artists.map((artist, i) => (
              <React.Fragment key={`${artist.name}-${i}`}>
                {i > 0 && <span>·</span>}
                {artist.id ? (
                  <Link
                    href={`/artist/${encodeURIComponent(artist.id)}`}
                    className="font-semibold hover:underline"
                  >
                    {artist.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{artist.name}</span>
                )}
              </React.Fragment>
            ))}
            {album.year && <span className="text-zinc-500">· {album.year}</span>}
            <span className="text-zinc-500">· {album.tracks.length} songs</span>
          </div>

          {album.tracks.length > 0 && (
            <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <button
                onClick={() => playTrack(album.tracks[0], album.tracks)}
                data-focusable="true"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-transform hover:scale-105 shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Play Album
              </button>

              {album.tracks.every((t) => downloadedIds.has(t.id)) ? (
                <span className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Downloaded
                </span>
              ) : (
                <button
                  onClick={() => downloadTracks(album.tracks)}
                  data-focusable="true"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Album
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tracklist */}
      <div className="space-y-1">
        {album.tracks.map((track, idx) => (
          <TrackRow key={track.id} track={track} index={idx} queue={album.tracks} showIndex />
        ))}
      </div>
    </div>
  );
}
