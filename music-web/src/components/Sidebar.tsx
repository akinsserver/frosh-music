'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Search,
  Library,
  BarChart3,
  Plus,
  Heart,
  ListMusic,
  Tv,
  LogOut,
} from 'lucide-react';
import { useLibrary } from '@/context/LibraryContext';

export function Sidebar({ isTVMode, onToggleTV }: { isTVMode: boolean; onToggleTV: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { playlists, likedSongs, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUserEmail(data?.user?.email ?? null))
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('vyla_user_profile');
    router.push('/login');
    router.refresh();
  }

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createPlaylist(newName.trim());
    setNewName('');
    setCreating(false);
  };

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/library', label: 'Your Library', icon: Library },
    { href: '/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <>
      {/* Desktop / TV Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-zinc-950 border-r border-white/5 h-full select-none">
        {/* Brand */}
        <div className="px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" data-focusable="true">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-zinc-900 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15 group-hover:border-emerald-400 transition-colors shrink-0">
              <img src="/icon.svg" alt="FM" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">Frosh</span>
              <span className="text-lg font-light text-emerald-400 ml-1">Music</span>
            </div>
          </Link>

          <button
            onClick={onToggleTV}
            title={isTVMode ? 'TV Focus Mode Active' : 'Enable TV Navigation Mode'}
            data-focusable="true"
            className={`p-1.5 rounded-lg transition-colors ${
              isTVMode
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Tv className="w-4 h-4" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-focusable="true"
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Library / Playlists */}
        <div className="mt-6 px-3 flex-1 flex flex-col min-h-0">
          <div className="px-3.5 flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Playlists
            </span>
            <button
              onClick={() => setCreating((c) => !c)}
              title="Create Playlist"
              data-focusable="true"
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {creating && (
            <form onSubmit={handleCreatePlaylist} className="px-2 mb-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name..."
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </form>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            <Link
              href="/library"
              data-focusable="true"
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 flex items-center justify-center shrink-0">
                <Heart className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">Liked Songs</p>
                <p className="text-xs text-zinc-500">{likedSongs.length} tracks</p>
              </div>
            </Link>

            {playlists.map((pl) => (
              <Link
                key={pl.id}
                href={`/library?playlist=${encodeURIComponent(pl.id)}`}
                data-focusable="true"
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <ListMusic className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{pl.name}</p>
                  <p className="text-xs text-zinc-500">{pl.tracks.length} tracks</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Signed-in account + Sign out */}
        <div className="px-3 pb-4 pt-3 border-t border-white/5">
          {userEmail && (
            <p className="px-3.5 text-xs text-zinc-500 truncate mb-2" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button
            onClick={handleSignOut}
            data-focusable="true"
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-lg border-t border-white/10 flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-xs ${
                active ? 'text-emerald-400 font-medium' : 'text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-4 py-1 rounded-lg text-xs text-zinc-400"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign out</span>
        </button>
      </nav>
    </>
  );
}
