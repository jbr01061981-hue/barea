export abstract class BareaDomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SessionNotFoundError extends BareaDomainError {
  readonly code = 'SESSION_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(id: string = '') {
    super(id ? `Session not found or unavailable: '${id}'` : 'Session not found or unavailable.');
  }
}

export class SessionClosedError extends BareaDomainError {
  readonly code = 'SESSION_CLOSED';
  readonly httpStatus = 409;
  constructor() {
    super('This session is closed to new participants.');
  }
}

export class SessionLockedError extends BareaDomainError {
  readonly code = 'SESSION_LOCKED';
  readonly httpStatus = 423;
  constructor() {
    super('This session is currently locked by the host.');
  }
}

export class SessionFullError extends BareaDomainError {
  readonly code = 'SESSION_FULL';
  readonly httpStatus = 429;
  constructor(limit: number) {
    super(`Session has reached its maximum capacity of ${limit} participants.`);
  }
}

export class SessionAccessDeniedError extends BareaDomainError {
  readonly code = 'SESSION_ACCESS_DENIED';
  readonly httpStatus = 403;
  constructor(message: string = 'Access denied. You are not authorized to access or join this session.') {
    super(message);
  }
}

export class HostCannotParticipateInOwnSessionError extends BareaDomainError {
  readonly code = 'HOST_CANNOT_PARTICIPATE_IN_OWN_SESSION';
  readonly httpStatus = 403;
  constructor(message: string = 'Host cannot participate as an individual player in their own live quiz session.') {
    super(message);
  }
}

export class CrossTenantSnapshotError extends BareaDomainError {
  readonly code = 'CROSS_TENANT_SNAPSHOT_FORBIDDEN';
  readonly httpStatus = 403;
  constructor(message: string = 'Quiz snapshot does not belong to authorized workspace/tenant.') {
    super(message);
  }
}

export class InvalidScheduledTimeError extends BareaDomainError {
  readonly code = 'INVALID_SCHEDULED_TIME';
  readonly httpStatus = 400;
  constructor(message: string = 'Invalid scheduled start time.') {
    super(message);
  }
}

export class InvalidRoomCodeError extends BareaDomainError {
  readonly code = 'INVALID_ROOM_CODE';
  readonly httpStatus = 400;
  constructor(message: string = 'Invalid room code format.') {
    super(message);
  }
}

export class InvalidParticipantTokenError extends BareaDomainError {
  readonly code = 'INVALID_PARTICIPANT_TOKEN';
  readonly httpStatus = 401;
  constructor(message: string = 'Invalid or expired participant session token.') {
    super(message);
  }
}

export class InvalidClientIpError extends BareaDomainError {
  readonly code = 'INVALID_CLIENT_IP';
  readonly httpStatus = 400;
  constructor(message: string = 'Invalid client IP address.') {
    super(message);
  }
}

export class RateLimitExceededError extends BareaDomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly httpStatus = 429;
  readonly retryAfter: number;
  constructor(retryAfter: number = 60) {
    super(`Too many requests. Please wait ${retryAfter} seconds before retrying.`);
    this.retryAfter = retryAfter;
  }
}

export class InvalidLiveStateTransitionError extends BareaDomainError {
  readonly code = 'INVALID_STATE_TRANSITION';
  readonly httpStatus = 409;
  constructor(message: string) {
    super(message);
  }
}

export class AnswerDeadlineExpiredError extends BareaDomainError {
  readonly code = 'SUBMISSION_WINDOW_EXPIRED';
  readonly httpStatus = 400;
  constructor(message: string = 'Answer submission window has closed.') {
    super(message);
  }
}

export class DuplicateAnswerSubmissionError extends BareaDomainError {
  readonly code = 'DUPLICATE_ANSWER_SUBMISSION';
  readonly httpStatus = 409;
  constructor(message: string = 'Answer has already been submitted for this question.') {
    super(message);
  }
}

export class NotSessionHostError extends BareaDomainError {
  readonly code = 'NOT_SESSION_HOST';
  readonly httpStatus = 403;
  constructor(message: string = 'Unauthorized: Only the host may perform live session controls.') {
    super(message);
  }
}

export class SessionNotActiveError extends BareaDomainError {
  readonly code = 'SESSION_NOT_ACTIVE';
  readonly httpStatus = 409;
  constructor(message: string = 'Session is not in an active live quiz state.') {
    super(message);
  }
}

export class InvalidQuestionChoiceError extends BareaDomainError {
  readonly code = 'INVALID_QUESTION_CHOICE';
  readonly httpStatus = 400;
  constructor(message: string = 'Selected choice indices are invalid for this question.') {
    super(message);
  }
}

export class ConcurrencyConflictError extends BareaDomainError {
  readonly code = 'CONCURRENCY_CONFLICT';
  readonly httpStatus = 409;
  constructor(message: string = 'State mutation conflict: provided state version is stale.') {
    super(message);
  }
}

export class AccountNotFoundError extends BareaDomainError {
  readonly code = 'ACCOUNT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message: string = 'Account not found.') {
    super(message);
  }
}

export class AuthenticationRequiredError extends BareaDomainError {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly httpStatus = 401;
  constructor(message: string = 'Authentication required.') {
    super(message);
  }
}

export class OAuthStateError extends BareaDomainError {
  readonly code = 'OAUTH_STATE_INVALID';
  readonly httpStatus = 400;
  constructor(message: string = 'Invalid or expired OAuth state.') {
    super(message);
  }
}

export class OAuthTransactionNotFoundError extends BareaDomainError {
  readonly code = 'OAUTH_TRANSACTION_NOT_FOUND';
  readonly httpStatus = 400;
  constructor(message: string = 'OAuth transaction not found.') {
    super(message);
  }
}

export class OAuthTransactionReplayedError extends BareaDomainError {
  readonly code = 'OAUTH_TRANSACTION_REPLAYED';
  readonly httpStatus = 400;
  constructor(message: string = 'OAuth transaction has already been consumed and cannot be replayed.') {
    super(message);
  }
}

export class OAuthTransactionExpiredError extends BareaDomainError {
  readonly code = 'OAUTH_TRANSACTION_EXPIRED';
  readonly httpStatus = 400;
  constructor(message: string = 'OAuth transaction has expired. Please initiate login again.') {
    super(message);
  }
}

export class AccountCollisionDetectedError extends BareaDomainError {
  readonly code = 'ACCOUNT_COLLISION_DETECTED';
  readonly httpStatus = 409;
  constructor(message: string = 'An account with this email is already registered to a different login identity.') {
    super(message);
  }
}

export class OAuthCallbackError extends BareaDomainError {
  readonly code = 'OAUTH_CALLBACK_ERROR';
  readonly httpStatus = 400;
  constructor(message: string = 'OAuth authentication callback failed.') {
    super(message);
  }
}

export class TeacherUnauthorizedError extends BareaDomainError {
  readonly code = 'TEACHER_UNAUTHORIZED';
  readonly httpStatus = 401;
  constructor(message: string = 'Unauthorized: explicit teacher authentication is required.') {
    super(message);
  }
}

export class TeacherForbiddenError extends BareaDomainError {
  readonly code = 'TEACHER_FORBIDDEN';
  readonly httpStatus = 403;
  constructor(message: string = 'Forbidden: Authenticated user is not authorized as a teacher or admin for any organization.') {
    super(message);
  }
}

