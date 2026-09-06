import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAREA — Teacher Review & Approval',
  description: 'Synchronized church quiz preparation & teacher review workbench',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-lg tracking-tight text-slate-900">
                BAREA
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                Teacher Console
              </span>
            </div>
            <nav className="flex items-center space-x-4">
              <a
                href="/teacher/review"
                className="text-sm font-semibold text-slate-900 border-b-2 border-slate-900 pb-1"
              >
                Review Queue
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>BAREA Church Education Platform</span>
            <span>Server-Authoritative • Human Review Gate</span>
          </div>
        </footer>
      </body>
    </html>
  );
}