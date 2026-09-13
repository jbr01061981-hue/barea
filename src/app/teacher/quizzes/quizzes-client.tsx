'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { QuizStatus, ScoringStyle, type Quiz } from '../../../domain/quiz';
import { createQuizAction, archiveQuizAction } from './actions';

interface QuizzesClientProps { initialQuizzes: Quiz[]; organizationId: string; }

const statusLabel: Record<'ALL' | QuizStatus, string> = {
  ALL: 'All quizzes',
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export function QuizzesClient({ initialQuizzes }: QuizzesClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [activeTab, setActiveTab] = useState<'ALL' | QuizStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTime, setCreateTime] = useState(30);
  const [createScoring, setCreateScoring] = useState<ScoringStyle>(ScoringStyle.STANDARD);
  const [createShuffle, setCreateShuffle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredQuizzes = quizzes.filter((q) => {
    if (activeTab !== 'ALL' && q.status !== activeTab) return false;
    const term = searchQuery.trim().toLowerCase();
    return !term || q.title.toLowerCase().includes(term) || Boolean(q.description?.toLowerCase().includes(term));
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) { setErrorMsg('Quiz title is required.'); return; }
    startTransition(async () => {
      setErrorMsg(null);
      const res = await createQuizAction({
        title: createTitle.trim(), description: createDesc.trim() || undefined,
        defaultTimeLimitSeconds: createTime, scoringStyle: createScoring, optionShuffle: createShuffle,
      });
      if (!res.success || !res.data) { setErrorMsg(res.error || 'Failed to create quiz.'); return; }
      setQuizzes((prev) => [res.data!, ...prev]);
      setIsCreating(false); setCreateTitle(''); setCreateDesc('');
    });
  };

  const handleArchive = (quizId: string) => {
    if (!confirm('Are you sure you want to archive this quiz?')) return;
    startTransition(async () => {
      const res = await archiveQuizAction(quizId);
      if (res.success && res.data) setQuizzes((prev) => prev.map((q) => q.id === quizId ? res.data! : q));
      else alert(res.error || 'Failed to archive quiz.');
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Curriculum studio</p>
          <h1 className="text-3xl tracking-tight">Quiz Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Prepare Scripture-based quizzes, keep drafts organized, and publish only when they are ready for your church.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-stone-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-stone-800">
          <span aria-hidden="true">+</span> Create new quiz
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-sm border border-stone-200 bg-[#fbfaf7] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Quiz status">
          {(['ALL', QuizStatus.DRAFT, QuizStatus.PUBLISHED, QuizStatus.ARCHIVED] as const).map((tab) => (
            <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-10 rounded-sm px-3 text-xs font-semibold ${activeTab === tab ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200' : 'text-stone-500 hover:bg-white hover:text-stone-800'}`}>
              {statusLabel[tab]}
            </button>
          ))}
        </div>
        <label className="flex min-h-10 items-center border border-stone-200 bg-white px-3 text-sm text-stone-500 lg:w-72">
          <span className="mr-2" aria-hidden="true">⌕</span>
          <span className="sr-only">Search quizzes</span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search quizzes" className="w-full border-0 p-0 text-sm focus:ring-0" />
        </label>
      </div>

      {isCreating && (
        <div className="border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between border-b border-stone-200 pb-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">New draft</p><h2 className="mt-1 font-serif text-xl font-semibold text-stone-900">Create a quiz</h2></div>
            <button type="button" onClick={() => setIsCreating(false)} className="text-sm text-stone-500 hover:text-stone-900">Cancel</button>
          </div>
          {errorMsg && <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>}
          <form onSubmit={handleCreate} className="grid max-w-4xl gap-4">
            <label className="grid gap-1.5 text-xs font-semibold text-stone-700">Quiz title *<input required value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Genesis: Patriarchs & Promises" className="min-h-11 border border-stone-300 px-3 text-sm" /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-stone-700">Description<label className="sr-only">Description</label><textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={3} placeholder="Context or instructions for participants" className="border border-stone-300 px-3 py-2 text-sm" /></label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">Default timer (seconds)<input type="number" min={10} max={120} value={createTime} onChange={(e) => setCreateTime(parseInt(e.target.value, 10) || 30)} className="min-h-11 border border-stone-300 px-3 text-sm" /></label>
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">Scoring style<select value={createScoring} onChange={(e) => setCreateScoring(e.target.value as ScoringStyle)} className="min-h-11 border border-stone-300 px-3 text-sm"><option value={ScoringStyle.STANDARD}>Standard</option><option value={ScoringStyle.SPEED_WEIGHTED}>Speed-weighted</option></select></label>
              <label className="flex min-h-11 items-center gap-2 self-end border border-stone-200 px-3 text-xs font-semibold text-stone-700"><input type="checkbox" checked={createShuffle} onChange={(e) => setCreateShuffle(e.target.checked)} className="h-4 w-4" /> Shuffle options</label>
            </div>
            <div className="flex justify-end border-t border-stone-200 pt-4"><button disabled={isPending} className="min-h-11 bg-stone-900 px-5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">{isPending ? 'Saving…' : 'Save draft'}</button></div>
          </form>
        </div>
      )}

      <div className="grid gap-3">
        {filteredQuizzes.length === 0 ? (
          <div className="border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><p className="font-serif text-xl text-stone-800">No quizzes in this view</p><p className="mt-2 text-sm text-stone-500">Create a draft to begin building your next Scripture quiz.</p></div>
        ) : filteredQuizzes.map((quiz) => (
          <article key={quiz.id} className="border border-stone-200 bg-white p-5 transition-shadow hover:shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Link href={`/teacher/quizzes/${quiz.id}`} className="font-serif text-xl font-semibold text-stone-900 hover:text-stone-600">{quiz.title}</Link><span className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${quiz.status === QuizStatus.PUBLISHED ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : quiz.status === QuizStatus.DRAFT ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>{quiz.status}</span></div>
                {quiz.description && <p className="mt-2 max-w-2xl text-sm leading-5 text-stone-600">{quiz.description}</p>}
                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-stone-500"><div><dt className="inline font-semibold text-stone-700">Questions </dt><dd className="inline">{quiz.questions?.length ?? 0}</dd></div><div><dt className="inline font-semibold text-stone-700">Timer </dt><dd className="inline">{quiz.defaultTimeLimitSeconds}s</dd></div><div><dt className="inline font-semibold text-stone-700">Scoring </dt><dd className="inline">{quiz.scoringStyle === ScoringStyle.SPEED_WEIGHTED ? 'Speed-weighted' : 'Standard'}</dd></div><div><dt className="inline font-semibold text-stone-700">Updated </dt><dd className="inline">{new Date(quiz.updatedAt).toLocaleDateString()}</dd></div></dl>
              </div>
              <div className="flex shrink-0 items-center gap-2"><Link href={`/teacher/quizzes/${quiz.id}`} className="inline-flex min-h-10 items-center border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50">{quiz.status === QuizStatus.DRAFT ? 'Edit draft' : 'Inspect'}</Link>{quiz.status !== QuizStatus.ARCHIVED && <button onClick={() => handleArchive(quiz.id)} disabled={isPending} className="inline-flex min-h-10 items-center border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Archive</button>}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
