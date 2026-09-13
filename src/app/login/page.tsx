import { Metadata } from 'next';
import { sanitizeReturnTo } from './url-utils';
import { LoginClient } from './login-client';

export const metadata: Metadata = {
  title: 'Log In — BAREA',
  description: 'Log in to your BAREA account to access quizzes, question preparation, and sessions.'
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(params?.returnTo);
  const error = params?.error;

  return (
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 bg-[var(--barea-midnight)] text-[var(--barea-ivory)]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <p className="font-serif text-2xl font-semibold tracking-[0.08em] text-[var(--barea-gold)]">
          BAREA
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Log in
        </h1>
        <p className="mt-2 text-sm text-[var(--barea-ivory-muted)]">
          Continue to church quiz preparation, review, and learning.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-[var(--barea-radius-card)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-6 sm:p-8 shadow-xl">
          <LoginClient initialReturnTo={returnTo} initialError={error} />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--barea-ivory-muted)]">
          Church quiz platform for deeper faith and brighter generations.
        </p>
      </div>
    </div>
  );
}
