import { ScriptureTypewriter } from './components/scripture-typewriter';

const preparationSteps = [
  { number: '01', title: 'Prepare', text: 'Create Scripture-based quizzes.' },
  { number: '02', title: 'Verify', text: 'Review every question before it reaches the room.' },
  { number: '03', title: 'Play', text: 'Bring everyone together around the Word.' },
];

const experiences = [
  { title: 'Host', text: 'Prepare and lead the experience.' },
  { title: 'Participant', text: 'Join and take part from your phone.' },
  { title: 'Sanctuary Display', text: 'Share the experience with the whole room.' },
];

export default function HomePage() {
  return (
    <div className="bg-[var(--barea-midnight)] text-[var(--barea-ivory)]">
      <section className="relative flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden border-b border-[var(--barea-slate-border)] px-5 py-20 sm:px-8 lg:px-12">
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[34rem] w-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--barea-gold)] opacity-[0.07] blur-[8rem]" />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <ScriptureTypewriter />
          <p className="mt-9 text-xs font-bold uppercase tracking-[0.32em] text-[var(--barea-ivory-muted)] sm:text-sm">
            Prepare. Learn. Share.
          </p>
          <div className="mt-11 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <a href="#explore-barea" className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-7 text-sm font-bold text-[var(--barea-midnight)] transition-colors hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]">
              Explore BAREA <span aria-hidden="true" className="ml-2">→</span>
            </a>
            <a href="#login" className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] px-7 text-sm font-semibold text-white transition-colors hover:border-[var(--barea-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]">
              Log in
            </a>
          </div>
        </div>
      </section>

      <section id="the-rhythm" className="scroll-mt-20 border-b border-[var(--barea-slate-border)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 max-w-2xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">The BAREA rhythm</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">Simple. Thoughtful. Together.</h2>
          </div>

          <div id="explore-barea" className="mb-8 scroll-mt-20 border border-[var(--barea-gold-muted)] bg-[var(--barea-slate-card)] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-[var(--barea-gold)]">Explore BAREA</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--barea-ivory-muted)]">See how BAREA brings Scripture and people together.</p>
              </div>
              <div id="login" className="scroll-mt-24">
                <span className="sr-only">Login</span>
                <button type="button" disabled aria-disabled="true" className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-6 text-sm font-bold text-[var(--barea-midnight)] opacity-55">
                  Log in
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {preparationSteps.map((step) => (
              <article key={step.number} className="border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-6 sm:p-7">
                <span className="font-mono text-sm font-bold text-[var(--barea-gold)]">{step.number}</span>
                <h3 className="mt-8 font-serif text-2xl text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--barea-ivory-muted)]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">Faithful by design</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">Human review. Thoughtful preparation.</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--barea-ivory-muted)]">Every question gets a human look before it reaches the room.</p>
          </div>
        </div>
      </section>

      <section id="experiences" className="border-b border-[var(--barea-slate-border)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">One platform</p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-4xl">Made for the whole room.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {experiences.map((experience) => (
              <article key={experience.title} className="border border-[var(--barea-slate-border)] bg-[var(--barea-slate-card)] p-6 sm:p-7">
                <h3 className="font-serif text-2xl text-white">{experience.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--barea-ivory-muted)]">{experience.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 border-t border-[var(--barea-slate-border)] pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)]">BAREA</p>
            <h2 className="mt-3 max-w-xl font-serif text-3xl text-white sm:text-4xl">Bring your church together around the Word.</h2>
          </div>
          <a href="#explore-barea" className="inline-flex min-h-11 w-fit items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-6 text-sm font-bold text-[var(--barea-midnight)] hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)]">Explore BAREA</a>
        </div>
      </section>
    </div>
  );
}
