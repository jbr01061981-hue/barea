const preparationSteps = [
  { number: '01', title: 'Prepare', text: 'Build a reusable question bank and shape a quiz around your church, class, or Bible study.' },
  { number: '02', title: 'Verify', text: 'AI can accelerate drafting, but every generated question remains under teacher review before it is approved.' },
  { number: '03', title: 'Play', text: 'Bring the room together with a host-led quiz, mobile participation, and a synchronized live experience.' },
];

const experienceCards = [
  { eyebrow: 'For teachers', title: 'Prepare with confidence.', text: 'Generate, review, edit, approve, and assemble scripture-based questions before they reach a quiz.', href: '#how-it-works', action: 'See the teacher workflow' },
  { eyebrow: 'For your church', title: 'Make quiz time feel shared.', text: 'BAREA is being built for classrooms, youth groups, Bible studies, and church-wide fellowship—not a generic quiz app.', href: '#experiences', action: 'See the three experiences' },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--barea-border)] bg-[var(--barea-cream)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold-dark)]">Church quiz &amp; learning platform</p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--barea-ink)] sm:text-6xl lg:text-7xl">Bring the whole room into the Word.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--barea-ink-muted)] sm:text-xl">BAREA helps churches prepare scripture-based quizzes with teacher oversight, then turns that preparation into a shared live experience.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#teacher-entry" className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-ink)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--barea-ink-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2">Teacher sign in</a>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-[var(--barea-radius-control)] border border-[var(--barea-border-strong)] bg-white px-6 text-sm font-semibold text-[var(--barea-ink)] transition-colors hover:bg-[var(--barea-paper)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2">See how BAREA works</a>
            </div>
            <p className="mt-5 text-sm text-[var(--barea-ink-muted)]">Teacher-led preparation first. Live participation grows from there.</p>
          </div>
          <div className="relative lg:pl-8">
            <div className="border-y-2 border-[var(--barea-ink)] py-7 sm:py-8">
              <div id="teacher-entry" className="mb-7 border-b border-[var(--barea-border-strong)] pb-7 sm:mb-8 sm:pb-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold-dark)]">Teacher entry</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--barea-ink-muted)]">Prepare, review, and organize your church quizzes.</p>
                  </div>
                  <a href="#teacher-entry" aria-disabled="true" className="inline-flex min-h-12 w-full shrink-0 cursor-not-allowed items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-ink)] px-5 text-sm font-semibold text-white opacity-60 sm:w-auto">Teacher sign in</a>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--barea-ink-muted)]">Authentication connection pending — no credentials are requested or simulated here.</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--barea-ink-muted)]">The BAREA rhythm</p>
              <div className="mt-7 space-y-6">{preparationSteps.map((step) => <div key={step.number} className="grid grid-cols-[3rem_1fr] gap-4"><span className="pt-0.5 font-mono text-sm font-semibold text-[var(--barea-gold-dark)]">{step.number}</span><div><h2 className="text-xl font-semibold text-[var(--barea-ink)]">{step.title}</h2><p className="mt-1.5 text-sm leading-6 text-[var(--barea-ink-muted)]">{step.text}</p></div></div>)}</div>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="bg-white"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold-dark)]">Built around trust</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--barea-ink)] sm:text-4xl">Technology assists the teacher. It does not replace the teacher.</h2><p className="mt-4 text-base leading-7 text-[var(--barea-ink-muted)]">BAREA keeps biblical and theological review in human hands. AI-generated questions enter a review state before a teacher can approve them into the reusable Question Bank.</p></div><div className="mt-12 grid gap-px overflow-hidden border border-[var(--barea-border)] bg-[var(--barea-border)] md:grid-cols-3">{preparationSteps.map((step) => <article key={step.number} className="bg-[var(--barea-paper)] p-7 sm:p-8"><span className="font-mono text-sm font-semibold text-[var(--barea-gold-dark)]">{step.number}</span><h3 className="mt-8 text-xl font-semibold text-[var(--barea-ink)]">{step.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--barea-ink-muted)]">{step.text}</p></article>)}</div></div></section>
      <section id="experiences" className="border-y border-[var(--barea-border)] bg-[var(--barea-paper)]"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold-dark)]">One platform, distinct experiences</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--barea-ink)] sm:text-4xl">Designed for the way a church actually gathers.</h2></div><p className="max-w-md text-sm leading-6 text-[var(--barea-ink-muted)]">Teacher/Host, Participant, and Projector experiences will be developed as first-class interfaces rather than one dashboard squeezed into every screen.</p></div><div className="mt-12 grid gap-6 lg:grid-cols-2">{experienceCards.map((card) => <article key={card.title} className="flex min-h-72 flex-col border border-[var(--barea-border)] bg-white p-7 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--barea-ink-muted)]">{card.eyebrow}</p><h3 className="mt-4 max-w-md text-2xl font-semibold tracking-[-0.02em] text-[var(--barea-ink)]">{card.title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--barea-ink-muted)]">{card.text}</p><a href={card.href} className="mt-auto inline-flex min-h-11 w-fit items-center border-b border-[var(--barea-ink)] pt-8 text-sm font-semibold text-[var(--barea-ink)] hover:border-[var(--barea-gold-dark)] hover:text-[var(--barea-gold-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-4">{card.action} <span aria-hidden="true" className="ml-2">→</span></a></article>)}</div></div></section>
      <section className="bg-[var(--barea-ink)] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-16"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--barea-gold)]">Ready to prepare?</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Start with the teacher workspace.</h2><p className="mt-3 text-sm leading-6 text-slate-300">The current application already supports the teacher-side quiz management and review foundation. The remaining experiences will be added stage by stage.</p></div><a href="#teacher-entry" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[var(--barea-radius-control)] bg-white px-6 text-sm font-semibold text-[var(--barea-ink)] transition-colors hover:bg-[var(--barea-paper)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-ink)]">Teacher sign in</a></div></section>
    </div>
  );
}
