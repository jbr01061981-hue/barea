'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { QuizStatus, ScoringStyle, type Quiz } from '../../../domain/quiz';
import { createQuizAction, archiveQuizAction } from './actions';

interface QuizzesClientProps {
  initialQuizzes: Quiz[];
  organizationId: string;
}

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
    if (activeTab !== 'ALL' && q.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      return (
        q.title.toLowerCase().includes(term) ||
        (q.description && q.description.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setErrorMsg('Quiz title is required.');
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      const res = await createQuizAction({
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        defaultTimeLimitSeconds: createTime,
        scoringStyle: createScoring,
        optionShuffle: createShuffle
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'Failed to create quiz.');
      } else {
        setQuizzes((prev) => [res.data!, ...prev]);
        setIsCreating(false);
        setCreateTitle('');
        setCreateDesc('');
      }
    });
  };

  const handleArchive = (quizId: string) => {
    if (!confirm('Are you sure you want to archive this quiz?')) return;

    startTransition(async () => {
      const res = await archiveQuizAction(quizId);
      if (res.success && res.data) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quizId ? res.data! : q))
        );
      } else {
        alert(res.error || 'Failed to archive quiz.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Controls: Search, Tabs, New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['ALL', QuizStatus.DRAFT, QuizStatus.PUBLISHED, QuizStatus.ARCHIVED] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                activeTab === tab
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              {tab === 'ALL' ? 'All Quizzes' : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm px-3 py-1.5 border border-stone-300 rounded-md shadow-sm focus:ring-1 focus:ring-stone-500 focus:outline-none w-48 sm:w-64"
          />

          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-stone-900 hover:bg-stone-800 transition-colors"
          >
            + Create Quiz
          </button>
        </div>
      </div>

      {/* Creation Modal / Form */}
      {isCreating && (
        <div className="bg-white border border-stone-300 rounded-lg p-6 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900 mb-4 border-b border-stone-200 pb-2">
            New Quiz Details
          </h2>
          {errorMsg && (
            <div className="p-3 mb-4 rounded bg-red-50 text-red-700 text-xs border border-red-200">
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Quiz Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Genesis Patriarchs & Promises"
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:ring-1 focus:ring-stone-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Context or instructions for participants..."
                rows={2}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:ring-1 focus:ring-stone-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Time Limit (Sec)
                </label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={createTime}
                  onChange={(e) => setCreateTime(parseInt(e.target.value, 10) || 30)}
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:ring-1 focus:ring-stone-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Scoring Style
                </label>
                <select
                  value={createScoring}
                  onChange={(e) => setCreateScoring(e.target.value as ScoringStyle)}
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-md focus:ring-1 focus:ring-stone-500 focus:outline-none"
                >
                  <option value={ScoringStyle.STANDARD}>Standard (100 pts)</option>
                  <option value={ScoringStyle.SPEED_WEIGHTED}>Speed-Weighted (50-100 pts)</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center text-xs font-medium text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createShuffle}
                    onChange={(e) => setCreateShuffle(e.target.checked)}
                    className="mr-2 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  Shuffle Options
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quiz Catalog List */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
        {filteredQuizzes.length === 0 ? (
          <div className="py-12 text-center text-stone-500 text-sm">
            No quizzes found in this view.
          </div>
        ) : (
          <ul className="divide-y divide-stone-200">
            {filteredQuizzes.map((quiz) => (
              <li key={quiz.id} className="p-4 sm:px-6 hover:bg-stone-50 transition-colors flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/teacher/quizzes/${quiz.id}`}
                      className="text-base font-semibold text-stone-900 hover:text-stone-600 transition-colors"
                    >
                      {quiz.title}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        quiz.status === QuizStatus.PUBLISHED
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : quiz.status === QuizStatus.DRAFT
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-stone-100 text-stone-600 border border-stone-300'
                      }`}
                    >
                      {quiz.status}
                    </span>
                  </div>
                  {quiz.description && (
                    <p className="text-xs text-stone-600 line-clamp-1">{quiz.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-[11px] text-stone-500">
                    <span>Timer: {quiz.defaultTimeLimitSeconds}s</span>
                    <span>Scoring: {quiz.scoringStyle}</span>
                    <span>Shuffle: {quiz.optionShuffle ? 'Yes' : 'No'}</span>
                    <span>Updated: {new Date(quiz.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/teacher/quizzes/${quiz.id}`}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    {quiz.status === QuizStatus.DRAFT ? 'Edit Draft' : 'Inspect'}
                  </Link>
                  {quiz.status !== QuizStatus.ARCHIVED && (
                    <button
                      onClick={() => handleArchive(quiz.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
