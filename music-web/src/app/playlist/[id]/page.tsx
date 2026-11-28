'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play, Loader2, ListMusic, ArrowLeft } from 'lucide-react';
import { fetchPlaylist } from '@/lib/api';
import type { Playlist } from '@/types/music';
import { usePlayer } from '@/context/PlayerContext';
import { TrackRow } from '@/components/TrackRow';
import { resolveSongArtists } from '@/lib/recommendations';

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id || ''));
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playTrack } = usePlayer();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPlaylist(id)
      .then((data) => {
        const fallbackContext = data.author || data.title;
        const cleanedTracks = (data.tracks || []).map((t) => ({
          ...t,
          artists: resolveSongArtists(t, fallbackContext),
        }));
        setPlaylist({ ...data, tracks: cleanedTracks });
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load playlist'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span>Loading playlist...</span>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300">
        {error || 'Playlist not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        data-focusable="true"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
        title="Go back"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-white/10">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl bg-zinc-800 shrink-0">
          {playlist.thumbnail ? (
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ListMusic className="w-16 h-16 text-zinc-600" />
            </div>
          )}
        </div>

        <div className="text-center sm:text-left space-y-2 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Playlist
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white truncate">
            {playlist.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {playlist.author ? `${playlist.author} · ` : ''}
            {playlist.tracks.length} tracks
          </p>

          {playlist.tracks.length > 0 && (
            <div className="pt-3">
              <button
                onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                data-focusable="true"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-transform hover:scale-105 shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Play All
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {playlist.tracks.map((track, idx) => (
          <TrackRow
            key={`${track.id}-${idx}`}
            track={track}
            index={idx}
            queue={playlist.tracks}
            showIndex
          />
        ))}
      </div>
    </div>
  );
}
