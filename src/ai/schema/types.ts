import type {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  Question
} from '../../domain/question';

export interface GenerationRequest {
  organizationId: string;
  topic: string;
  passageReference?: string;
  count: number;
  difficulty: QuestionDifficulty;
  type?: QuestionType;
  language: string;
  teacherInstructions?: string;
}

export interface GeneratedQuestionItem {
  stem: string;
  type: QuestionType;
  options: string[];
  correctOptionIndices: number[];
  explanation: string;
  scriptureReference: string;
  topic: string;
  difficulty: QuestionDifficulty;
  language: string;
  status?: unknown;
}

export interface GeneratedQuestionBatch {
  questions: GeneratedQuestionItem[];
}

export interface GenerationResult {
  questions: Question[];
  totalGenerated: number;
  status: QuestionStatus;
}

export class GenerationValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'GenerationValidationError';
  }
}

export class StructuralValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'StructuralValidationError';
  }
}

export class AIProviderError extends Error {
  constructor(msg: string, public readonly cause?: unknown) {
    super(msg);
    this.name = 'AIProviderError';
  }
}