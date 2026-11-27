'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

// Pages that render without the app shell (no sidebar, no player bar).
const BARE_PATHS = ['/login', '/signup'];
const BARE_PREFIXES = ['/auth/'];

export function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const bare =
    BARE_PATHS.includes(pathname) ||
    BARE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (bare) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
