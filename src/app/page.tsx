import { ScriptureTypewriter } from './components/scripture-typewriter';

const preparationSteps = [
  {
    number: '01',
    title: 'Prepare',
    text: 'Create and organize Scripture-based quizzes.',
    label: 'Preparation',
  },
  {
    number: '02',
    title: 'Verify',
    text: 'Review questions before they reach your congregation.',
    label: 'Human review',
  },
  {
    number: '03',
    title: 'Play',
    text: 'Bring everyone together to learn and participate.',
    label: 'Together',
  },
];

const experiences = [
  {
    title: 'Host',
    eyebrow: 'Leader view',
    text: 'Prepare and lead the experience with a clear view of what happens next.',
    icon: '⌘',
  },
  {
    title: 'Participant',
    eyebrow: 'Mobile-first',
    text: 'Join from a phone and take part without losing focus on the room.',
    icon: '⌁',
  },
  {
    title: 'Sanctuary Display',
    eyebrow: 'Large screen',
    text: 'Keep Scripture and the shared experience visible across the room.',
    icon: '□',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--barea-midnight)] text-[var(--barea-ivory)]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="barea-ember-1 absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-[var(--barea-gold)] opacity-[0.08] blur-[100px]" />
        <div className="barea-ember-2 absolute bottom-[18%] right-[6%] h-96 w-96 rounded-full bg-[var(--barea-gold)] opacity-[0.07] blur-[120px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--barea-slate-border)] bg-[var(--barea-midnight)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
          <a href="#top" className="group flex shrink-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-[var(--barea-gold-muted)] bg-[var(--barea-slate-card)] font-serif text-lg text-[var(--barea-gold-light)] transition-colors group-hover:border-[var(--barea-gold)]">B</span>
            <span className="flex flex-col">
              <span className="font-serif text-xl font-medium leading-none tracking-wide text-white transition-colors group-hover:text-[var(--barea-gold-light)]">BAREA</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--barea-ivory-muted)]">Church quiz &amp; learning</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--barea-ivory-muted)] lg:flex">
            <a href="#how-it-works" className="barea-nav-link transition-colors hover:text-white">How it works</a>
            <a href="#the-rhythm" className="barea-nav-link transition-colors hover:text-white">The rhythm</a>
            <a href="#experiences" className="barea-nav-link transition-colors hover:text-white">Experiences</a>
            <a href="#faithful-oversight" className="barea-nav-link transition-colors hover:text-white">Faithful oversight</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a href="#login" className="inline-flex min-h-10 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-4 text-xs font-bold uppercase tracking-wider text-[var(--barea-midnight)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]">
              Log in
            </a>
            <a href="#explore-barea" className="hidden min-h-10 items-center justify-center px-4 text-xs font-bold uppercase tracking-wider text-[var(--barea-gold-light)] transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:inline-flex">
              Explore BAREA <span aria-hidden="true" className="ml-2">→</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 flex flex-col pt-20">
        <section className="relative flex min-h-[calc(100svh-5rem)] items-center justify-center overflow-hidden border-b border-[var(--barea-slate-border)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[28rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--barea-gold)] opacity-[0.055] blur-[110px]" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <p className="mb-7 text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--barea-gold)] sm:text-[11px]">Church quiz &amp; Scripture platform</p>
            <ScriptureTypewriter />
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.34em] text-[var(--barea-ivory-muted)] sm:text-sm">Prepare. Learn. Share.</p>
            <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <a href="#explore-barea" className="inline-flex min-h-12 items-center justify-center px-3 text-sm font-bold text-[var(--barea-gold-light)] transition-all hover:-translate-y-0.5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]">
                Explore BAREA <span aria-hidden="true" className="ml-2 transition-transform">→</span>
              </a>
              <a href="#login" className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-7 text-sm font-bold text-[var(--barea-midnight)] transition-all hover:-translate-y-0.5 hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]">
                Log in
              </a>
            </div>
            <p className="mt-8 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">Bringing church fellowship, youth groups, and congregation together around the Word.</p>
          </div>
        </section>

        <section id="the-rhythm" className="scroll-mt-20 border-b border-[var(--barea-slate-border)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--barea-gold)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">The BAREA rhythm</p>
              </div>
              <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">Orderly. Faithful. Focused.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">A simple cadence for biblical learning in the room, the fellowship hall, or a small group.</p>
            </div>

            <div id="explore-barea" className="mb-7 scroll-mt-24 border border-[var(--barea-gold-muted)] bg-[var(--barea-slate-card)] p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--barea-gold)]">Explore BAREA</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">See how BAREA brings Scripture and people together.</p>
                </div>
                <div id="login" className="scroll-mt-24">
                  <button type="button" disabled aria-disabled="true" className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-6 text-sm font-bold text-[var(--barea-midnight)] opacity-50">Log in</button>
                </div>
              </div>
            </div>

            <div className="grid gap-px overflow-hidden border border-[var(--barea-slate-border)] bg-[var(--barea-slate-border)] md:grid-cols-3">
              {preparationSteps.map((step) => (
                <article key={step.number} className="bg-[var(--barea-slate-card)] p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-wider text-[var(--barea-gold)]">{step.number}</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--barea-ivory-muted)]">{step.label}</span>
                  </div>
                  <h3 className="mt-10 font-serif text-2xl text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--barea-ivory-muted)]">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-b border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--barea-gold)]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">How it works</p>
                </div>
                <h2 className="mt-4 max-w-lg font-serif text-3xl tracking-tight text-white sm:text-4xl">Simple enough to lead. Thoughtful enough to trust.</h2>
              </div>
              <div className="border-l border-[var(--barea-gold-muted)] pl-6 sm:pl-8">
                <p className="font-serif text-xl leading-8 text-[var(--barea-ivory)] sm:text-2xl">Create the questions. Give them a human look. Then bring them into the room.</p>
                <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">BAREA keeps preparation and participation connected without putting the product ahead of the Word.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="experiences" className="scroll-mt-20 border-b border-[var(--barea-slate-border)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--barea-gold)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">Tailored interfaces</p>
              </div>
              <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">Experience BAREA.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">Purpose-built views for the people who prepare, participate, and share the experience.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {experiences.map((experience) => (
                <article key={experience.title} className="group border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--barea-gold-muted)] sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center border border-[var(--barea-gold-muted)] font-serif text-xl text-[var(--barea-gold-light)] transition-colors group-hover:border-[var(--barea-gold)]">{experience.icon}</span>
                    <span className="pt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--barea-ivory-muted)]">{experience.eyebrow}</span>
                  </div>
                  <h3 className="mt-10 font-serif text-2xl text-white">{experience.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--barea-ivory-muted)]">{experience.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faithful-oversight" className="scroll-mt-20 border-b border-[var(--barea-slate-border)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-7 sm:p-10 lg:p-12">
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--barea-gold)] opacity-[0.07] blur-[70px]" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--barea-gold)]" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">Faithful oversight</p>
                </div>
                <h2 className="mt-4 max-w-2xl font-serif text-3xl tracking-tight text-white sm:text-4xl">Human review. Thoughtful preparation.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--barea-ivory-muted)]">Every question gets a human look before it reaches the room.</p>

                <div className="mt-10 grid gap-px overflow-hidden border border-[var(--barea-slate-border)] bg-[var(--barea-slate-border)] sm:grid-cols-3">
                  {[
                    ['01', 'Draft', 'Prepare the question.'],
                    ['02', 'Review', 'Check the question.'],
                    ['03', 'Approved', 'Ready for the room.'],
                  ].map(([number, title, text]) => (
                    <div key={number} className="bg-[var(--barea-midnight)] p-5">
                      <span className="font-mono text-xs font-bold text-[var(--barea-gold)]">{number}</span>
                      <h3 className="mt-5 font-serif text-xl text-white">{title}</h3>
                      <p className="mt-2 text-xs leading-5 text-[var(--barea-ivory-muted)]">{text}</p>
                    </div>
                  ))}
                </div>

                <blockquote className="mt-10 border-l-2 border-[var(--barea-gold)] pl-5 font-serif text-lg italic leading-7 text-[var(--barea-ivory)] sm:text-xl">“They received the message with great eagerness and examined the Scriptures daily.”</blockquote>
                <p className="mt-3 pl-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--barea-gold)]">Acts 17:11</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-5 py-20 text-center sm:px-8 lg:px-12 lg:py-28">
          <div aria-hidden="true" className="barea-halo absolute left-1/2 top-1/2 h-80 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--barea-gold)] opacity-[0.06] blur-[100px]" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center border border-[var(--barea-gold-muted)] font-serif text-xl text-[var(--barea-gold-light)]">✦</span>
            <h2 className="mt-8 font-serif text-3xl leading-tight text-white sm:text-5xl">Bring your church together around the Word.</h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[var(--barea-ivory-muted)]">Explore Scripture-centered quizzes built for shared learning and fellowship.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#explore-barea" className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-[var(--barea-gold-light)] transition-all hover:-translate-y-0.5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]">Explore BAREA <span aria-hidden="true" className="ml-2">→</span></a>
              <a href="#login" className="inline-flex min-h-11 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-6 text-sm font-bold text-[var(--barea-midnight)] transition-all hover:-translate-y-0.5 hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]">Log in</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
