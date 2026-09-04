const QuestionDifficulty = Object.freeze({
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard'
});
const QuestionType = Object.freeze({
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
  MULTI_SELECT: 'MULTI_SELECT'
});
const QuestionStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  ARCHIVED: 'ARCHIVED'
});
const VALID_STATUS_TRANSITIONS = Object.freeze({
  [QuestionStatus.DRAFT]: new Set([QuestionStatus.PENDING_REVIEW, QuestionStatus.ARCHIVED]),
  [QuestionStatus.PENDING_REVIEW]: new Set([QuestionStatus.APPROVED, QuestionStatus.DRAFT, QuestionStatus.ARCHIVED]),
  [QuestionStatus.APPROVED]: new Set([QuestionStatus.ARCHIVED]),
  [QuestionStatus.ARCHIVED]: new Set([QuestionStatus.DRAFT])
});
class DomainValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'DomainValidationError'; }
}
class InvalidLifecycleTransitionError extends Error {
  constructor(curr, next) {
    super('Cannot transition question from status ' + curr + ' to ' + next + '.');
    this.name = 'InvalidLifecycleTransitionError';
  }
}
function normalizeString(v) { return typeof v === 'string' ? v.trim() : ''; }
function validateQuestionPayload(data, isUpdate = false) {
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
function validateOptionsAndAnswers(data, type) {
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
    for (const idx of data.correctOptionIndices) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= data.options.length) {
        throw new DomainValidationError('Correct option index ' + idx + ' is out of bounds.');
      }
    }
  }
}
function assertValidStatusTransition(curr, next) {
  if (curr === next) return;
  const allowed = VALID_STATUS_TRANSITIONS[curr];
  if (!allowed || !allowed.has(next)) throw new InvalidLifecycleTransitionError(curr, next);
}
module.exports = {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  VALID_STATUS_TRANSITIONS,
  DomainValidationError,
  InvalidLifecycleTransitionError,
  validateQuestionPayload,
  assertValidStatusTransition
};
