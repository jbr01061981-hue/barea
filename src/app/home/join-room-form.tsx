'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { lookupRoomAction, joinSessionAction } from '../session/actions';

export function JoinRoomForm() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = roomCode.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid room code.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check room exists and is joinable
      const lookupResult = await lookupRoomAction(trimmed);
      if (!lookupResult.success) {
        setErrorMessage(lookupResult.error.message || 'Room not found or no longer active.');
        setIsSubmitting(false);
        return;
      }

      // Join session using server-authoritative authenticated session
      const joinResult = await joinSessionAction(trimmed);
      if (!joinResult.success) {
        setErrorMessage(joinResult.error.message || 'Could not join session.');
        setIsSubmitting(false);
        return;
      }

      // Successful join; session token and participant registered
      // For now redirect or show session ready message
      setErrorMessage(null);
      // If client-side lobby route exists in future, navigate there; for now notify join success:
      alert(`Joined room ${lookupResult.data.roomCode}! Session ID: ${lookupResult.data.sessionId}`);
      setIsSubmitting(false);
    } catch {
      setErrorMessage('An unexpected error occurred while joining the room.');
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
          {isSubmitting ? 'Joining...' : 'Enter Room'}
        </button>
      </div>
    </form>
  );
}
