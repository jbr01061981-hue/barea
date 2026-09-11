import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAREA — Church Quiz Platform',
  description: 'Synchronized church quizzes for Sunday schools, youth ministries, Bible study groups, and fellowship events.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
