'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function SignUpPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  // Step 1: 'code' (Verify Access Code) | Step 2: 'account' (Email + Password)
  const [step, setStep] = useState<'code' | 'account'>('code');

  const [accessCode, setAccessCode] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [codeValidating, setCodeValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1: Validate Access Code against Supabase
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        "Sign-up isn't set up yet — the Supabase URL and anon key are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see SUPABASE_AUTH_SETUP.md)."
      );
      return;
    }

    const code = accessCode.trim();
    if (!code) {
      setError('Please enter an access code to proceed.');
      return;
    }

    setCodeValidating(true);

    try {
      // Check validate_access_code RPC first, fall back to validate_invite_code
      let isValid = false;
      const { data: accessValid, error: accessErr } = await supabase.rpc('validate_access_code', {
        p_code: code,
      });

      if (!accessErr && accessValid) {
        isValid = true;
      } else {
        const { data: inviteValid } = await supabase.rpc('validate_invite_code', {
          p_code: code,
        });
        if (inviteValid) isValid = true;
      }

      setCodeValidating(false);

      if (!isValid) {
        setError("Invalid access code. Please check your code or request one from the owner.");
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

  // Step 2: Create Account in Supabase Auth
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError("Supabase client is not available.");
      return;
    }

    if (!verifiedCode) {
      setError('Please verify your access code first.');
      setStep('code');
      return;
    }

    setLoading(true);

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

    // Record code use (best-effort)
    try {
      await supabase.rpc('record_access_code_use', { p_code: verifiedCode });
    } catch {
      try {
        await supabase.rpc('record_invite_code_use', { p_code: verifiedCode });
      } catch {
        // Ignored
      }
    }

    setLoading(false);

    if (data.session) {
      // Email confirmation is off: signed in immediately, straight to Home
      router.push('/');
      router.refresh();
    } else {
      // Email confirmation is on: the account exists but needs confirmation email
      setNotice('Account created! Check your email for the confirmation link, then sign in.');
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10 bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 backdrop-blur-xl">
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

        {/* Step 2 Form: Email & Password */}
        {step === 'account' && (
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
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
              disabled={loading}
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
