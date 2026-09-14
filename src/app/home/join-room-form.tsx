'use client';

import { useState } from 'react';
import { lookupRoomAction } from '../session/actions';

export function JoinRoomForm() {
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<{ roomCode: string; quizTitle: string } | null>(null);

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setVerifiedInfo(null);

    const trimmed = roomCode.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid room code.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate room existence and active status without premature participant mutation
      const lookupResult = await lookupRoomAction(trimmed);
      if (!lookupResult.success) {
        setErrorMessage(lookupResult.error.message || 'Room not found or no longer active.');
        setIsSubmitting(false);
        return;
      }

      setVerifiedInfo({
        roomCode: lookupResult.data.roomCode,
        quizTitle: lookupResult.data.quizTitle,
      });
      setIsSubmitting(false);
    } catch {
      setErrorMessage('An unexpected error occurred while verifying the room.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3" noValidate>
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[var(--barea-radius-control)] border border-red-500/50 bg-red-950/40 p-2.5 text-xs text-red-200"
        >
          {errorMessage}
        </div>
      )}
      {verifiedInfo && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--barea-radius-control)] border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200 space-y-1"
        >
          <div className="font-semibold text-emerald-100">
            Room {verifiedInfo.roomCode} Verified: &ldquo;{verifiedInfo.quizTitle}&rdquo;
          </div>
          <div className="text-emerald-300/80">
            Participant live lobby and play view will connect automatically once synchronized live sessions launch.
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="e.g. 482910"
          maxLength={8}
          aria-label="Room code"
          disabled={isSubmitting}
          className="w-full rounded-[var(--barea-radius-control)] border border-[var(--barea-slate-border)] bg-[var(--barea-paper-dark)] px-3.5 py-2.5 text-sm font-mono tracking-wider text-white placeholder-slate-500 focus:border-[var(--barea-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--barea-gold)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-5 text-xs font-bold uppercase tracking-wider text-[var(--barea-midnight)] transition-colors hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          {isSubmitting ? 'Verifying...' : 'Enter Room'}
        </button>
      </div>
    </form>
  );
}
