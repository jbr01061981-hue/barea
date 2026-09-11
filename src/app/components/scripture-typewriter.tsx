'use client';

import { useEffect, useState } from 'react';

const verses = [
  { text: 'Let the Word dwell richly.', reference: 'Colossians 3:16' },
  { text: 'Your word is a lamp to my feet.', reference: 'Psalm 119:105' },
  { text: 'Is not my word like fire?', reference: 'Jeremiah 23:29' },
] as const;

const TYPE_DELAY = 62;
const DELETE_DELAY = 34;
const HOLD_DELAY = 2200;
const TRANSITION_DELAY = 650;

export function ScriptureTypewriter() {
  const [verseIndex, setVerseIndex] = useState(0);
  const [visibleText, setVisibleText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting' | 'transitioning'>('typing');

  useEffect(() => {
    const verse = verses[verseIndex].text;

    if (phase === 'typing') {
      if (visibleText.length < verse.length) {
        const timer = window.setTimeout(() => {
          setVisibleText(verse.slice(0, visibleText.length + 1));
        }, TYPE_DELAY);
        return () => window.clearTimeout(timer);
      }
      setPhase('holding');
      return;
    }

    if (phase === 'holding') {
      const timer = window.setTimeout(() => setPhase('deleting'), HOLD_DELAY);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'deleting') {
      if (visibleText.length > 0) {
        const timer = window.setTimeout(() => {
          setVisibleText(visibleText.slice(0, -1));
        }, DELETE_DELAY);
        return () => window.clearTimeout(timer);
      }
      setPhase('transitioning');
      return;
    }

    const timer = window.setTimeout(() => {
      setVerseIndex((current) => (current + 1) % verses.length);
      setPhase('typing');
    }, TRANSITION_DELAY);
    return () => window.clearTimeout(timer);
  }, [phase, verseIndex, visibleText]);

  return (
    <div
      className="flex min-h-[14rem] flex-col items-center justify-center text-center sm:min-h-[16rem]"
      aria-live="polite"
      aria-label={`${verses[verseIndex].text} — ${verses[verseIndex].reference}`}
    >
      <p className="max-w-5xl font-serif text-[2.55rem] font-normal leading-[1.12] tracking-[-0.03em] text-[var(--barea-ivory)] sm:text-6xl lg:text-[4.75rem]">
        <span className="italic">“{visibleText}”</span>
        <span
          aria-hidden="true"
          className={`ml-1 inline-block h-[0.95em] w-px align-[-0.08em] bg-[var(--barea-gold)] ${phase === 'transitioning' ? 'opacity-0' : 'animate-pulse'}`}
        />
      </p>
      <p
        className={`mt-8 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[var(--barea-gold)] transition-opacity duration-300 ${phase === 'transitioning' ? 'opacity-0' : 'opacity-100'}`}
      >
        {verses[verseIndex].reference}
      </p>
    </div>
  );
}
