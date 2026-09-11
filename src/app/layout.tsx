import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAREA — Church Quiz & Learning Platform',
  description: 'Prepare scripture-based quizzes with teacher oversight and bring the whole church into the experience.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-[var(--barea-bg)] text-[var(--barea-ink)]">
        <header className="border-b border-[var(--barea-border)] bg-white">
          <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
            <a
              href="/"
              className="flex min-h-11 items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2"
              aria-label="BAREA home"
            >
              <span className="text-xl font-bold tracking-[-0.03em] text-[var(--barea-ink)]">BAREA</span>
              <span className="hidden border-l border-[var(--barea-border)] pl-3 text-xs font-medium text-[var(--barea-ink-muted)] sm:inline">
                Church quiz &amp; learning
              </span>
            </a>

            <nav aria-label="Primary navigation" className="flex items-center gap-2 sm:gap-4">
              <a
                href="/#how-it-works"
                className="hidden min-h-11 items-center rounded-sm px-2 text-sm font-medium text-[var(--barea-ink-muted)] hover:text-[var(--barea-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:inline-flex"
              >
                How it works
              </a>
              <a
                href="/#teacher-entry"
                className="inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-sm font-semibold text-[var(--barea-ink)] hover:text-[var(--barea-gold-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:px-2"
              >
                Sign in
              </a>
              <a
                href="/#how-it-works"
                className="hidden min-h-11 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-ink)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--barea-ink-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 sm:inline-flex"
              >
                See the teacher workflow
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full">{children}</main>

        <footer className="border-t border-[var(--barea-border)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-[var(--barea-ink-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
            <span>BAREA Church Education Platform</span>
            <span>Teacher-reviewed • Server-authoritative</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
