'use client';

import { useEffect, useState } from 'react';

/**
 * Spatial D-pad / Firestick / Android TV navigation hook.
 * Allows navigating any element with [data-focusable="true"] using Arrow keys & Enter.
 */
export function useTVNavigation() {
  const [isTVMode, setIsTVMode] = useState(false);

  useEffect(() => {
    // Auto-detect Android TV / Fire TV user agents
    const ua = navigator.userAgent.toLowerCase();
    if (
      ua.includes('aft') || // Amazon Fire TV
      ua.includes('android tv') ||
      ua.includes('smarttv') ||
      ua.includes('tizen') ||
      ua.includes('webos')
    ) {
      setIsTVMode(true);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInput && e.key !== 'Escape' && e.key !== 'ArrowDown') {
        return;
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      // Enable TV focus ring visuals automatically when D-pad arrows are used
      setIsTVMode(true);

      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>('[data-focusable="true"]:not([disabled])')
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement;
      if (!active || !focusables.includes(active)) {
        e.preventDefault();
        focusables[0].focus();
        return;
      }

      e.preventDefault();
      const activeRect = active.getBoundingClientRect();
      const activeCx = activeRect.left + activeRect.width / 2;
      const activeCy = activeRect.top + activeRect.height / 2;

      let bestCandidate: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const candidate of focusables) {
        if (candidate === active) continue;
        const rect = candidate.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = cx - activeCx;
        const dy = cy - activeCy;

        let isValidDirection = false;
        let primaryDist = 0;
        let crossDist = 0;

        if (e.key === 'ArrowRight' && dx > 10) {
          isValidDirection = true;
          primaryDist = dx;
          crossDist = Math.abs(dy);
        } else if (e.key === 'ArrowLeft' && dx < -10) {
          isValidDirection = true;
          primaryDist = -dx;
          crossDist = Math.abs(dy);
        } else if (e.key === 'ArrowDown' && dy > 10) {
          isValidDirection = true;
          primaryDist = dy;
          crossDist = Math.abs(dx);
        } else if (e.key === 'ArrowUp' && dy < -10) {
          isValidDirection = true;
          primaryDist = -dy;
          crossDist = Math.abs(dx);
        }

        if (!isValidDirection) continue;

        // Weighted Euclidean distance favoring alignment along the movement axis
        const score = primaryDist + crossDist * 2.5;
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        bestCandidate.focus({ preventScroll: false });
        bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isTVMode, setIsTVMode };
}
