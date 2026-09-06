export const QuestionDifficulty = Object.freeze({
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard'
} as const);
export type QuestionDifficulty = (typeof QuestionDifficulty)[keyof typeof QuestionDifficulty];
export const QuestionType = Object.freeze({
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  MULTI_SELECT: 'MULTI_SELECT'
} as const);
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];
export const QuestionStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED'
} as const);
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export interface Question {
  id: string;
  organizationId: string;
  stem: string;
  type: QuestionType;
  options: string[];
  correctOptionIndices: number[];
  explanation: string;
  scriptureReference: string;
  topic: string;
  difficulty: QuestionDifficulty;
  language: string;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionPayload {
  id?: string;
  organizationId: string;
  stem: string;
  type: QuestionType;
  options: string[];
  correctOptionIndices: number[];
  explanation?: string;
  scriptureReference: string;
  topic: string;
  difficulty: QuestionDifficulty;
  language: string;
  status?: QuestionStatus;
  createdAt?: string;
}

export interface UpdateQuestionPayload {
  organizationId?: string;
  id?: string;
  stem?: string;
  type?: QuestionType;
  options?: string[];
  correctOptionIndices?: number[];
  explanation?: string;
  scriptureReference?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  language?: string;
  status?: QuestionStatus;
}

export interface QuestionFilter {
  status?: QuestionStatus;
  difficulty?: QuestionDifficulty;
  topic?: string;
  type?: QuestionType;
  language?: string;
  search?: string;
}

export const VALID_STATUS_TRANSITIONS: Readonly<Record<QuestionStatus, ReadonlySet<QuestionStatus>>> = Object.freeze({
  [QuestionStatus.DRAFT]: new Set<QuestionStatus>([QuestionStatus.PENDING_REVIEW, QuestionStatus.ARCHIVED]),
  [QuestionStatus.PENDING_REVIEW]: new Set<QuestionStatus>([QuestionStatus.APPROVED, QuestionStatus.DRAFT, QuestionStatus.ARCHIVED]),
  [QuestionStatus.APPROVED]: new Set<QuestionStatus>([QuestionStatus.PENDING_REVIEW, QuestionStatus.ARCHIVED]),
  [QuestionStatus.ARCHIVED]: new Set<QuestionStatus>([QuestionStatus.DRAFT])
});
export class DomainValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'DomainValidationError'; }
}
export class InvalidLifecycleTransitionError extends Error {
  constructor(curr: string, next: string) {
    super('Cannot transition question from status ' + curr + ' to ' + next + '.');
    this.name = 'InvalidLifecycleTransitionError';
  }
}
function normalizeString(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }
export function validateQuestionPayload(data: any, isUpdate = false): void {
  if (!data || typeof data !== 'object') throw new DomainValidationError('Question data must be an object.');
  if (!isUpdate || data.organizationId !== undefined) {
    if (!normalizeString(data.organizationId)) throw new DomainValidationError('organizationId is required and must be non-empty.');
  }
  if (!isUpdate || data.stem !== undefined) {
    if (!normalizeString(data.stem)) throw new DomainValidationError('Question stem text is required and cannot be empty.');
  }
  if (!isUpdate || data.type !== undefined) {
    if (!Object.values(QuestionType).includes(data.type)) {
      throw new DomainValidationError('Invalid question type: ' + data.type);
    }
  }
  if (!isUpdate || data.difficulty !== undefined) {
    if (!Object.values(QuestionDifficulty).includes(data.difficulty)) {
      throw new DomainValidationError('Invalid difficulty: ' + data.difficulty);
    }
  }
  if (!isUpdate || data.language !== undefined) {
    if (!normalizeString(data.language)) throw new DomainValidationError('Question language is required.');
  }
  if (data.status !== undefined) {
    if (!Object.values(QuestionStatus).includes(data.status)) {
      throw new DomainValidationError('Invalid question status: ' + data.status);
    }
    if (!isUpdate && data.status === QuestionStatus.APPROVED) {
      throw new DomainValidationError('Questions cannot be created directly with APPROVED status. They must follow the review lifecycle.');
    }
  }
  if (!isUpdate || data.topic !== undefined) {
    if (!normalizeString(data.topic)) throw new DomainValidationError('Question topic/category is required.');
  }
  if (!isUpdate || data.scriptureReference !== undefined) {
    if (!normalizeString(data.scriptureReference)) throw new DomainValidationError('Scripture reference is required.');
  }
  const effectiveType = data.type;
  if (effectiveType || !isUpdate) {
    validateOptionsAndAnswers(data, effectiveType);
  }
}
function validateOptionsAndAnswers(data: any, type: any): void {
  if (type === QuestionType.MULTIPLE_CHOICE) {
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new DomainValidationError('MULTIPLE_CHOICE requires at least 2 options.');
    }
    for (let i = 0; i < data.options.length; i++) {
      if (typeof data.options[i] !== 'string' || !data.options[i].trim()) {
        throw new DomainValidationError('Option index ' + i + ' must be a non-empty string.');
      }
    }
    if (!Array.isArray(data.correctOptionIndices) || data.correctOptionIndices.length !== 1) {
      throw new DomainValidationError('MULTIPLE_CHOICE requires exactly 1 correct option index.');
    }
    const idx = data.correctOptionIndices[0];
    if (!Number.isInteger(idx) || idx < 0 || idx >= data.options.length) {
      throw new DomainValidationError('Correct option index ' + idx + ' is out of bounds.');
    }
  } else if (type === QuestionType.TRUE_FALSE) {
    if (!Array.isArray(data.options) || data.options.length !== 2) {
      throw new DomainValidationError('TRUE_FALSE requires exactly 2 options.');
    }
    if (!Array.isArray(data.correctOptionIndices) || data.correctOptionIndices.length !== 1) {
      throw new DomainValidationError('TRUE_FALSE requires exactly 1 correct option index.');
    }
    const idx = data.correctOptionIndices[0];
    if (idx !== 0 && idx !== 1) throw new DomainValidationError('TRUE_FALSE correct option index must be 0 or 1.');
  } else if (type === QuestionType.MULTI_SELECT) {
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new DomainValidationError('MULTI_SELECT requires at least 2 options.');
    }
    if (!Array.isArray(data.correctOptionIndices) || data.correctOptionIndices.length < 1) {
      throw new DomainValidationError('MULTI_SELECT requires at least 1 correct option index.');
    }
    const seenIndices = new Set<number>();
    for (const idx of data.correctOptionIndices) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= data.options.length) {
        throw new DomainValidationError('Correct option index ' + idx + ' is out of bounds.');
      }
      if (seenIndices.has(idx)) {
        throw new DomainValidationError('Duplicate correct option index in MULTI_SELECT: ' + idx);
      }
      seenIndices.add(idx);
    }
  }
}
export function assertValidStatusTransition(curr: QuestionStatus, next: QuestionStatus): void {
  if (curr === next) return;
  const allowed = VALID_STATUS_TRANSITIONS[curr];
  if (!allowed || !allowed.has(next)) throw new InvalidLifecycleTransitionError(curr, next);
}

