'use server';

import { revalidatePath } from 'next/cache';
import {
  QuestionStatus,
  QuestionDifficulty,
  QuestionType,
  type Question,
  type UpdateQuestionPayload
} from '../../../domain/question';
import { getQuestionBankService, getAIGenerationService } from './db';

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

export async function getPendingQuestionsAction(
  organizationId: string
): Promise<ActionResponse<Question[]>> {
  try {
    const bankService = getQuestionBankService();
    const all = bankService.listQuestions(organizationId, {
      status: QuestionStatus.PENDING_REVIEW,
    });
    return { success: true, data: all };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function getQuestionByIdAction(
  organizationId: string,
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const bankService = getQuestionBankService();
    const q = bankService.getQuestion(organizationId, questionId);
    if (!q) {
      return { success: false, error: `Question ${questionId} not found.` };
    }
    return { success: true, data: q };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function updateQuestionAction(
  organizationId: string,
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
    const bankService = getQuestionBankService();
    
    // In accordance with ADR-007 / domain contract:
    // Updating question content must preserve PENDING_REVIEW state (never automatically approve).
    const updated = bankService.updateQuestion(organizationId, questionId, updates);
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

export async function approveQuestionAction(
  organizationId: string,
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const bankService = getQuestionBankService();
    // Explicit transition: PENDING_REVIEW -> APPROVED
    const approved = bankService.transitionStatus(
      organizationId,
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

export async function batchApproveQuestionsAction(
  organizationId: string,
  questionIds: string[]
): Promise<ActionResponse<{ approvedCount: number }>> {
  try {
    if (!questionIds || questionIds.length === 0) {
      return { success: false, error: 'No question IDs provided for batch approval.' };
    }

    const bankService = getQuestionBankService();

    // MUST be transactional: all or nothing
    bankService.transaction(() => {
      for (const id of questionIds) {
        const res = bankService.transitionStatus(
          organizationId,
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

export async function archiveQuestionAction(
  organizationId: string,
  questionId: string
): Promise<ActionResponse<Question>> {
  try {
    const bankService = getQuestionBankService();
    const archived = bankService.archiveQuestion(organizationId, questionId);
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

export async function regenerateQuestionAction(
  organizationId: string,
  originalQuestionId: string,
  teacherInstructions?: string
): Promise<ActionResponse<Question>> {
  try {
    const bankService = getQuestionBankService();
    const original = bankService.getQuestion(organizationId, originalQuestionId);
    if (!original) {
      return { success: false, error: `Original question ${originalQuestionId} not found.` };
    }

    const aiService = getAIGenerationService();

    // Generate 1 new question candidate preserving the topic/passage/difficulty/language
    const result = await aiService.generateQuizQuestions({
      organizationId,
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