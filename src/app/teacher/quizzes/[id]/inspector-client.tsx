'use client';

import React from 'react';
import Link from 'next/link';
import { QuizStatus, type Quiz, type PublishedQuizSnapshot } from '../../../../domain/quiz';

interface QuizInspectorClientProps {
  quiz: Quiz;
  snapshot: PublishedQuizSnapshot | null;
}

export function QuizInspectorClient({ quiz, snapshot }: QuizInspectorClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/teacher/quizzes" className="hover:underline">
              Quizzes
            </Link>
            <span>/</span>
            <span>Published Snapshot Inspector</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">{quiz.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
              quiz.status === QuizStatus.PUBLISHED
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-stone-100 text-stone-600 border border-stone-300'
            }`}
          >
            {quiz.status}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-stone-50 text-stone-600 border border-stone-200">
            Immutable Snapshot v{snapshot?.versionNumber || 1}
          </span>
        </div>
      </div>

      {/* Snapshot Metadata Banner */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
          Frozen Snapshot Configuration (Live Game Authority)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-stone-500 block">Default Timer:</span>
            <span className="font-semibold text-stone-900">
              {snapshot?.defaultTimeLimitSeconds ?? quiz.defaultTimeLimitSeconds} seconds
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Scoring Scheme:</span>
            <span className="font-semibold text-stone-900">
              {snapshot?.scoringStyle ?? quiz.scoringStyle}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Option Shuffle:</span>
            <span className="font-semibold text-stone-900">
              {(snapshot?.optionShuffle ?? quiz.optionShuffle) ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Published At:</span>
            <span className="font-semibold text-stone-900">
              {snapshot?.publishedAt
                ? new Date(snapshot.publishedAt).toLocaleString()
                : new Date(quiz.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Frozen Questions Sheet */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:px-6 bg-stone-50 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-stone-900">
            Frozen Questions ({snapshot?.questions.length || quiz.questions?.length || 0})
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            This content is permanently isolated from Question Bank edits or deletions.
          </p>
        </div>

        <div className="divide-y divide-stone-200">
          {snapshot?.questions.map((q) => (
            <div key={q.id} className="p-5 sm:px-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 text-stone-800 text-xs font-bold flex items-center justify-center border border-stone-300">
                    {q.position}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{q.stem}</p>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                      <span className="font-medium text-stone-800">{q.scriptureReference}</span>
                      <span>•</span>
                      <span>{q.topic}</span>
                      <span>•</span>
                      <span>{q.difficulty}</span>
                      <span>•</span>
                      <span>{q.type}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Choices preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                {q.choices.map((choice) => {
                  const isCorrect = q.correctOptionIndices.includes(choice.choiceIndex);
                  return (
                    <div
                      key={choice.choiceIndex}
                      className={`p-2.5 rounded text-xs border ${
                        isCorrect
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-medium'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      <span className="font-bold mr-2 text-stone-500">
                        {String.fromCharCode(65 + choice.choiceIndex)}.
                      </span>
                      {choice.text}
                      {isCorrect && (
                        <span className="ml-2 text-[10px] font-bold text-emerald-700 uppercase">
                          (Correct)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="ml-9 p-3 rounded bg-amber-50/60 border border-amber-200/80 text-xs text-stone-700">
                  <span className="font-semibold text-amber-900 block mb-0.5">Scriptural Explanation:</span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
