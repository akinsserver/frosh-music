'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Heart, History, ListMusic, Play, Plus, Trash2, Download, HardDrive, CheckCircle2 } from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { useOffline } from '@/context/OfflineContext';
import { usePlayer } from '@/context/PlayerContext';
import { formatBytes } from '@/lib/offlineStorage';
import { TrackRow } from '@/components/TrackRow';

function LibraryContent() {
  const searchParams = useSearchParams();
  const selectedPlaylistId = searchParams.get('playlist');

  const {
    likedSongs,
    playlists,
    history,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
  } = useLibrary();
  const { playTrack } = usePlayer();
  const { downloadedTracks, totalBytes, downloadTracks, clearAllDownloads } = useOffline();

  const [activeTab, setActiveTab] = useState<'likes' | 'downloads' | 'history'>('likes');
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
  };

  if (selectedPlaylist) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-zinc-800 flex items-center justify-center border border-white/10">
              <ListMusic className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                Playlist
              </p>
              <h1 className="text-3xl font-bold text-white mt-1">{selectedPlaylist.name}</h1>
              <p className="text-sm text-zinc-400 mt-1">
                {selectedPlaylist.tracks.length} tracks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPlaylist.tracks.length > 0 && (
              <>
                <button
                  onClick={() => playTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                  data-focusable="true"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play All
                </button>
                <button
                  onClick={() => downloadTracks(selectedPlaylist.tracks)}
                  data-focusable="true"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors"
                  title="Download all tracks in playlist for offline playback"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </>
            )}
            <button
              onClick={() => deletePlaylist(selectedPlaylist.id)}
              data-focusable="true"
              className="p-2.5 rounded-full bg-white/10 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 transition-colors"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {selectedPlaylist.tracks.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8">
            This playlist is empty. Click the + button on any song to add it here.
          </p>
        ) : (
          <div className="space-y-1">
            {selectedPlaylist.tracks.map((track, idx) => (
              <div key={`${track.id}-${idx}`} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <TrackRow
                    track={track}
                    index={idx}
                    queue={selectedPlaylist.tracks}
                    showIndex
                  />
                </div>
                <button
                  onClick={() => removeTrackFromPlaylist(selectedPlaylist.id, track.id)}
                  className="p-2 text-zinc-500 hover:text-red-400"
                  title="Remove from playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Your Library</h1>

        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name..."
            className="px-3.5 py-2 rounded-full bg-zinc-900 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            data-focusable="true"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('likes')}
          data-focusable="true"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
            activeTab === 'likes'
              ? 'bg-white text-zinc-950'
              : 'bg-white/10 text-zinc-300 hover:bg-white/15'
          }`}
        >
          <Heart className="w-4 h-4" />
          Liked Songs ({likedSongs.length})
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          data-focusable="true"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
            activeTab === 'downloads'
              ? 'bg-white text-zinc-950'
              : 'bg-white/10 text-zinc-300 hover:bg-white/15'
          }`}
        >
          <Download className="w-4 h-4" />
          Downloaded ({downloadedTracks.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          data-focusable="true"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
            activeTab === 'history'
              ? 'bg-white text-zinc-950'
              : 'bg-white/10 text-zinc-300 hover:bg-white/15'
          }`}
        >
          <History className="w-4 h-4" />
          Recently Played ({history.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'likes' ? (
        likedSongs.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">
            No liked songs yet. Click the heart icon on any song to save it here.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                onClick={() => downloadTracks(likedSongs)}
                data-focusable="true"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium text-zinc-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download All Liked
              </button>
            </div>
            <div className="space-y-1">
              {likedSongs.map((song, idx) => (
                <TrackRow key={song.id} track={song} index={idx} queue={likedSongs} showIndex />
              ))}
            </div>
          </div>
        )
      ) : activeTab === 'downloads' ? (
        downloadedTracks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm space-y-2">
            <Download className="w-8 h-8 mx-auto text-zinc-600" />
            <p>No offline downloads yet.</p>
            <p className="text-xs text-zinc-600">
              Tap the download icon on any song or album to save it for offline playback.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>
                  <strong className="text-white">{downloadedTracks.length}</strong> songs stored offline ·{' '}
                  <strong className="text-white">{formatBytes(totalBytes)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const queue = downloadedTracks.map((d) => d.song);
                    playTrack(queue[0], queue);
                  }}
                  data-focusable="true"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play All
                </button>
                <button
                  onClick={clearAllDownloads}
                  data-focusable="true"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {downloadedTracks.map((item, idx) => (
                <TrackRow
                  key={item.id}
                  track={item.song}
                  index={idx}
                  queue={downloadedTracks.map((d) => d.song)}
                  showIndex
                />
              ))}
            </div>
          </div>
        )
      ) : history.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          No listening history yet. Play a track to see it here.
        </div>
      ) : (
        <div className="space-y-1">
          {history.map((song, idx) => (
            <TrackRow key={`${song.id}-${idx}`} track={song} index={idx} queue={history} showIndex />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="text-zinc-400 p-8">Loading library...</div>}>
      <LibraryContent />
    </Suspense>
  );
}
