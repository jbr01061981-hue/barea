import { SessionStatus, ParticipationMode } from './session';
import { RoomCode, ParticipantToken } from './value-objects';
import { ParticipantQuestionProjection, SnapshotQuestion } from './quiz';

/**
 * Lifecycle states of an individual question during live session execution.
 */
export const QuestionLifecycleState = Object.freeze({
  NOT_STARTED: 'NOT_STARTED', // Live session in lobby, no question active
  PREVIEW: 'PREVIEW',         // Question stem/choices visible to participants, answer window not yet open
  ANSWERING: 'ANSWERING',     // Answer window open, countdown running, submissions accepted
  LOCKED: 'LOCKED',           // Answer window closed/locked, submissions rejected
  COMPLETED: 'COMPLETED'      // All questions in the quiz have concluded
} as const);
export type QuestionLifecycleState = (typeof QuestionLifecycleState)[keyof typeof QuestionLifecycleState];

/**
 * Domain representation of authoritative live session state stored on the server.
 */
export interface LiveSessionState {
  readonly sessionId: string;
  readonly organizationId: string;
  readonly hostUserId: string;
  readonly sessionStatus: SessionStatus;
  readonly participationMode: ParticipationMode;
  readonly stateVersion: number;
  readonly totalQuestions: number;
  readonly currentQuestionPosition: number; // 0 if NOT_STARTED, 1..totalQuestions
  readonly currentQuestionId: string | null;
  readonly questionLifecycleState: QuestionLifecycleState;
  readonly questionOpenedAt: string | null;  // ISO-8601 UTC
  readonly answerDeadlineAt: string | null;  // ISO-8601 UTC
  readonly timeLimitSeconds: number | null;
  readonly serverTime: string;               // ISO-8601 UTC current server timestamp
  readonly isLocked: boolean;
}

/**
 * Projected live state delivered to a participant or projector.
 * Strictly strips correct answers, explanations, and other secret fields.
 */
export interface ParticipantLiveView {
  readonly sessionId: string;
  readonly sessionStatus: SessionStatus;
  readonly stateVersion: number;
  readonly totalQuestions: number;
  readonly currentQuestionPosition: number;
  readonly questionLifecycleState: QuestionLifecycleState;
  readonly question: ParticipantQuestionProjection | null;
  readonly questionOpenedAt: string | null;
  readonly answerDeadlineAt: string | null;
  readonly timeLimitSeconds: number | null;
  readonly serverTime: string;
  readonly hasAnswered: boolean;
  readonly submittedOptionIndices: readonly number[] | null;
}

/**
 * Host view of the live session state, including submission counts and full question details.
 */
export interface HostLiveView {
  readonly state: LiveSessionState;
  readonly currentQuestion: SnapshotQuestion | null;
  readonly totalSubmissionsForCurrentQuestion: number;
  readonly activeParticipantCount: number;
}

/**
 * Recorded participant answer submission.
 */
export interface ParticipantSubmission {
  readonly id: string;
  readonly sessionId: string;
  readonly questionPosition: number;
  readonly questionId: string;
  readonly participantId: string | null;
  readonly userId: string | null;
  readonly sessionGroupId: string | null;
  readonly sessionGroupPupilId: string | null;
  readonly selectedOptionIndices: readonly number[];
  readonly submittedAt: string;         // Authoritative server UTC timestamp
  readonly clientTimestamp?: string;    // Client reported timestamp (telemetry only)
  readonly isWithinDeadline: boolean;
}

/**
 * Supported real-time event types for live synchronization.
 */
export const LiveQuizEventType = Object.freeze({
  SESSION_STARTED: 'SESSION_STARTED',
  QUESTION_PREVIEW: 'QUESTION_PREVIEW',
  QUESTION_OPENED: 'QUESTION_OPENED',
  QUESTION_LOCKED: 'QUESTION_LOCKED',
  QUESTION_ADVANCED: 'QUESTION_ADVANCED',
  ANSWER_SUBMITTED: 'ANSWER_SUBMITTED',
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT: 'PARTICIPANT_LEFT',
  QUIZ_COMPLETED: 'QUIZ_COMPLETED',
  SESSION_CLOSED: 'SESSION_CLOSED'
} as const);
export type LiveQuizEventType = (typeof LiveQuizEventType)[keyof typeof LiveQuizEventType];

/**
 * Real-time event payload broadcast to subscribers.
 */
export interface LiveQuizEvent {
  readonly eventId: string;
  readonly eventType: LiveQuizEventType;
  readonly sessionId: string;
  readonly stateVersion: number;
  readonly sequenceNumber: number;
  readonly timestamp: string; // ISO-8601 UTC
  readonly payload: Record<string, unknown>;
}

export {
  InvalidLiveStateTransitionError,
  AnswerDeadlineExpiredError,
  DuplicateAnswerSubmissionError,
  NotSessionHostError,
  SessionNotActiveError,
  InvalidQuestionChoiceError,
  ConcurrencyConflictError
} from './domain-errors';
