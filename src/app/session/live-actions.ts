'use server';

import { revalidatePath } from 'next/cache';
import {
  type QuizSession
} from '../../domain/session';
import {
  ParticipantToken,
  validateParticipantToken
} from '../../domain/value-objects';
import {
  BareaDomainError
} from '../../domain/domain-errors';
import {
  LiveSessionState,
  type ParticipantLiveView,
  type HostLiveView,
  type LiveQuizEvent
} from '../../domain/live-quiz';
import {
  getLiveQuizService,
  getAuthorizedTeacherContext
} from '../teacher/review/db';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. unit/integration tests)
  }
}

export type ActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string; readonly httpStatus: number } };

function errorResponse(err: unknown): ActionResult<never> {
  if (err instanceof BareaDomainError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        httpStatus: err.httpStatus
      }
    };
  }

  console.error('[LiveQuizAction Unexpected Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
      httpStatus: 500
    }
  };
}

export async function startLiveQuizAction(sessionId: string): Promise<ActionResult<{ session: QuizSession; liveState: LiveSessionState }>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const result = service.startLiveQuiz(sessionId, teacher.userId);

    safeRevalidate(`/session/${sessionId}`);
    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function lockQuestionAction(sessionId: string, expectedVersion?: number): Promise<ActionResult<{ session: QuizSession; liveState: LiveSessionState }>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const result = service.lockQuestion(sessionId, teacher.userId, expectedVersion);

    safeRevalidate(`/session/${sessionId}`);
    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function openQuestionAction(sessionId: string, expectedVersion?: number): Promise<ActionResult<{ session: QuizSession; liveState: LiveSessionState }>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const result = service.openQuestion(sessionId, teacher.userId, expectedVersion);

    safeRevalidate(`/session/${sessionId}`);
    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function advanceQuestionAction(sessionId: string, expectedVersion?: number): Promise<ActionResult<{ session: QuizSession; liveState: LiveSessionState }>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const result = service.advanceQuestion(sessionId, teacher.userId, expectedVersion);

    safeRevalidate(`/session/${sessionId}`);
    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function completeLiveQuizAction(sessionId: string, expectedVersion?: number): Promise<ActionResult<{ session: QuizSession; liveState: LiveSessionState }>> {
  try {
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const result = service.completeLiveQuiz(sessionId, teacher.userId, expectedVersion);

    safeRevalidate(`/session/${sessionId}`);
    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}

export interface SubmitParticipantAnswerInput {
  sessionId: string;
  token: string;
  questionPosition: number;
  selectedOptionIndices: number[];
  clientTimestamp?: string;
}

export async function submitAnswerAction(input: SubmitParticipantAnswerInput): Promise<ActionResult<{ submissionId: string; submittedAt: string }>> {
  try {
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Payload is required.', httpStatus: 400 }
      };
    }

    const validatedToken = validateParticipantToken(input.token);
    const service = getLiveQuizService();

    const submission = service.submitParticipantAnswer({
      sessionId: input.sessionId,
      token: validatedToken,
      questionPosition: input.questionPosition,
      selectedOptionIndices: input.selectedOptionIndices,
      clientTimestamp: input.clientTimestamp
    });

    safeRevalidate(`/session/${input.sessionId}`);
    return {
      success: true,
      data: {
        submissionId: submission.id,
        submittedAt: submission.submittedAt
      }
    };
  } catch (err) {
    return errorResponse(err);
  }
}

export interface SubmitGroupAnswerInput {
  sessionId: string;
  groupId: string;
  questionPosition: number;
  selectedOptionIndices: number[];
}

export async function submitGroupAnswerAction(input: SubmitGroupAnswerInput): Promise<ActionResult<{ submissionId: string; submittedAt: string }>> {
  try {
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Payload is required.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();

    const submission = service.submitGroupAnswer({
      sessionId: input.sessionId,
      hostUserId: teacher.userId,
      groupId: input.groupId,
      questionPosition: input.questionPosition,
      selectedOptionIndices: input.selectedOptionIndices
    });

    safeRevalidate(`/session/${input.sessionId}`);
    return {
      success: true,
      data: {
        submissionId: submission.id,
        submittedAt: submission.submittedAt
      }
    };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function getParticipantLiveViewAction(sessionId: string, token: string): Promise<ActionResult<ParticipantLiveView>> {
  try {
    if (!sessionId || !token) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Session ID and token are required.', httpStatus: 400 }
      };
    }

    const validatedToken = validateParticipantToken(token);
    const service = getLiveQuizService();
    const view = service.getParticipantLiveView(sessionId, validatedToken);

    return { success: true, data: view };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function getHostLiveViewAction(sessionId: string): Promise<ActionResult<HostLiveView>> {
  try {
    if (!sessionId) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Session ID is required.', httpStatus: 400 }
      };
    }

    const teacher = await getAuthorizedTeacherContext();
    const service = getLiveQuizService();
    const view = service.getHostLiveView(sessionId, teacher.userId);

    return { success: true, data: view };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function reconnectLiveSessionAction(
  sessionId: string,
  token: string,
  lastSeenSequence: number = 0
): Promise<ActionResult<{ view: ParticipantLiveView; missedEvents: readonly LiveQuizEvent[] }>> {
  try {
    if (!sessionId || !token) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Session ID and token are required.', httpStatus: 400 }
      };
    }

    const validatedToken = validateParticipantToken(token);
    const service = getLiveQuizService();
    const result = service.reconnectParticipant(sessionId, validatedToken, lastSeenSequence);

    return { success: true, data: result };
  } catch (err) {
    return errorResponse(err);
  }
}
