import Link from 'next/link';
import { PublicShell } from '../ui/layout/app-shell';

export default function HomePage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[var(--barea-accent)]">Church quiz platform</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Bring your church together, one question at a time.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            BAREA helps teachers create, host, and share Scripture quizzes for Sunday schools, youth groups, Bible studies, and fellowship events.
          </p>
        </div>

        <div className="mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <Link href="/join" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
            <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-slate-950 text-lg text-white" aria-hidden="true">→</div>
            <h2 className="text-xl font-bold text-slate-950">Join a quiz</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter the room code from your teacher and follow the quiz from your device.</p>
            <span className="mt-5 inline-block text-sm font-bold text-slate-950 group-hover:underline">Join a quiz →</span>
          </Link>

          <Link href="/teacher/quizzes" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
            <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-950" aria-hidden="true">+</div>
            <h2 className="text-xl font-bold text-slate-950">Host a quiz</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Create and manage Scripture quizzes from the teacher workspace.</p>
            <span className="mt-5 inline-block text-sm font-bold text-slate-950 group-hover:underline">Open teacher workspace →</span>
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <span>Teacher-led groups</span>
          <span>Authenticated participants</span>
          <span>Server-authoritative sessions</span>
        </div>
      </section>
    </PublicShell>
  );
}
