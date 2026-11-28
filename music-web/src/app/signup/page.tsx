'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2, ArrowRight, Check, User } from 'lucide-react';
import {
  AVATAR_PRESETS,
  getAvatarById,
  getAvatarSvgDataUri,
  fetchSupabaseStorageAvatars,
  type AvatarPreset,
} from '@/lib/avatars';

export default function SignUpPage() {
  const router = useRouter();

  // Step 1: 'code' (Verify Access Code) | Step 2: 'account' (Name, Avatar, Email, Password)
  const [step, setStep] = useState<'code' | 'account'>('code');

  const [accessCode, setAccessCode] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [name, setName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('neon-beats');
  const [storageAvatars, setStorageAvatars] = useState<AvatarPreset[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [codeValidating, setCodeValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Load storage avatars if available
  useEffect(() => {
    fetchSupabaseStorageAvatars().then((avatars) => {
      if (avatars.length > 0) setStorageAvatars(avatars);
    });
  }, []);

  // Step 1: Validate Access Code against Server BFF
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = accessCode.trim();
    if (!code) {
      setError('Please enter an access code to proceed.');
      return;
    }

    setCodeValidating(true);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setCodeValidating(false);

      if (!res.ok || !data.valid) {
        setError(data.error || 'Invalid access code. Please check your code or request one from the owner.');
        return;
      }

      // Code is valid! Transition to step 2 (account credentials)
      setVerifiedCode(code);
      setStep('account');
    } catch (err: unknown) {
      setCodeValidating(false);
      setError(err instanceof Error ? err.message : 'Failed to verify code. Please try again.');
    }
  }

  // Step 2: Create Account in Server BFF
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!verifiedCode) {
      setError('Please verify your access code first.');
      setStep('code');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!selectedAvatarId) {
      setError('Please choose an avatar.');
      return;
    }

    setLoading(true);

    const avatarPreset = getAvatarById(selectedAvatarId);
    const avatarDataUri = getAvatarSvgDataUri(avatarPreset);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: verifiedCode,
          email: email.trim(),
          password,
          name: name.trim(),
          avatarId: selectedAvatarId,
          avatarUrl: avatarDataUri,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok || data.error) {
        if (data.error && data.error.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Try signing in instead.');
        } else {
          setError(data.error || 'Failed to create account.');
        }
        return;
      }

      // Save profile to local storage for immediate cache
      try {
        localStorage.setItem(
          'vyla_user_profile',
          JSON.stringify({
            display_name: name.trim(),
            avatar_id: selectedAvatarId,
            avatar_url: avatarDataUri,
          })
        );
      } catch {}

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Connection error. Please try again.');
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10 bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-900 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <img src="/icon.svg" alt="Frosh Music" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-white leading-none">
              Frosh <span className="font-light text-emerald-400">Music</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">Stream everywhere</p>
          </div>
        </div>

        {/* Step Indicator & Title */}
        {step === 'code' ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <h1 className="text-xl font-bold text-white">Access Code</h1>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Frosh Music is private & invite-only. Enter your access code to unlock account registration.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 text-xs font-semibold flex items-center justify-center">
                2
              </span>
              <h1 className="text-xl font-bold text-white">Create Account</h1>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Enter your email and choose a password to sign in with later.
            </p>

            {/* Verified code badge */}
            <div className="mb-5 flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              <span className="flex items-center gap-1.5 font-medium truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Code: <span className="tracking-wide uppercase font-mono">{verifiedCode}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep('code');
                  setError(null);
                }}
                className="text-emerald-400 underline hover:text-emerald-300 shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          </>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Notice message */}
        {notice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200">
            {notice}{' '}
            <Link href="/login" className="font-medium underline">
              Go to sign in
            </Link>
          </div>
        )}

        {/* Step 1 Form: Access Code */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="access-code" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Access Code
              </label>
              <div className="relative">
                <input
                  id="access-code"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="e.g. VIP-2026"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 uppercase tracking-wider font-mono text-sm"
                />
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                Don&apos;t have a code? Ask the server owner for an invitation.
              </p>
            </div>

            <button
              type="submit"
              disabled={codeValidating || !accessCode.trim()}
              className="w-full py-2.5 rounded-full bg-emerald-500 text-zinc-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {codeValidating && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{codeValidating ? 'Verifying code…' : 'Continue'}</span>
              {!codeValidating && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* Step 2 Form: Name, Avatar, Email & Password */}
        {step === 'account' && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            {/* 1. Name Input (Required) */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Your Name <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="name"
                  type="text"
                  required
                  autoFocus
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 2. Choose Avatar (Required) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-300">
                  Choose Avatar <span className="text-emerald-400">*</span>
                </label>
                <span className="text-xs text-emerald-400 font-medium">
                  {getAvatarById(selectedAvatarId).name}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1.5 rounded-xl bg-zinc-900/60 border border-white/10">
                {[...storageAvatars, ...AVATAR_PRESETS].map((preset) => {
                  const isSelected = selectedAvatarId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(preset.id)}
                      className={`relative flex flex-col items-center p-1.5 rounded-xl transition-all cursor-pointer hover:scale-105 ${
                        isSelected
                          ? 'border-2 border-emerald-400 ring-2 ring-emerald-500/30 bg-emerald-500/10'
                          : 'border border-white/5 hover:border-white/20 bg-zinc-900'
                      }`}
                      title={preset.name}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg bg-gradient-to-br ${preset.gradient} flex items-center justify-center text-lg shadow overflow-hidden`}
                      >
                        {preset.imageUrl ? (
                          <img src={preset.imageUrl} alt={preset.name} className="w-full h-full object-cover" />
                        ) : (
                          preset.emoji
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 truncate mt-1 w-full text-center">
                        {preset.name.split(' ')[0]}
                      </span>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Email Input (Required) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email <span className="text-emerald-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            {/* 4. Password Input (Required) */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || !selectedAvatarId}
              className="w-full py-2.5 rounded-full bg-emerald-500 text-zinc-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account…' : 'Complete Sign Up'}
            </button>
          </form>
        )}

        <p className="text-sm text-zinc-400 text-center mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
