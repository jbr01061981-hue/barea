/**
 * Domain representation of immutable finalized session results (podium & participants/groups).
 */

export const ResultSubjectType = Object.freeze({
  PARTICIPANT: 'PARTICIPANT',
  GROUP: 'GROUP'
} as const);
export type ResultSubjectType = (typeof ResultSubjectType)[keyof typeof ResultSubjectType];

export interface SessionResult {
  readonly id: string;
  readonly sessionId: string;
  readonly subjectType: ResultSubjectType;
  readonly participantId: string | null;
  readonly sessionGroupId: string | null;
  readonly displayName: string;
  readonly finalScore: number;
  readonly correctCount: number;
  readonly totalQuestions: number;
  readonly rank: number;
  readonly finalAnswerSubmittedAt: string;
  readonly completedAt: string;
}

export interface FinalizeResultPayload {
  readonly subjectType: ResultSubjectType;
  readonly participantId?: string | null;
  readonly sessionGroupId?: string | null;
  readonly displayName: string;
  readonly finalScore: number;
  readonly correctCount: number;
  readonly totalQuestions: number;
  readonly finalAnswerSubmittedAt: string;
}
