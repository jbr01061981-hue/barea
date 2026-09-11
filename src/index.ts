export {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  VALID_STATUS_TRANSITIONS,
  DomainValidationError,
  InvalidLifecycleTransitionError,
  validateQuestionPayload,
  assertValidStatusTransition,
  type Question,
  type CreateQuestionPayload,
  type UpdateQuestionPayload,
  type QuestionFilter
} from './domain/question';

export {
  SqliteQuestionRepository,
  type QuestionRepository
} from './persistence/sqlite-question-repository';

export {
  QuestionBankService
} from './service/question-bank-service';

export {
  type GenerationRequest,
  type GeneratedQuestionItem,
  type GeneratedQuestionBatch,
  type GenerationResult,
  GenerationValidationError,
  StructuralValidationError,
  AIProviderError,
  validateGenerationRequest,
  validateStructuralOutput,
  type AIProvider,
  FakeAIProvider,
  GeminiAIProvider,
  type GeminiProviderConfig,
  AIGenerationService,
  type AIGenerationServiceOptions
} from './ai/index';

export {
  QuizStatus,
  ScoringStyle,
  QUIZ_LIMITS,
  QuizValidationError,
  InvalidQuizLifecycleTransitionError,
  validateTimeLimit,
  validateScoringStyle,
  validateCreateQuizPayload,
  validateUpdateQuizPayload,
  assertValidQuizStatusTransition,
  calculateSpeedWeightedScore,
  calculateStandardScore,
  projectQuestionForParticipant,
  type Quiz,
  type CreateQuizPayload,
  type UpdateQuizPayload,
  type QuizQuestionItem,
  type SnapshotChoice,
  type SnapshotQuestion,
  type PublishedQuizSnapshot,
  type ParticipantChoice,
  type ParticipantQuestionProjection
} from './domain/quiz';

export {
  SqliteQuizRepository,
  type QuizRepository,
  type QuizFilter
} from './persistence/sqlite-quiz-repository';

export {
  QuizService
} from './service/quiz-service';


export {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  SessionStatus,
  assertValidModeAdmissionCompatibility,
  type QuizSession,
  type SessionPublicInfo,
  type AuthenticatedParticipant,
  type SessionGroup,
  type SessionGroupPupil,
  type SessionInvitation
} from './domain/session';

export {
  type RoomCode,
  type ParticipantToken,
  type ClientIp,
  normalizeAndValidateRoomCode,
  validateParticipantToken,
  normalizeAllowlistEmail,
  normalizeAllowlistPhone,
  validateScheduledStartTime,
  derivePersonalTenantId,
  isPersonalTenantId
} from './domain/value-objects';

export {
  BareaDomainError,
  SessionNotFoundError,
  SessionClosedError,
  SessionLockedError,
  SessionFullError,
  SessionAccessDeniedError,
  CrossTenantSnapshotError,
  InvalidScheduledTimeError,
  InvalidRoomCodeError,
  InvalidParticipantTokenError,
  InvalidClientIpError,
  RateLimitExceededError
} from './domain/domain-errors';

export {
  SqliteSessionRepository,
  type SessionRepository,
  type CreateSessionPayload
} from './persistence/sqlite-session-repository';

export {
  SessionService,
  type CreateSessionServiceInput
} from './service/session-service';

export {
  InMemoryRateLimiter,
  type RateLimiter
} from './service/rate-limiter';

export {
  QuestionLifecycleState,
  type LiveSessionState,
  type ParticipantLiveView,
  type HostLiveView,
  type ParticipantSubmission,
  LiveQuizEventType,
  type LiveQuizEvent,
  InvalidLiveStateTransitionError,
  AnswerDeadlineExpiredError,
  DuplicateAnswerSubmissionError,
  NotSessionHostError,
  SessionNotActiveError,
  InvalidQuestionChoiceError,
  ConcurrencyConflictError
} from './domain/live-quiz';

export {
  LiveQuizService,
  type SubmitParticipantAnswerInput,
  type SubmitGroupAnswerInput
} from './service/live-quiz-service';

export {
  type SubscriberRole,
  type RealtimeSubscriber,
  type RealtimeTransport,
  InMemoryRealtimeTransport,
  projectEventForRole
} from './transport/realtime-transport';
