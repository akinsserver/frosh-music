export interface AvatarPreset {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  border: string;
  bgHex: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'neon-beats',
    name: 'Neon Beats',
    emoji: '🎧',
    gradient: 'from-emerald-400 via-teal-500 to-emerald-700',
    border: 'border-emerald-400',
    bgHex: '#10b981',
  },
  {
    id: 'vinyl-groove',
    name: 'Vinyl Groove',
    emoji: '🎶',
    gradient: 'from-amber-400 via-orange-500 to-yellow-600',
    border: 'border-amber-400',
    bgHex: '#f59e0b',
  },
  {
    id: 'cyber-synth',
    name: 'Cyber Synth',
    emoji: '⚡',
    gradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    border: 'border-cyan-400',
    bgHex: '#06b6d4',
  },
  {
    id: 'disco-spark',
    name: 'Disco Spark',
    emoji: '🪩',
    gradient: 'from-fuchsia-400 via-pink-500 to-purple-600',
    border: 'border-fuchsia-400',
    bgHex: '#d946ef',
  },
  {
    id: 'cosmic-flow',
    name: 'Cosmic Flow',
    emoji: '🪐',
    gradient: 'from-indigo-400 via-purple-600 to-violet-800',
    border: 'border-indigo-400',
    bgHex: '#6366f1',
  },
  {
    id: 'golden-mic',
    name: 'Golden Mic',
    emoji: '🎙️',
    gradient: 'from-yellow-300 via-amber-400 to-amber-600',
    border: 'border-yellow-400',
    bgHex: '#eab308',
  },
  {
    id: 'afro-vibes',
    name: 'Afro Vibes',
    emoji: '👑',
    gradient: 'from-orange-400 via-amber-500 to-red-600',
    border: 'border-orange-400',
    bgHex: '#f97316',
  },
  {
    id: 'rock-energy',
    name: 'Rock Energy',
    emoji: '🎸',
    gradient: 'from-rose-400 via-red-500 to-rose-700',
    border: 'border-rose-400',
    bgHex: '#f43f5e',
  },
  {
    id: 'bass-sub',
    name: 'Bass Sub',
    emoji: '🔊',
    gradient: 'from-blue-400 via-sky-500 to-indigo-600',
    border: 'border-blue-400',
    bgHex: '#3b82f6',
  },
  {
    id: 'chill-tape',
    name: 'Chill Tape',
    emoji: '📼',
    gradient: 'from-teal-300 via-emerald-400 to-teal-600',
    border: 'border-teal-400',
    bgHex: '#14b8a6',
  },
  {
    id: 'piano-soul',
    name: 'Piano Soul',
    emoji: '🎹',
    gradient: 'from-zinc-200 via-slate-400 to-zinc-600',
    border: 'border-zinc-300',
    bgHex: '#71717a',
  },
  {
    id: 'fire-chart',
    name: 'Fire Chart',
    emoji: '🔥',
    gradient: 'from-amber-400 via-red-500 to-orange-600',
    border: 'border-red-400',
    bgHex: '#ef4444',
  },
];

export function getAvatarById(id?: string | null): AvatarPreset {
  if (!id) return AVATAR_PRESETS[0];
  const found = AVATAR_PRESETS.find((a) => a.id === id || a.name === id);
  return found || AVATAR_PRESETS[0];
}

/**
 * Converts an avatar preset into an inline SVG data URI
 * so it can be stored as avatar_url or used in standard <img src="..." />
 */
export function getAvatarSvgDataUri(preset: AvatarPreset): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="grad-${preset.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${preset.bgHex}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#09090b" stop-opacity="1" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="28" fill="url(#grad-${preset.id})" />
    <circle cx="50" cy="50" r="42" fill="none" stroke="${preset.bgHex}" stroke-width="2" stroke-opacity="0.3" />
    <text x="50" y="58" font-size="40" text-anchor="middle" dominant-baseline="central">${preset.emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
