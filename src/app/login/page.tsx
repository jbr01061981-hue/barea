import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-9rem)] bg-[var(--barea-cream)] px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-semibold text-[var(--barea-ink-muted)] hover:text-[var(--barea-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-4"
        >
          ← Back to BAREA
        </Link>

        <div className="mt-10 border border-[var(--barea-border)] bg-white p-7 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold-dark)]">
            Teacher entry
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--barea-ink)] sm:text-4xl">
            Sign in to BAREA
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--barea-ink-muted)]">
            Your teacher workspace is where you prepare, review, and organize quizzes before bringing the room together.
          </p>

          <div className="mt-8 border border-[var(--barea-border)] bg-[var(--barea-paper)] p-5">
            <p className="text-sm font-semibold text-[var(--barea-ink)]">Authentication connection pending</p>
            <p className="mt-2 text-sm leading-6 text-[var(--barea-ink-muted)]">
              The production authentication service is not connected to this frontend yet. No credentials are requested or simulated here.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-ink)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--barea-ink-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2"
            >
              Return to homepage
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] border border-[var(--barea-border-strong)] bg-white px-6 text-sm font-semibold text-[var(--barea-ink)] transition-colors hover:bg-[var(--barea-paper)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2"
            >
              See how BAREA works
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
