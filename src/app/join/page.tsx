'use client';

import type { FormEvent } from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { lookupRoomAction } from '../session/actions';
import { AdmissionPolicy, ParticipationMode, type SessionPublicInfo } from '../../domain/session';
import { Button } from '../../ui/button';
import { PublicShell } from '../../ui/layout/app-shell';
import { Card, CardBody } from '../../ui/primitives/card';

export default function JoinPage() {
  const [roomCode, setRoomCode] = useState('');
  const [info, setInfo] = useState<SessionPublicInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = roomCode.trim().toUpperCase();
    if (!normalized) {
      setError('Enter the room code from your teacher.');
      return;
    }

    startTransition(async () => {
      setError(null);
      setInfo(null);
      const result = await lookupRoomAction(normalized);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setRoomCode(normalized);
      setInfo(result.data);
    });
  }

  return (
    <PublicShell>
      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-20">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">← Back to BAREA</Link>
        <div className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Join a quiz</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Enter your room code</h1>
          <p className="mt-2 text-base leading-7 text-slate-600">Use the code shown by your teacher or on the presentation screen.</p>
        </div>

        <Card className="mt-8">
          <CardBody>
            <form onSubmit={submit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Room code</span>
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={12}
                  placeholder="ABC123"
                  aria-describedby={error ? 'join-error' : undefined}
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-[0.2em] text-slate-950 placeholder:text-slate-300 focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              {error && <p id="join-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
              <Button type="submit" size="lg" className="w-full" isDisabled={pending}>
                {pending ? 'Checking room…' : 'Continue'}
              </Button>
            </form>
          </CardBody>
        </Card>

        {info && (
          <Card className="mt-4">
            <CardBody>
              <p className="text-sm font-semibold text-slate-500">You found</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{info.quizTitle}</h2>
              {info.workspaceName && <p className="mt-1 text-sm text-slate-600">{info.workspaceName}</p>}
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                {info.participationMode === ParticipationMode.TEACHER_GROUP ? (
                  <p>Your teacher is managing this quiz. Please follow their instructions to participate.</p>
                ) : info.admissionPolicy === AdmissionPolicy.RESTRICTED ? (
                  <p>This quiz is restricted to invited participants. Authentication will be required to continue.</p>
                ) : (
                  <p>This quiz uses authenticated individual participation. Authentication will be required to continue.</p>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">Room {info.roomCode} · {info.totalQuestions} questions</p>
            </CardBody>
          </Card>
        )}
      </section>
    </PublicShell>
  );
}
