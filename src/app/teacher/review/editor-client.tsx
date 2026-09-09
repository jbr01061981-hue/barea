'use client';

import React, { useState } from 'react';
import type { Question, QuestionDifficulty, QuestionType } from '../../../domain/question';
import { Button } from '../../../ui/button';
import { TextField } from '../../../ui/text-field';
import { ReviewStatusBadge } from '../../../ui/review-status';
import {
  updateQuestionAction,
  approveQuestionAction,
  archiveQuestionAction,
  regenerateQuestionAction,
} from './actions';

export interface EditorClientProps {
  question: Question;
  onClose: () => void;
  onSaved?: (updated: Question) => void;
  onApproved?: (questionId: string) => void;
  onArchived?: (questionId: string) => void;
  onRegenerated?: (newQuestion: Question) => void;
}

export function EditorClient({
  question: initialQuestion,
  onClose,
  onSaved,
  onApproved,
  onArchived,
  onRegenerated,
}: EditorClientProps) {
  const [question, setQuestion] = useState<Question>(initialQuestion);
  const [stem, setStem] = useState(initialQuestion.stem);
  const [options, setOptions] = useState<string[]>([...initialQuestion.options]);
  const [correctOptionIndices, setCorrectOptionIndices] = useState<number[]>([
    ...initialQuestion.correctOptionIndices,
  ]);
  const [explanation, setExplanation] = useState(initialQuestion.explanation || '');
  const [scriptureReference, setScriptureReference] = useState(
    initialQuestion.scriptureReference
  );
  const [topic, setTopic] = useState(initialQuestion.topic);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(
    initialQuestion.difficulty
  );
  const [language, setLanguage] = useState(initialQuestion.language);
  const [type, setType] = useState<QuestionType>(initialQuestion.type);

  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleToggleCorrect = (index: number) => {
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      setCorrectOptionIndices([index]);
    } else {
      // MULTI_SELECT
      if (correctOptionIndices.includes(index)) {
        if (correctOptionIndices.length > 1) {
          setCorrectOptionIndices(correctOptionIndices.filter((i) => i !== index));
        }
      } else {
        setCorrectOptionIndices([...correctOptionIndices, index]);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const res = await updateQuestionAction(question.id, {
        stem,
        options,
        correctOptionIndices,
        explanation,
        scriptureReference,
        topic,
        difficulty,
        language,
        type,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to save changes.');
      } else {
        setQuestion(res.data);
        setSuccessMessage('Edits saved successfully. Question remains Pending Review.');
        if (onSaved) onSaved(res.data);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApproving(true);

    try {
      const res = await approveQuestionAction(question.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to approve question.');
      } else {
        setSuccessMessage('Question approved successfully into Question Bank!');
        if (onApproved) onApproved(question.id);
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to discard/archive this question?')) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsArchiving(true);

    try {
      const res = await archiveQuestionAction(question.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to archive question.');
      } else {
        if (onArchived) onArchived(question.id);
      }
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRegenerate = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRegenerating(true);

    try {
      const res = await regenerateQuestionAction(
        question.id,
        instructions
      );
      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to regenerate question.');
      } else {
        setSuccessMessage('New question candidate generated and staged in Review Queue!');
        if (onRegenerated) onRegenerated(res.data);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Review & Edit Question</h2>
            <ReviewStatusBadge status={question.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            ID: {question.id} • Organization: {question.organizationId}
          </p>
        </div>
        <Button variant="outline" size="sm" onPress={onClose}>
          Close Workbench
        </Button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700 m-6 mb-0">
          <p className="font-semibold">Error</p>
          <p>{errorMessage}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 text-sm text-emerald-800 m-6 mb-0">
          <p className="font-semibold">Success</p>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Workspace Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (60%): Content Editing */}
        <form onSubmit={handleSave} className="lg:col-span-7 flex flex-col gap-6">
          <TextField
            label="Question Stem"
            value={stem}
            onChange={setStem}
            multiline
            rows={3}
            description="Clear, accessible question prompt for participants."
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Answer Options & Correct Answer
            </label>
            <div className="flex flex-col gap-3">
              {options.map((opt, idx) => {
                const isCorrect = correctOptionIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 border rounded transition-colors ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleCorrect(idx)}
                      className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border transition-colors cursor-pointer ${
                        isCorrect
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                      }`}
                      aria-label={`Toggle option ${idx + 1} as correct`}
                    >
                      {isCorrect ? '✓' : idx + 1}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900"
                      placeholder={`Option ${idx + 1}`}
                    />
                    <span className="text-xs font-medium text-slate-400">
                      {isCorrect ? 'Correct Option' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Click the number/checkmark icon to mark the correct answer.
            </p>
          </div>

          <TextField
            label="Explanation"
            value={explanation}
            onChange={setExplanation}
            multiline
            rows={2}
            description="Provides context and teaching value shown after answering."
          />

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="submit"
              variant="secondary"
              isDisabled={isSaving || isApproving}
            >
              {isSaving ? 'Saving Edits...' : 'Save Edits'}
            </Button>
            <span className="text-xs text-slate-500">
              Saving updates the draft content without approving it.
            </span>
          </div>
        </form>

        {/* Right Column (40%): Scripture Inspection, Context, Approval */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Scripture & Theological Inspection Card */}
          <div className="bg-amber-50/40 border border-amber-200/80 rounded-lg p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Scripture & Theological Inspection
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Format Valid
              </span>
            </div>

            <div className="border-t border-amber-200/60 pt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Scripture Reference
              </label>
              <input
                type="text"
                value={scriptureReference}
                onChange={(e) => setScriptureReference(e.target.value)}
                className="w-full text-base scripture-font font-medium text-slate-900 bg-white border border-amber-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Human Verification Gate:</strong> Automated AI generation validates schema formatting only. The human teacher must verify theological truth and scriptural alignment before approving.
            </p>
          </div>

          {/* Metadata Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Classification & Attributes
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                  className="w-full text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType)}
                  className="w-full text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="MULTI_SELECT">Multi-Select</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Language
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Primary Action Controls */}
          <div className="border border-slate-200 rounded-lg p-5 flex flex-col gap-4 bg-white">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Teacher Actions
            </h3>

            {/* Deliberate Approval Action */}
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                onPress={handleApprove}
                isDisabled={isApproving || isSaving || question.status === 'APPROVED'}
                className="w-full"
              >
                {isApproving
                  ? 'Approving...'
                  : question.status === 'APPROVED'
                  ? 'Already Approved'
                  : 'Approve to Question Bank'}
              </Button>
              <p className="text-xs text-slate-500">
                Moves question from PENDING_REVIEW to APPROVED status.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Regeneration Action */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Regenerate Candidate
              </label>
              <input
                type="text"
                placeholder="Optional teacher instructions..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <Button
                variant="outline"
                size="sm"
                onPress={handleRegenerate}
                isDisabled={isRegenerating || isSaving}
              >
                {isRegenerating ? 'Generating Candidate...' : 'Regenerate Candidate'}
              </Button>
              <p className="text-xs text-slate-400">
                Generates a new draft question without modifying the original.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Discard / Archive Action */}
            <div>
              <Button
                variant="danger"
                size="sm"
                onPress={handleArchive}
                isDisabled={isArchiving || isSaving}
                className="w-full"
              >
                {isArchiving ? 'Archiving...' : 'Discard / Archive Question'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}