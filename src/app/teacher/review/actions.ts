'use server';

import { revalidatePath } from 'next/cache';
import {
  QuestionStatus,
  QuestionDifficulty,
  QuestionType,
  type Question,
  type UpdateQuestionPayload
} from '../../../domain/question';
import {
  getQuestionBankService,
  getAIGenerationService,
  getAuthorizedTeacherContext,
} from './db';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. unit/integration tests)
  }
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Returns pending review questions strictly scoped to the server-authorized teacher's organization.
 * Client input cannot override or influence the organization context.
 */
export async function getPendingQuestionsAction(): Promise<ActionResponse<Question[]>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();
    const all = bankService.listQuestions(context.organizationId, {
      status: QuestionStatus.PENDING_REVIEW,
    });
    return { success: true, data: all };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves a single question by ID, enforcing that it belongs strictly to the server-authorized organization.
 * Forged IDs from other organizations return Not Found to prevent tenant disclosure.
 */
export async function getQuestionByIdAction(
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();
    const q = bankService.getQuestion(context.organizationId, questionId);
    if (!q) {
      return { success: false, error: `Question ${questionId} not found.` };
    }
    return { success: true, data: q };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Updates a question's content, enforcing server-derived organization authority.
 * Saving preserves PENDING_REVIEW state (ADR-007).
 */
export async function updateQuestionAction(
  questionId: string,
  updates: {
    stem?: string;
    type?: QuestionType;
    options?: string[];
    correctOptionIndices?: number[];
    explanation?: string;
    scriptureReference?: string;
    topic?: string;
    difficulty?: QuestionDifficulty;
    language?: string;
  }
): Promise<ActionResponse<Question>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();

    // Security Hardening: Reconstruct update payload strictly from an explicit allowlist.
    // Untrusted runtime inputs cannot inject status, organizationId, id, or any unknown properties.
    const sanitizedUpdates: UpdateQuestionPayload = {};

    if (updates.stem !== undefined) sanitizedUpdates.stem = updates.stem;
    if (updates.type !== undefined) sanitizedUpdates.type = updates.type;
    if (updates.options !== undefined) sanitizedUpdates.options = updates.options;
    if (updates.correctOptionIndices !== undefined) sanitizedUpdates.correctOptionIndices = updates.correctOptionIndices;
    if (updates.explanation !== undefined) sanitizedUpdates.explanation = updates.explanation;
    if (updates.scriptureReference !== undefined) sanitizedUpdates.scriptureReference = updates.scriptureReference;
    if (updates.topic !== undefined) sanitizedUpdates.topic = updates.topic;
    if (updates.difficulty !== undefined) sanitizedUpdates.difficulty = updates.difficulty;
    if (updates.language !== undefined) sanitizedUpdates.language = updates.language;

    // In accordance with ADR-007 / domain contract:
    // Updating question content must preserve PENDING_REVIEW state (never automatically approve).
    const updated = bankService.updateQuestion(context.organizationId, questionId, sanitizedUpdates);
    if (!updated) {
      return { success: false, error: `Failed to update question ${questionId}.` };
    }
    safeRevalidate('/teacher/review');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Explicit single approval (PENDING_REVIEW -> APPROVED), scoped to server-derived organization.
 */
export async function approveQuestionAction(
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();
    // Explicit transition: PENDING_REVIEW -> APPROVED
    const approved = bankService.transitionStatus(
      context.organizationId,
      questionId,
      QuestionStatus.APPROVED
    );
    if (!approved) {
      return { success: false, error: `Failed to approve question ${questionId}.` };
    }
    safeRevalidate('/teacher/review');
    return { success: true, data: approved };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Transactional batch approval (all-or-nothing), scoped strictly to server-derived organization.
 */
export async function batchApproveQuestionsAction(
  questionIds: string[]
): Promise<ActionResponse<{ approvedCount: number }>> {
  try {
    if (!questionIds || questionIds.length === 0) {
      return { success: false, error: 'No question IDs provided for batch approval.' };
    }

    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();

    // MUST be transactional: all or nothing
    bankService.transaction(() => {
      for (const id of questionIds) {
        const res = bankService.transitionStatus(
          context.organizationId,
          id,
          QuestionStatus.APPROVED
        );
        if (!res) {
          throw new Error(`Failed to transition question ${id} to APPROVED.`);
        }
      }
    });

    safeRevalidate('/teacher/review');
    return { success: true, data: { approvedCount: questionIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Soft-deletes a question to ARCHIVED, scoped strictly to server-derived organization.
 */
export async function archiveQuestionAction(
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();
    const archived = bankService.archiveQuestion(context.organizationId, questionId);
    if (!archived) {
      return { success: false, error: `Failed to archive question ${questionId}.` };
    }
    safeRevalidate('/teacher/review');
    return { success: true, data: archived };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Regenerates an alternative question candidate, preserving the original and scoping strictly to server-derived organization.
 */
export async function regenerateQuestionAction(
  originalQuestionId: string,
  teacherInstructions?: string
): Promise<ActionResponse<Question>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const bankService = getQuestionBankService();
    const original = bankService.getQuestion(context.organizationId, originalQuestionId);
    if (!original) {
      return { success: false, error: `Original question ${originalQuestionId} not found.` };
    }

    const aiService = getAIGenerationService();

    // Generate 1 new question candidate preserving the topic/passage/difficulty/language
    const result = await aiService.generateQuizQuestions({
      organizationId: context.organizationId,
      topic: original.topic,
      passageReference: original.scriptureReference,
      difficulty: original.difficulty,
      type: original.type,
      language: original.language,
      count: 1,
      teacherInstructions: teacherInstructions || 'Regenerate alternative question addressing this passage/topic.'
    });

    const newQuestion = result.questions[0];
    if (!newQuestion) {
      throw new Error('Regeneration did not produce a valid candidate question.');
    }

    safeRevalidate('/teacher/review');
    return { success: true, data: newQuestion };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}