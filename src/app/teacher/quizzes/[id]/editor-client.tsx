'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScoringStyle, type Quiz } from '../../../../domain/quiz';
import { type Question } from '../../../../domain/question';
import {
  updateQuizAction,
  addQuestionToQuizAction,
  removeQuestionFromQuizAction,
  reorderQuizQuestionsAction,
  publishQuizAction
} from '../actions';

interface QuizEditorClientProps {
  quiz: Quiz;
  approvedBankQuestions: Question[];
  organizationId: string;
}

export function QuizEditorClient({ quiz, approvedBankQuestions }: QuizEditorClientProps) {
  const router = useRouter();
  const [currentQuiz, setCurrentQuiz] = useState<Quiz>(quiz);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [defaultTimeLimitSeconds, setDefaultTimeLimitSeconds] = useState(quiz.defaultTimeLimitSeconds);
  const [scoringStyle, setScoringStyle] = useState<ScoringStyle>(quiz.scoringStyle);
  const [optionShuffle, setOptionShuffle] = useState(quiz.optionShuffle);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const attachedQuestionIds = new Set(currentQuiz.questions?.map((q) => q.questionId) || []);
  const availableQuestions = approvedBankQuestions.filter((q) => !attachedQuestionIds.has(q.id));

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setStatusMsg(null);
      const res = await updateQuizAction(currentQuiz.id, {
        title: title.trim(),
        description: description.trim() || null,
        defaultTimeLimitSeconds,
        scoringStyle,
        optionShuffle
      });

      if (res.success && res.data) {
        setCurrentQuiz(res.data);
        setStatusMsg({ type: 'success', text: 'Quiz settings saved.' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to save settings.' });
      }
    });
  };

  const handleAddQuestion = (questionId: string) => {
    startTransition(async () => {
      setStatusMsg(null);
      const res = await addQuestionToQuizAction(currentQuiz.id, questionId);
      if (res.success) {
        router.refresh();
        setIsModalOpen(false);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to add question.' });
      }
    });
  };

  const handleRemoveQuestion = (questionId: string) => {
    startTransition(async () => {
      setStatusMsg(null);
      const res = await removeQuestionFromQuizAction(currentQuiz.id, questionId);
      if (res.success) {
        router.refresh();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to remove question.' });
      }
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const questions = currentQuiz.questions || [];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newOrder = [...questions.map((q) => q.questionId)];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    startTransition(async () => {
      setStatusMsg(null);
      const res = await reorderQuizQuestionsAction(currentQuiz.id, newOrder);
      if (res.success) {
        router.refresh();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to reorder questions.' });
      }
    });
  };

  const handlePublish = () => {
    if ((currentQuiz.questions?.length || 0) === 0) {
      setStatusMsg({ type: 'error', text: 'Cannot publish: quiz must contain at least 1 approved question.' });
      return;
    }

    if (!confirm('Are you ready to publish this quiz? Publishing creates an immutable snapshot for live games.')) {
      return;
    }

    startTransition(async () => {
      setStatusMsg(null);
      const res = await publishQuizAction(currentQuiz.id);
      if (res.success) {
        router.refresh();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to publish quiz.' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header breadcrumb & status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/teacher/quizzes" className="hover:underline">
              Quizzes
            </Link>
            <span>/</span>
            <span>Draft Editor</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">{currentQuiz.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            DRAFT
          </span>
          <button
            onClick={handlePublish}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold rounded-md shadow-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            Publish Quiz
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded text-xs border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Main layout: 2 Columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quiz Questions Sequence */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">
              Questions Sequence ({currentQuiz.questions?.length || 0})
            </h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 shadow-sm"
            >
              + Add from Question Bank
            </button>
          </div>

          <div className="bg-white border border-stone-200 rounded-lg shadow-sm divide-y divide-stone-200">
            {(currentQuiz.questions?.length || 0) === 0 ? (
              <div className="p-8 text-center text-sm text-stone-500">
                No questions added yet. Click &quot;Add from Question Bank&quot; to begin composing.
              </div>
            ) : (
              currentQuiz.questions?.map((item, idx) => (
                <div key={item.questionId} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center border border-stone-200">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-stone-900 line-clamp-2">
                        {item.question?.stem || item.questionId}
                      </p>
                      {item.question && (
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
                          <span className="font-medium text-stone-700">{item.question.scriptureReference}</span>
                          <span>{item.question.topic}</span>
                          <span>{item.question.difficulty}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0 || isPending}
                      className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30 text-xs"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === (currentQuiz.questions?.length || 0) - 1 || isPending}
                      className="p-1 text-stone-500 hover:text-stone-900 disabled:opacity-30 text-xs"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handleRemoveQuestion(item.questionId)}
                      disabled={isPending}
                      className="ml-2 text-xs text-red-600 hover:text-red-800 p-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Quiz Settings Form */}
        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-semibold text-stone-900 border-b border-stone-200 pb-2">
            Quiz Settings
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Quiz Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Default Timer (10 - 120s)</label>
              <input
                type="number"
                min={10}
                max={120}
                value={defaultTimeLimitSeconds}
                onChange={(e) => setDefaultTimeLimitSeconds(parseInt(e.target.value, 10) || 30)}
                className="w-full text-sm px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Scoring Style</label>
              <select
                value={scoringStyle}
                onChange={(e) => setScoringStyle(e.target.value as ScoringStyle)}
                className="w-full text-sm px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-none"
              >
                <option value={ScoringStyle.STANDARD}>Standard (100 pts)</option>
                <option value={ScoringStyle.SPEED_WEIGHTED}>Speed-Weighted (50-100 pts)</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optionShuffle}
                  onChange={(e) => setOptionShuffle(e.target.checked)}
                  className="mr-2 h-4 w-4 rounded border-stone-300 text-stone-900"
                />
                Shuffle Options
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 bg-stone-900 text-white rounded font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 mt-2"
            >
              {isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Add Questions Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-stone-300 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">Add from Approved Question Bank</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 divide-y divide-stone-100 space-y-2">
              {availableQuestions.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No additional approved questions available in the question bank.
                </div>
              ) : (
                availableQuestions.map((q) => (
                  <div key={q.id} className="pt-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-stone-900">{q.stem}</p>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-1">
                        <span className="font-medium text-stone-700">{q.scriptureReference}</span>
                        <span>•</span>
                        <span>{q.topic}</span>
                        <span>•</span>
                        <span>{q.difficulty}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddQuestion(q.id)}
                      disabled={isPending}
                      className="px-3 py-1 text-xs font-medium bg-stone-900 text-white rounded hover:bg-stone-800 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
