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