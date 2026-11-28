'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Heart, History, ListMusic, Play, Plus, Trash2, Download, HardDrive, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';
import { useOffline } from '@/context/OfflineContext';
import { usePlayer } from '@/context/PlayerContext';
import { formatBytes, type DownloadedTrackSummary } from '@/lib/offlineStorage';
import { TrackRow } from '@/components/TrackRow';
import { UserAvatarButton } from '@/components/UserAvatarButton';
import type { Song } from '@/types/music';

function DownloadedTrackItem({
  item,
  index,
  queue,
  onDelete,
}: {
  item: DownloadedTrackSummary;
  index: number;
  queue: Song[];
  onDelete: (id: string) => void;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const MAX_REVEAL = 72; // px

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (isOpen) {
      const current = -MAX_REVEAL + deltaX;
      setSwipeOffset(Math.max(-MAX_REVEAL - 15, Math.min(0, current)));
    } else {
      if (deltaX < 0) {
        setSwipeOffset(Math.max(-MAX_REVEAL - 15, deltaX));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;

    if (isOpen) {
      if (swipeOffset > -MAX_REVEAL / 2) {
        setSwipeOffset(0);
        setIsOpen(false);
      } else {
        setSwipeOffset(-MAX_REVEAL);
        setIsOpen(true);
      }
    } else {
      if (swipeOffset < -25) {
        setSwipeOffset(-MAX_REVEAL);
        setIsOpen(true);
      } else {
        setSwipeOffset(0);
        setIsOpen(false);
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-900/30">
      {/* Background Action: Red Delete Button revealed on swipe */}
      <div className="absolute inset-y-0 right-0 w-[72px] bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="w-full h-full flex flex-col items-center justify-center gap-1 text-white active:scale-95 transition-transform"
          aria-label={`Delete ${item.song.title} from offline downloads`}
          title="Delete from offline storage"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Foreground Swipeable Track */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: touchStartRef.current ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        className="relative bg-zinc-950 flex items-center pr-1.5"
        onClick={() => {
          if (isOpen) {
            setSwipeOffset(0);
            setIsOpen(false);
          }
        }}
      >
        <div className="flex-1 min-w-0">
          <TrackRow
            track={item.song}
            index={index}
            queue={queue}
            showIndex
          />
        </div>

        {/* Desktop / Hover direct delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          title="Delete from offline storage"
          data-focusable="true"
          className="hidden sm:flex items-center justify-center p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const { downloadedTracks, totalBytes, downloadTracks, clearAllDownloads, removeDownload } = useOffline();

  const [activeTab, setActiveTab] = useState<'playlists' | 'likes' | 'downloads' | 'history'>('playlists');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const playlistInputRef = useRef<HTMLInputElement>(null);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) {
      setCreateError('Enter a playlist name');
      playlistInputRef.current?.focus();
      return;
    }
    setCreateError(null);
    const newPl = createPlaylist(name);
    setNewPlaylistName('');
    setActiveTab('playlists');
    router.push(`/library?playlist=${encodeURIComponent(newPl.id)}`);
  };

  if (selectedPlaylist) {
    return (
      <div className="space-y-6">
        <div className="sticky top-3 z-30 flex items-center pointer-events-none">
          <button
            onClick={() => router.push('/library')}
            data-focusable="true"
            aria-label="Back to Library"
            title="Back to Library"
            className="pointer-events-auto w-10 h-10 rounded-full bg-zinc-900/75 hover:bg-zinc-800/95 active:scale-95 text-white border border-white/15 backdrop-blur-xl shadow-lg shadow-black/40 flex items-center justify-center transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Your Library</h1>
          <div className="sm:hidden">
            <UserAvatarButton />
          </div>
        </div>

        <div className="w-full sm:w-auto space-y-1">
          <form onSubmit={handleCreate} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              ref={playlistInputRef}
              type="text"
              value={newPlaylistName}
              onChange={(e) => {
                setNewPlaylistName(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder="New playlist name..."
              className={`flex-1 min-w-0 px-3.5 py-2 rounded-full bg-zinc-900 border text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${
                createError ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-white/15'
              }`}
            />
            <button
              type="submit"
              data-focusable="true"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-semibold text-sm transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </form>
          {createError && (
            <p className="text-xs text-amber-400 pl-3">{createError}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('playlists')}
          data-focusable="true"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
            activeTab === 'playlists'
              ? 'bg-white text-zinc-950'
              : 'bg-white/10 text-zinc-300 hover:bg-white/15'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          Playlists ({playlists.length})
        </button>

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
      {activeTab === 'playlists' ? (
        playlists.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm space-y-2">
            <ListMusic className="w-8 h-8 mx-auto text-zinc-600" />
            <p>No playlists yet.</p>
            <p className="text-xs text-zinc-600">
              Type a name in the box above and click &quot;Create&quot; to make your first playlist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => router.push(`/library?playlist=${encodeURIComponent(pl.id)}`)}
                data-focusable="true"
                className="group relative p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex flex-col cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500/20 via-zinc-800 to-zinc-900 mb-3 flex items-center justify-center shadow-lg border border-white/5">
                  <ListMusic className="w-10 h-10 text-emerald-400/80 group-hover:scale-110 transition-transform" />
                  {pl.tracks.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(pl.tracks[0], pl.tracks);
                      }}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl"
                      title="Play Playlist"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{pl.tracks.length} tracks</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePlaylist(pl.id);
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'likes' ? (
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

            <div className="space-y-1.5">
              {downloadedTracks.map((item, idx) => (
                <DownloadedTrackItem
                  key={item.id}
                  item={item}
                  index={idx}
                  queue={downloadedTracks.map((d) => d.song)}
                  onDelete={removeDownload}
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
