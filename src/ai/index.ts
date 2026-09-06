export {
  type GenerationRequest,
  type GeneratedQuestionItem,
  type GeneratedQuestionBatch,
  type GenerationResult,
  GenerationValidationError,
  StructuralValidationError,
  AIProviderError
} from './schema/types';

export {
  validateGenerationRequest,
  validateStructuralOutput
} from './schema/validator';

export {
  type AIProvider
} from './provider/ai-provider';

export {
  FakeAIProvider
} from './provider/fake-ai-provider';

export {
  GeminiAIProvider,
  type GeminiProviderConfig
} from './provider/gemini-ai-provider';

export {
  AIGenerationService,
  type AIGenerationServiceOptions
} from './service/ai-generation-service';