'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SignUpPage() {
  // One browser client for the life of this page; null when Supabase is not
  // configured (env vars missing).
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError(
        "Sign-up isn't set up yet — the Supabase URL and anon key are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see SUPABASE_AUTH_SETUP.md)."
      );
      return;
    }

    const code = inviteCode.trim();
    if (!code) {
      setError('Enter your invite code to sign up.');
      return;
    }

    setLoading(true);

    // 1. Check the invite code against Supabase. The code itself is never
    //    stored anywhere in this app — it is hashed inside the database and
    //    only a yes/no comes back.
    const { data: codeValid, error: codeError } = await supabase.rpc(
      'validate_invite_code',
      { p_code: code }
    );

    if (codeError || !codeValid) {
      setLoading(false);
      setError("That invite code isn't valid. Check it and try again.");
      return;
    }

    // 2. Create the account in Supabase Auth.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setLoading(false);
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // 3. Count one use of the code (best-effort), then clear it from the form
    //    so it is never kept around in the page.
    try {
      await supabase.rpc('record_invite_code_use', { p_code: code });
    } catch {
      // Uses are informational only; a failed count must not block sign-up.
    }
    setInviteCode('');
    setLoading(false);

    if (data.session) {
      // Email confirmation is off: signed in immediately, straight to Home.
      router.push('/');
      router.refresh();
    } else {
      // Email confirmation is on: the account exists but needs the emailed link.
      setNotice(
        'Account created. Check your email for the confirmation link, then sign in.'
      );
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10 bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
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

        <h1 className="text-xl font-bold text-white">Sign up</h1>
        <p className="text-sm text-zinc-400 mt-1 mb-6">
          Sign-ups are invite-only. You&apos;ll need a code from the owner.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-200">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200">
            {notice}{' '}
            <Link href="/login" className="font-medium underline">
              Go to sign in
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Password
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
                className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="invite-code" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Invite code
            </label>
            <input
              id="invite-code"
              type="text"
              required
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 uppercase"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              Any one of the owner&apos;s active codes works.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-full bg-emerald-500 text-zinc-950 font-semibold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

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
