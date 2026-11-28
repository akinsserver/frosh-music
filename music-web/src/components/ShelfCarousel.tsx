'use client';

import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ShelfCarouselProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ShelfCarousel({
  title,
  subtitle,
  icon,
  children,
  className = '',
}: ShelfCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className={`space-y-3 relative group/shelf ${className}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-xl font-bold tracking-tight text-white truncate">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</p>}
        </div>

        {/* Desktop scroll arrows */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-0 group-hover/shelf:opacity-100 transition-opacity">
          <button
            onClick={() => scroll('left')}
            data-focusable="true"
            aria-label="Scroll left"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all shadow"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            data-focusable="true"
            aria-label="Scroll right"
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all shadow"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Swipeable Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
      >
        {children}
      </div>
    </section>
  );
}
