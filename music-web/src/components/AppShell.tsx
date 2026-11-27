'use client';

import React, { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { LibraryProvider } from '@/context/LibraryContext';
import { OfflineProvider, useOffline } from '@/context/OfflineContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { useTVNavigation } from '@/hooks/useTVNavigation';
import { Sidebar } from './Sidebar';
import { PlayerBar } from './PlayerBar';
import { FullScreenPlayer } from './FullScreenPlayer';

function InnerShell({ children }: { children: React.ReactNode }) {
  const { isTVMode, setIsTVMode } = useTVNavigation();
  const { isOffline } = useOffline();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar isTVMode={isTVMode} onToggleTV={() => setIsTVMode((v) => !v)} />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900/60 via-zinc-950 to-zinc-950 pb-36 md:pb-8">
          {isOffline && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-center gap-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline Mode — Playing downloaded tracks from your device</span>
            </div>
          )}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>

      <PlayerBar />
      <FullScreenPlayer />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LibraryProvider>
      <OfflineProvider>
        <PlayerProvider>
          <InnerShell>{children}</InnerShell>
        </PlayerProvider>
      </OfflineProvider>
    </LibraryProvider>
  );
}
