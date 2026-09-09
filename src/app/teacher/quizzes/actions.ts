'use server';

import { revalidatePath } from 'next/cache';
import {
  QuizStatus,
  ScoringStyle,
  type Quiz,
  type QuizQuestionItem,
  type PublishedQuizSnapshot,
  type UpdateQuizPayload
} from '../../../domain/quiz';
import {
  getQuizService,
  getQuestionBankService,
  getAuthorizedTeacherContext
} from '../review/db';

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

export interface CreateQuizInput {
  title: string;
  description?: string;
  defaultTimeLimitSeconds?: number;
  scoringStyle?: ScoringStyle;
  optionShuffle?: boolean;
}

export interface UpdateQuizInput {
  title?: string;
  description?: string;
  defaultTimeLimitSeconds?: number;
  scoringStyle?: ScoringStyle;
  optionShuffle?: boolean;
}

/**
 * Returns quizzes strictly for the server-authorized teacher's organization.
 */
export async function listQuizzesAction(
  filter?: { status?: QuizStatus; search?: string }
): Promise<ActionResponse<Quiz[]>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();
    const quizzes = service.listQuizzes(context.organizationId, filter);
    return { success: true, data: quizzes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves a single quiz by ID, strictly enforcing organization ownership.
 */
export async function getQuizByIdAction(quizId: string): Promise<ActionResponse<Quiz>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();
    const quiz = service.getQuiz(context.organizationId, quizId);
    if (!quiz) {
      return { success: false, error: `Quiz ${quizId} not found.` };
    }
    return { success: true, data: quiz };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Creates a new DRAFT quiz with strict server-side tenant assignment and runtime allowlisting.
 */
export async function createQuizAction(
  input: CreateQuizInput
): Promise<ActionResponse<Quiz>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    // Security: Reconstruct explicit allowlist
    const sanitizedTitle = typeof input.title === 'string' ? input.title.trim() : '';
    const sanitizedDesc = typeof input.description === 'string' ? input.description : undefined;
    const sanitizedTime = typeof input.defaultTimeLimitSeconds === 'number' ? input.defaultTimeLimitSeconds : undefined;
    const sanitizedScoring = input.scoringStyle === ScoringStyle.SPEED_WEIGHTED ? ScoringStyle.SPEED_WEIGHTED : ScoringStyle.STANDARD;
    const sanitizedShuffle = typeof input.optionShuffle === 'boolean' ? input.optionShuffle : false;

    const quiz = service.createQuiz(context.organizationId, {
      organizationId: context.organizationId,
      title: sanitizedTitle,
      description: sanitizedDesc,
      defaultTimeLimitSeconds: sanitizedTime,
      scoringStyle: sanitizedScoring,
      optionShuffle: sanitizedShuffle
    });

    safeRevalidate('/teacher/quizzes');
    return { success: true, data: quiz };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Updates quiz draft metadata with strict runtime allowlisting.
 * Prevents mutation of id, organizationId, status, publishedSnapshot, etc.
 */
export async function updateQuizAction(
  quizId: string,
  input: Record<string, unknown>
): Promise<ActionResponse<Quiz>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    // Security Invariant: Explicit Allowlist Payload Reconstruction
    const sanitizedUpdates: UpdateQuizPayload = {};

    if (typeof input.title === 'string') {
      sanitizedUpdates.title = input.title;
    }
    if (typeof input.description === 'string' || input.description === null) {
      sanitizedUpdates.description = input.description;
    }
    if (typeof input.defaultTimeLimitSeconds === 'number') {
      sanitizedUpdates.defaultTimeLimitSeconds = input.defaultTimeLimitSeconds;
    }
    if (input.scoringStyle === ScoringStyle.STANDARD || input.scoringStyle === ScoringStyle.SPEED_WEIGHTED) {
      sanitizedUpdates.scoringStyle = input.scoringStyle as ScoringStyle;
    }
    if (typeof input.optionShuffle === 'boolean') {
      sanitizedUpdates.optionShuffle = input.optionShuffle;
    }

    const updated = service.updateQuiz(context.organizationId, quizId, sanitizedUpdates);
    if (!updated) {
      return { success: false, error: `Quiz ${quizId} not found.` };
    }

    safeRevalidate('/teacher/quizzes');
    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Attaches an APPROVED question from the organization's question bank to a DRAFT quiz.
 */
export async function addQuestionToQuizAction(
  quizId: string,
  questionId: string,
  sortOrder?: number
): Promise<ActionResponse<QuizQuestionItem>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    const item = service.addQuestion(context.organizationId, quizId, questionId, sortOrder);

    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: item };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Removes a question from a DRAFT quiz.
 */
export async function removeQuestionFromQuizAction(
  quizId: string,
  questionId: string
): Promise<ActionResponse<{ removed: boolean }>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    const removed = service.removeQuestion(context.organizationId, quizId, questionId);

    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: { removed } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Reorders the questions in a DRAFT quiz.
 */
export async function reorderQuizQuestionsAction(
  quizId: string,
  questionIdsInOrder: string[]
): Promise<ActionResponse<readonly QuizQuestionItem[]>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    if (!Array.isArray(questionIdsInOrder)) {
      return { success: false, error: 'questionIdsInOrder must be an array of question IDs.' };
    }

    const reordered = service.reorderQuestions(context.organizationId, quizId, questionIdsInOrder);

    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: reordered };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Atomically publishes a DRAFT quiz, generating an immutable snapshot under BEGIN IMMEDIATE.
 */
export async function publishQuizAction(
  quizId: string
): Promise<ActionResponse<PublishedQuizSnapshot>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    const snapshot = service.publishQuiz(context.organizationId, quizId, context.userId);

    safeRevalidate('/teacher/quizzes');
    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: snapshot };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Archives a quiz (from DRAFT or PUBLISHED).
 */
export async function archiveQuizAction(quizId: string): Promise<ActionResponse<Quiz>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    const archived = service.archiveQuiz(context.organizationId, quizId);
    if (!archived) {
      return { success: false, error: `Quiz ${quizId} not found.` };
    }

    safeRevalidate('/teacher/quizzes');
    safeRevalidate(`/teacher/quizzes/${quizId}`);
    return { success: true, data: archived };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the published snapshot for a quiz.
 */
export async function getPublishedSnapshotAction(
  quizId: string
): Promise<ActionResponse<PublishedQuizSnapshot>> {
  try {
    const context = await getAuthorizedTeacherContext();
    const service = getQuizService();

    const snapshot = service.getPublishedSnapshot(context.organizationId, quizId);
    if (!snapshot) {
      return { success: false, error: `Published snapshot for quiz ${quizId} not found.` };
    }

    return { success: true, data: snapshot };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
