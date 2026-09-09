import { QuestionDifficulty, QuestionType, type Question } from './question';

export const QuizStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED'
} as const);
export type QuizStatus = (typeof QuizStatus)[keyof typeof QuizStatus];

export const ScoringStyle = Object.freeze({
  STANDARD: 'STANDARD',
  SPEED_WEIGHTED: 'SPEED_WEIGHTED'
} as const);
export type ScoringStyle = (typeof ScoringStyle)[keyof typeof ScoringStyle];

export const QUIZ_LIMITS = Object.freeze({
  MIN_TIME_LIMIT_SECONDS: 10,
  MAX_TIME_LIMIT_SECONDS: 120,
  DEFAULT_TIME_LIMIT_SECONDS: 30,
  BASE_POINTS: 100,
  FLOOR_POINTS: 50
});

export interface QuizQuestionItem {
  readonly quizId: string;
  readonly questionId: string;
  readonly sortOrder: number;
  readonly addedAt: string;
  // Hydrated details when joined
  readonly question?: Question;
}

export interface Quiz {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: QuizStatus;
  readonly defaultTimeLimitSeconds: number;
  readonly scoringStyle: ScoringStyle;
  readonly optionShuffle: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly questions?: readonly QuizQuestionItem[];
}

export interface CreateQuizPayload {
  readonly id?: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly defaultTimeLimitSeconds?: number;
  readonly scoringStyle?: ScoringStyle;
  readonly optionShuffle?: boolean;
  readonly createdAt?: string;
}

export interface UpdateQuizPayload {
  title?: string;
  description?: string | null;
  defaultTimeLimitSeconds?: number;
  scoringStyle?: ScoringStyle;
  optionShuffle?: boolean;
}

export interface SnapshotChoice {
  readonly choiceIndex: number;
  readonly text: string;
}

export interface SnapshotQuestion {
  readonly id: string;
  readonly position: number;
  readonly stem: string;
  readonly type: QuestionType;
  readonly choices: readonly SnapshotChoice[];
  readonly correctOptionIndices: readonly number[]; // Retained on server, projected away for participants
  readonly explanation: string;
  readonly scriptureReference: string;
  readonly topic: string;
  readonly difficulty: QuestionDifficulty;
  readonly timeLimitSeconds: number;
}

export interface PublishedQuizSnapshot {
  readonly id: string;
  readonly quizId: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly defaultTimeLimitSeconds: number;
  readonly scoringStyle: ScoringStyle;
  readonly optionShuffle: boolean;
  readonly versionNumber: number;
  readonly publishedAt: string;
  readonly publishedByUserId: string;
  readonly questions: readonly SnapshotQuestion[];
}

/**
 * ADR-004 / NFR-SEC-001 Participant Projection Boundary
 * Strips correctOptionIndices and explanation during active gameplay.
 */
export interface ParticipantChoice {
  readonly choiceIndex: number;
  readonly text: string;
}

export interface ParticipantQuestionProjection {
  readonly id: string;
  readonly position: number;
  readonly stem: string;
  readonly type: QuestionType;
  readonly choices: readonly ParticipantChoice[];
  readonly scriptureReference: string;
  readonly topic: string;
  readonly difficulty: QuestionDifficulty;
  readonly timeLimitSeconds: number;
}

export class QuizValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuizValidationError';
  }
}

export class InvalidQuizLifecycleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuizLifecycleTransitionError';
  }
}

export function validateTimeLimit(timeLimitSeconds: number): number {
  if (
    typeof timeLimitSeconds !== 'number' ||
    !Number.isFinite(timeLimitSeconds) ||
    !Number.isInteger(timeLimitSeconds) ||
    timeLimitSeconds < QUIZ_LIMITS.MIN_TIME_LIMIT_SECONDS ||
    timeLimitSeconds > QUIZ_LIMITS.MAX_TIME_LIMIT_SECONDS
  ) {
    throw new QuizValidationError(
      `Time limit must be an integer between ${QUIZ_LIMITS.MIN_TIME_LIMIT_SECONDS} and ${QUIZ_LIMITS.MAX_TIME_LIMIT_SECONDS} seconds.`
    );
  }
  return timeLimitSeconds;
}

export function validateScoringStyle(scoringStyle: string): ScoringStyle {
  if (scoringStyle !== ScoringStyle.STANDARD && scoringStyle !== ScoringStyle.SPEED_WEIGHTED) {
    throw new QuizValidationError(
      `Invalid scoring style '${scoringStyle}'. Allowed: ${ScoringStyle.STANDARD}, ${ScoringStyle.SPEED_WEIGHTED}`
    );
  }
  return scoringStyle as ScoringStyle;
}

export function validateCreateQuizPayload(payload: CreateQuizPayload): void {
  if (!payload.organizationId || !payload.organizationId.trim()) {
    throw new QuizValidationError('Organization ID is required and cannot be empty.');
  }
  if (!payload.title || !payload.title.trim()) {
    throw new QuizValidationError('Quiz title is required and cannot be empty.');
  }
  if (payload.title.trim().length > 255) {
    throw new QuizValidationError('Quiz title cannot exceed 255 characters.');
  }
  if (payload.description !== undefined && payload.description !== null && payload.description.length > 2000) {
    throw new QuizValidationError('Quiz description cannot exceed 2000 characters.');
  }
  if (payload.defaultTimeLimitSeconds !== undefined) {
    validateTimeLimit(payload.defaultTimeLimitSeconds);
  }
  if (payload.scoringStyle !== undefined) {
    validateScoringStyle(payload.scoringStyle);
  }
}

export function validateUpdateQuizPayload(payload: UpdateQuizPayload): void {
  if (payload.title !== undefined) {
    if (!payload.title || !payload.title.trim()) {
      throw new QuizValidationError('Quiz title cannot be empty.');
    }
    if (payload.title.trim().length > 255) {
      throw new QuizValidationError('Quiz title cannot exceed 255 characters.');
    }
  }
  if (payload.description !== undefined && payload.description !== null && payload.description.length > 2000) {
    throw new QuizValidationError('Quiz description cannot exceed 2000 characters.');
  }
  if (payload.defaultTimeLimitSeconds !== undefined) {
    validateTimeLimit(payload.defaultTimeLimitSeconds);
  }
  if (payload.scoringStyle !== undefined) {
    validateScoringStyle(payload.scoringStyle);
  }
}

/**
 * Quiz state machine transitions:
 * DRAFT -> PUBLISHED
 * DRAFT -> ARCHIVED
 * ARCHIVED -> DRAFT (only for draft quizzes)
 * PUBLISHED -> ARCHIVED (preserves snapshot, prohibits new rooms)
 */
export function assertValidQuizStatusTransition(
  currentStatus: QuizStatus,
  targetStatus: QuizStatus,
  hasPublishedSnapshot: boolean = false
): void {
  if (currentStatus === targetStatus) {
    return; // Idempotent
  }

  if (currentStatus === QuizStatus.DRAFT) {
    if (targetStatus === QuizStatus.PUBLISHED || targetStatus === QuizStatus.ARCHIVED) {
      return;
    }
  } else if (currentStatus === QuizStatus.ARCHIVED) {
    // Can only restore to DRAFT if it was archived from DRAFT (i.e. never published)
    if (targetStatus === QuizStatus.DRAFT && !hasPublishedSnapshot) {
      return;
    }
    if (hasPublishedSnapshot && targetStatus === QuizStatus.DRAFT) {
      throw new InvalidQuizLifecycleTransitionError(
        'Cannot restore a published archived quiz back to DRAFT.'
      );
    }
  } else if (currentStatus === QuizStatus.PUBLISHED) {
    if (targetStatus === QuizStatus.ARCHIVED) {
      return;
    }
  }

  throw new InvalidQuizLifecycleTransitionError(
    `Invalid quiz lifecycle transition from ${currentStatus} to ${targetStatus}.`
  );
}

/**
 * Speed-Weighted Scoring Calculation
 * Base: 100, Floor: 50
 * Score = 50 + Math.round(50 * (remainingTimeMs / totalTimeLimitMs))
 * Boundary:
 *  - isCorrect === false: 0 points
 *  - remainingTimeMs <= 0: 0 points
 *  - remainingTimeMs >= totalTimeLimitMs: 100 points
 *  - 0 < remainingTimeMs < totalTimeLimitMs: clamped between 50 and 100
 */
export function calculateSpeedWeightedScore(params: {
  readonly isCorrect: boolean;
  readonly remainingTimeMs: number;
  readonly timeLimitMs: number;
}): number {
  const { isCorrect, remainingTimeMs, timeLimitMs } = params;
  if (!isCorrect) return 0;
  if (remainingTimeMs <= 0) return 0; // Hard expiration cutoff

  if (timeLimitMs <= 0) return QUIZ_LIMITS.FLOOR_POINTS;

  const ratio = Math.max(0, Math.min(1, remainingTimeMs / timeLimitMs));
  const points = QUIZ_LIMITS.FLOOR_POINTS + Math.round((QUIZ_LIMITS.BASE_POINTS - QUIZ_LIMITS.FLOOR_POINTS) * ratio);
  return Math.min(QUIZ_LIMITS.BASE_POINTS, Math.max(QUIZ_LIMITS.FLOOR_POINTS, points));
}

export function calculateStandardScore(isCorrect: boolean): number {
  return isCorrect ? QUIZ_LIMITS.BASE_POINTS : 0;
}

/**
 * Strips correctOptionIndices and explanation from a snapshot question for participant view.
 */
export function projectQuestionForParticipant(question: SnapshotQuestion): ParticipantQuestionProjection {
  return {
    id: question.id,
    position: question.position,
    stem: question.stem,
    type: question.type,
    choices: question.choices.map((c) => ({
      choiceIndex: c.choiceIndex,
      text: c.text
    })),
    scriptureReference: question.scriptureReference,
    topic: question.topic,
    difficulty: question.difficulty,
    timeLimitSeconds: question.timeLimitSeconds
  };
}
