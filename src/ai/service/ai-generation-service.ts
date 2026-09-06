import type { AIProvider } from '../provider/ai-provider';
import {
  validateGenerationRequest,
  validateStructuralOutput
} from '../schema/validator';
import {
  GenerationValidationError,
  StructuralValidationError,
  AIProviderError,
  type GenerationRequest,
  type GenerationResult
} from '../schema/types';
import {
  validateQuestionPayload,
  QuestionStatus,
  type Question
} from '../../domain/question';
import type { QuestionBankService } from '../../service/question-bank-service';

export interface AIGenerationServiceOptions {
  aiProvider: AIProvider;
  questionBankService: QuestionBankService;
}

export class AIGenerationService {
  private readonly provider: AIProvider;
  private readonly questionBankService: QuestionBankService;

  constructor(options: AIGenerationServiceOptions) {
    this.provider = options.aiProvider;
    this.questionBankService = options.questionBankService;
  }

  async generateQuizQuestions(request: GenerationRequest): Promise<GenerationResult> {
    // 1. Validate request parameters
    validateGenerationRequest(request);

    // 2. Call AI Provider through port abstraction
    let rawOutput: unknown;
    try {
      rawOutput = await this.provider.generateRaw(request);
    } catch (err: unknown) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(`AI Provider failed during generation: ${msg}`, err);
    }

    // 3. Structural schema validation
    const structuredBatch = validateStructuralOutput(rawOutput);

    // 4. Batch count check (must match requested count)
    if (structuredBatch.questions.length !== request.count) {
      throw new StructuralValidationError(
        `Generated question count mismatch: requested ${request.count}, but received ${structuredBatch.questions.length}.`
      );
    }

    // 5. Pre-validate each question with Question domain validation
    // Prepare payloads with PENDING_REVIEW status and organizationId
    const stagedPayloads = structuredBatch.questions.map((item) => {
      const payload = {
        organizationId: request.organizationId,
        stem: item.stem,
        type: item.type,
        options: item.options,
        correctOptionIndices: item.correctOptionIndices,
        explanation: item.explanation,
        scriptureReference: item.scriptureReference,
        topic: item.topic,
        difficulty: item.difficulty,
        language: item.language,
        status: QuestionStatus.PENDING_REVIEW
      };

      // Validate against domain rules (options length, correctOptionIndices bounds, difficulty, etc.)
      validateQuestionPayload(payload, false);

      return payload;
    });

    // 6. All-or-nothing persistence boundary
    // Create each question through the QuestionBankService as DRAFT and transition to PENDING_REVIEW
    // (Preserving BAREA-002 invariant: questions can never be created directly as APPROVED)
    const persistedQuestions: Question[] = [];

    try {
      for (const payload of stagedPayloads) {
        // Creates as DRAFT
        const created = this.questionBankService.createQuestion({
          organizationId: payload.organizationId,
          stem: payload.stem,
          type: payload.type,
          options: payload.options,
          correctOptionIndices: payload.correctOptionIndices,
          explanation: payload.explanation,
          scriptureReference: payload.scriptureReference,
          topic: payload.topic,
          difficulty: payload.difficulty,
          language: payload.language
        });

        // Advance to PENDING_REVIEW
        const staged = this.questionBankService.transitionStatus(
          payload.organizationId,
          created.id,
          QuestionStatus.PENDING_REVIEW
        );

        if (!staged) {
          throw new Error(`Failed to stage generated question ${created.id} to PENDING_REVIEW.`);
        }

        persistedQuestions.push(staged);
      }
    } catch (err: unknown) {
      // In case of error during batch processing, clean up staged questions
      for (const q of persistedQuestions) {
        try {
          this.questionBankService.archiveQuestion(q.organizationId, q.id);
        } catch {
          // best-effort cleanup
        }
      }
      throw err;
    }

    return {
      questions: persistedQuestions,
      totalGenerated: persistedQuestions.length,
      status: QuestionStatus.PENDING_REVIEW
    };
  }
}