'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithPasswordAction } from './actions';

interface LoginClientProps {
  readonly initialReturnTo: string;
  readonly initialError?: string;
}

export function LoginClient({ initialReturnTo, initialError }: LoginClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('password', password);
    formData.set('returnTo', initialReturnTo);

    try {
      const result = await loginWithPasswordAction(formData);
      if (result.success && result.data) {
        router.push(result.data.returnTo);
        router.refresh();
      } else {
        setErrorMessage(result.error || 'Login failed. Please check your credentials.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 rounded-[var(--barea-radius-card)] border border-red-500/50 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <div className="flex items-center gap-2 font-medium">
            <span aria-hidden="true" className="text-red-400">⚠</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Google OAuth Option */}
      <div className="mb-6">
        <a
          href={`/api/auth/google?returnTo=${encodeURIComponent(initialReturnTo)}`}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] px-4 text-sm font-semibold text-white transition-colors hover:border-[var(--barea-gold)] hover:bg-[#182337] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </a>
      </div>

      {/* Divider */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="w-full border-t border-[var(--barea-slate-border)]" />
        <span className="absolute bg-[var(--barea-midnight)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--barea-ivory-muted)]">
          or sign in with email
        </span>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="barea-login-email" className="block text-xs font-bold uppercase tracking-wider text-[var(--barea-ivory-muted)]">
            Email address
          </label>
          <input
            id="barea-login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            className="mt-1.5 block w-full rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[var(--barea-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--barea-gold)] disabled:opacity-50"
            placeholder="you@church.org"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="barea-login-password" className="block text-xs font-bold uppercase tracking-wider text-[var(--barea-ivory-muted)]">
              Password
            </label>
          </div>
          <input
            id="barea-login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            className="mt-1.5 block w-full rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-[var(--barea-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--barea-gold)] disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-6 text-sm font-bold text-[var(--barea-midnight)] transition-colors hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Log in'}
          </button>
        </div>
      </form>
    </div>
  );
}
