'use client';

import React, { useState } from 'react';
import type { Question } from '../../../domain/question';
import { Button } from '../../../ui/button';
import { Checkbox } from '../../../ui/checkbox';
import { ReviewStatusBadge } from '../../../ui/review-status';
import { EditorClient } from './editor-client';
import { batchApproveQuestionsAction } from './actions';

export interface QueueClientProps {
  initialQuestions: Question[];
  organizationId: string;
  initialActiveId?: string;
}

export function QueueClient({
  initialQuestions,
  organizationId,
  initialActiveId,
}: QueueClientProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(() => {
    if (initialActiveId) {
      return initialQuestions.find((q) => q.id === initialActiveId) || null;
    }
    return null;
  });
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsBatchApproving(true);

    const idsToApprove = Array.from(selectedIds);

    try {
      const res = await batchApproveQuestionsAction(organizationId, idsToApprove);
      if (!res.success) {
        setErrorMessage(res.error || 'Batch approval failed. No questions were approved.');
      } else {
        // Remove approved questions from pending queue
        setQuestions(questions.filter((q) => !selectedIds.has(q.id)));
        setSuccessMessage(`Successfully approved ${idsToApprove.length} questions into Question Bank!`);
        setSelectedIds(new Set());
      }
    } finally {
      setIsBatchApproving(false);
    }
  };

  const handleQuestionSaved = (updated: Question) => {
    setQuestions(questions.map((q) => (q.id === updated.id ? updated : q)));
    setActiveQuestion(updated);
  };

  const handleQuestionApproved = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    setActiveQuestion(null);
  };

  const handleQuestionArchived = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    setActiveQuestion(null);
  };

  const handleQuestionRegenerated = (newQuestion: Question) => {
    setQuestions([newQuestion, ...questions]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Workbench Modal or In-Place Panel if Active Question selected */}
      {activeQuestion && (
        <div className="mb-6">
          <EditorClient
            question={activeQuestion}
            onClose={() => setActiveQuestion(null)}
            onSaved={handleQuestionSaved}
            onApproved={handleQuestionApproved}
            onArchived={handleQuestionArchived}
            onRegenerated={handleQuestionRegenerated}
          />
        </div>
      )}

      {/* Notifications */}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
          <p className="font-semibold">Batch Operation Error</p>
          <p>{errorMessage}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Success</p>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Queue Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Pending Review Queue
          </h1>
          <p className="text-xs text-slate-500">
            Organization: <span className="font-semibold text-slate-700">{organizationId}</span> •{' '}
            {questions.length} questions awaiting teacher verification
          </p>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg">
            <span className="text-xs font-semibold text-slate-700">
              {selectedIds.size} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              onPress={handleBatchApprove}
              isDisabled={isBatchApproving}
            >
              {isBatchApproving
                ? 'Approving Batch...'
                : `Approve ${selectedIds.size} Questions (All-or-Nothing)`}
            </Button>
          </div>
        )}
      </div>

      {/* Queue Items Table / Cards */}
      {questions.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-300 rounded-lg bg-white">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            ✓
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Review Queue Clear
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            All AI-generated questions for this organization have been reviewed and approved or archived.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <th className="p-4 w-12 text-center">
                    <Checkbox
                      isSelected={selectedIds.size === questions.length}
                      isIndeterminate={
                        selectedIds.size > 0 && selectedIds.size < questions.length
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all questions"
                    />
                  </th>
                  <th className="p-4">Question Stem</th>
                  <th className="p-4">Scripture Ref</th>
                  <th className="p-4">Topic</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {questions.map((q) => {
                  const isSelected = selectedIds.has(q.id);
                  const isCurrent = activeQuestion?.id === q.id;
                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-amber-50/60' : isSelected ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <Checkbox
                          isSelected={isSelected}
                          onChange={() => toggleSelect(q.id)}
                          aria-label={`Select question ${q.id}`}
                        />
                      </td>
                      <td className="p-4 max-w-md">
                        <p className="font-medium text-slate-900 line-clamp-2">
                          {q.stem}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {q.options.length} options • Type: {q.type}
                        </p>
                      </td>
                      <td className="p-4 scripture-font font-medium text-slate-800">
                        {q.scriptureReference}
                      </td>
                      <td className="p-4 text-slate-600 text-xs">{q.topic}</td>
                      <td className="p-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="p-4">
                        <ReviewStatusBadge status={q.status} />
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setActiveQuestion(q)}
                        >
                          Review & Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-200">
            {questions.map((q) => {
              const isSelected = selectedIds.has(q.id);
              const isCurrent = activeQuestion?.id === q.id;
              return (
                <div
                  key={q.id}
                  className={`p-4 flex flex-col gap-3 ${
                    isCurrent ? 'bg-amber-50/60' : isSelected ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => toggleSelect(q.id)}
                        aria-label={`Select question ${q.id}`}
                      />
                      <span className="text-xs scripture-font font-semibold text-slate-800">
                        {q.scriptureReference}
                      </span>
                    </div>
                    <ReviewStatusBadge status={q.status} />
                  </div>

                  <p className="text-sm font-medium text-slate-900">{q.stem}</p>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                      {q.difficulty} • {q.topic}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => setActiveQuestion(q)}
                    >
                      Review & Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}