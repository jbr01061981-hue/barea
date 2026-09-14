import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from './site-nav';

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
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-[var(--barea-midnight)] text-[var(--barea-ivory)] antialiased">
        <header className="border-b border-[var(--barea-slate-border)] bg-[var(--barea-midnight)]">
          <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <a
              href="/"
              className="flex min-h-11 items-center rounded-sm font-serif text-xl font-medium tracking-[0.08em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]"
              aria-label="BAREA home"
            >
              BAREA
            </a>

            <SiteNav />
          </div>
        </header>

        <main className="w-full">{children}</main>

        <footer className="border-t border-[var(--barea-slate-border)] bg-[var(--barea-midnight)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-xs text-[var(--barea-ivory-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>BAREA</span>
            <span>Scripture • Community • Learning</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
