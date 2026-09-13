import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAREA — Church Quiz & Learning Platform',
  description: 'Prepare Scripture-based quizzes and bring the whole church into the experience.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--barea-midnight)] text-[var(--barea-ivory)] antialiased">
        <header className="sticky top-0 z-50 border-b border-[var(--barea-slate-border)] bg-[var(--barea-midnight)]/95 backdrop-blur">
          <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
            <a
              href="/"
              className="flex min-h-11 items-center rounded-sm font-serif text-xl font-medium tracking-[0.08em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]"
              aria-label="BAREA home"
            >
              BAREA
            </a>

            <nav aria-label="Primary navigation" className="flex items-center gap-2 sm:gap-5">
              <a
                href="/#how-it-works"
                className="hidden min-h-11 items-center rounded-sm px-2 text-sm font-medium text-[var(--barea-ivory-muted)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:inline-flex"
              >
                How it works
              </a>
              <a
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-sm font-semibold text-white hover:text-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:px-2"
              >
                Log in
              </a>
              <a
                href="/#explore-barea"
                className="hidden min-h-11 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-4 text-sm font-bold text-[var(--barea-midnight)] transition-colors hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)] sm:inline-flex"
              >
                Explore BAREA
              </a>
            </nav>
          </div>
        </header>

        <main className="w-full">{children}</main>

        <footer className="border-t border-[var(--barea-slate-border)] bg-[var(--barea-midnight)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-[var(--barea-ivory-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <span>BAREA</span>
            <span>Scripture • Community • Learning</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
