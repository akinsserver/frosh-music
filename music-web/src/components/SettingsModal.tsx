'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  User,
  Check,
  Radio,
  Copy,
  LogOut,
  Sparkles,
  Loader2,
  Users,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  AVATAR_PRESETS,
  getAvatarById,
  getAvatarSvgDataUri,
  fetchSupabaseStorageAvatars,
  type AvatarPreset,
} from '@/lib/avatars';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: { name: string; avatarId: string }) => void;
}

export function SettingsModal({ isOpen, onClose, onProfileUpdated }: SettingsModalProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('neon-beats');
  const [storageAvatars, setStorageAvatars] = useState<AvatarPreset[]>([]);

  // Listening party state
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [partyStatus, setPartyStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load user data on open
  useEffect(() => {
    if (!isOpen) return;

    // Fast-load from localStorage cache if available
    try {
      const cached = localStorage.getItem('vyla_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.display_name) setName(parsed.display_name);
        if (parsed.avatar_id) setSelectedAvatarId(parsed.avatar_id);
      }
    } catch {}

    // Load custom image avatars from Supabase Storage bucket via BFF
    fetchSupabaseStorageAvatars().then((avatars) => {
      if (avatars.length > 0) setStorageAvatars(avatars);
    });

    setLoading(true);
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setLoading(false);
        const user = data?.user;
        if (user) {
          setEmail(user.email || '');
          const metaName = user.user_metadata?.display_name || user.user_metadata?.full_name;
          const metaAvatar = user.user_metadata?.avatar_id;
          if (metaName) setName(metaName);
          if (metaAvatar) setSelectedAvatarId(metaAvatar);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const currentAvatar = getAvatarById(selectedAvatarId);

  async function handleSaveProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const avatarObj = getAvatarById(selectedAvatarId);
      const avatarUrl = getAvatarSvgDataUri(avatarObj);

      // 1. Update profile via BFF server endpoint
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          avatarId: selectedAvatarId,
          avatarUrl,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile');
      }

      // 2. Save to local storage for instant sync
      localStorage.setItem(
        'vyla_user_profile',
        JSON.stringify({
          display_name: name.trim(),
          avatar_id: selectedAvatarId,
          avatar_url: avatarUrl,
        })
      );

      if (onProfileUpdated) {
        onProfileUpdated({ name: name.trim(), avatarId: selectedAvatarId });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('[Settings] Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleSelectAvatar(preset: AvatarPreset) {
    setSelectedAvatarId(preset.id);
  }

  function handleStartParty() {
    const randomCode = 'PARTY-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setPartyCode(randomCode);
    setPartyStatus(`Listening Party active! Share room code "${randomCode}" with friends.`);
  }

  function handleCopyPartyCode() {
    if (!partyCode) return;
    navigator.clipboard.writeText(partyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleJoinParty(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setPartyStatus(`Connected to party "${code}"! (Realtime synchronization will activate soon)`);
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('vyla_user_profile');
    onClose();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 border border-white/10 p-6 sm:p-7 shadow-2xl text-white space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Settings & Profile</h2>
              <p className="text-xs text-zinc-400">Personalize your account & listening party</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-focusable="true"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card & Avatar Preview */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentAvatar.gradient} flex items-center justify-center text-3xl shadow-lg shadow-black/40 border-2 ${currentAvatar.border} shrink-0 overflow-hidden`}
          >
            {currentAvatar.imageUrl ? (
              <img src={currentAvatar.imageUrl} alt={currentAvatar.name} className="w-full h-full object-cover" />
            ) : (
              currentAvatar.emoji
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-white truncate">
              {name.trim() || 'Anonymous Listener'}
            </p>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{email || 'Local User'}</p>
            <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              Avatar: {currentAvatar.name}
            </span>
          </div>
        </div>

        {/* Edit Name Form */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Display Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              data-focusable="true"
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => handleSaveProfile()}
              disabled={saving || !name.trim()}
              data-focusable="true"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm transition-all shadow-md flex items-center gap-1.5 shrink-0"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : null}
              <span>{saveSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* Avatar Preset Grid */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Choose Your Avatar
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {[...storageAvatars, ...AVATAR_PRESETS].map((preset) => {
              const isSelected = selectedAvatarId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    handleSelectAvatar(preset);
                  }}
                  data-focusable="true"
                  className={`relative flex flex-col items-center p-2 rounded-2xl bg-zinc-950 border transition-all cursor-pointer hover:scale-105 ${
                    isSelected
                      ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                  title={preset.name}
                >
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${preset.gradient} flex items-center justify-center text-xl shadow-md overflow-hidden`}
                  >
                    {preset.imageUrl ? (
                      <img src={preset.imageUrl} alt={preset.name} className="w-full h-full object-cover" />
                    ) : (
                      preset.emoji
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 truncate mt-1 w-full text-center">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center text-[10px] shadow">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Listening Party Section */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-zinc-950 border border-indigo-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Listening Party</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              BETA
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Stream together in synchronized harmony with your friends. (We will build on this later)
          </p>

          {/* Start or Join Actions */}
          <div className="space-y-2 pt-1">
            {partyCode ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <div>
                  <p className="text-[11px] text-indigo-300 uppercase font-semibold">Your Room Code</p>
                  <p className="text-base font-mono font-bold tracking-wider text-white mt-0.5">
                    {partyCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPartyCode}
                  data-focusable="true"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-zinc-950 text-xs font-bold transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartParty}
                data-focusable="true"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Radio className="w-4 h-4" />
                <span>Start a New Party</span>
              </button>
            )}

            <form onSubmit={handleJoinParty} className="flex gap-2 pt-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter room code to join"
                data-focusable="true"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder-zinc-500 uppercase tracking-wider font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!joinCode.trim()}
                data-focusable="true"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-white transition-colors"
              >
                Join
              </button>
            </form>

            {partyStatus && (
              <p className="text-xs text-indigo-300 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 mt-2">
                {partyStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer: Sign Out & Close */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleSignOut}
            data-focusable="true"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSaveProfile();
              onClose();
            }}
            data-focusable="true"
            className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
