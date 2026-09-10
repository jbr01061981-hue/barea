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
