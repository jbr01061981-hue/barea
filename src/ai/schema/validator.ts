import {
  QuestionDifficulty,
  QuestionType
} from '../../domain/question';
import {
  GenerationValidationError,
  StructuralValidationError,
  type GenerationRequest,
  type GeneratedQuestionItem,
  type GeneratedQuestionBatch
} from './types';

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function validateGenerationRequest(req: unknown): asserts req is GenerationRequest {
  if (!req || typeof req !== 'object') {
    throw new GenerationValidationError('Generation request must be an object.');
  }

  const record = req as Record<string, unknown>;

  if (!normalizeString(record.organizationId)) {
    throw new GenerationValidationError('organizationId is required and must be non-empty.');
  }

  if (!normalizeString(record.topic) && !normalizeString(record.passageReference)) {
    throw new GenerationValidationError('Either topic or passageReference is required and cannot be empty.');
  }

  if (typeof record.count !== 'number' || !Number.isInteger(record.count)) {
    throw new GenerationValidationError('Question count must be an integer.');
  }

  if (record.count < 1 || record.count > 20) {
    throw new GenerationValidationError('Question count must be between 1 and 20.');
  }

  if (!Object.values(QuestionDifficulty).includes(record.difficulty as QuestionDifficulty)) {
    throw new GenerationValidationError('Invalid difficulty: ' + String(record.difficulty));
  }

  if (record.type !== undefined && !Object.values(QuestionType).includes(record.type as QuestionType)) {
    throw new GenerationValidationError('Invalid question type: ' + String(record.type));
  }

  if (!normalizeString(record.language)) {
    throw new GenerationValidationError('Language is required and must be non-empty.');
  }
}

export function validateStructuralOutput(raw: unknown): GeneratedQuestionBatch {
  if (!raw || typeof raw !== 'object') {
    throw new StructuralValidationError('LLM output must be a non-null object.');
  }

  const record = raw as Record<string, unknown>;

  if (!Array.isArray(record.questions)) {
    throw new StructuralValidationError("LLM output must contain a 'questions' array.");
  }

  const validatedQuestions: GeneratedQuestionItem[] = [];

  for (let i = 0; i < record.questions.length; i++) {
    const item = record.questions[i];
    if (!item || typeof item !== 'object') {
      throw new StructuralValidationError(`Question at index ${i} must be an object.`);
    }

    const q = item as Record<string, unknown>;

    if (typeof q.stem !== 'string' || !q.stem.trim()) {
      throw new StructuralValidationError(`Question at index ${i} has empty or missing stem.`);
    }

    if (typeof q.type !== 'string' || !Object.values(QuestionType).includes(q.type as QuestionType)) {
      throw new StructuralValidationError(`Question at index ${i} has invalid question type: ${String(q.type)}`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new StructuralValidationError(`Question at index ${i} must contain at least 2 options.`);
    }

    for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
      if (typeof q.options[optIdx] !== 'string' || !q.options[optIdx].trim()) {
        throw new StructuralValidationError(`Question at index ${i} option ${optIdx} must be a non-empty string.`);
      }
    }

    if (!Array.isArray(q.correctOptionIndices) || q.correctOptionIndices.length < 1) {
      throw new StructuralValidationError(`Question at index ${i} must contain at least 1 correct option index.`);
    }

    for (const cIdx of q.correctOptionIndices) {
      if (typeof cIdx !== 'number' || !Number.isInteger(cIdx) || cIdx < 0 || cIdx >= q.options.length) {
        throw new StructuralValidationError(`Question at index ${i} has out-of-bounds correct option index: ${String(cIdx)}`);
      }
    }

    if (typeof q.explanation !== 'string') {
      throw new StructuralValidationError(`Question at index ${i} explanation must be a string.`);
    }

    if (typeof q.scriptureReference !== 'string' || !q.scriptureReference.trim()) {
      throw new StructuralValidationError(`Question at index ${i} has empty or missing scriptureReference.`);
    }

    if (typeof q.topic !== 'string' || !q.topic.trim()) {
      throw new StructuralValidationError(`Question at index ${i} has empty or missing topic.`);
    }

    if (typeof q.difficulty !== 'string' || !Object.values(QuestionDifficulty).includes(q.difficulty as QuestionDifficulty)) {
      throw new StructuralValidationError(`Question at index ${i} has invalid difficulty: ${String(q.difficulty)}`);
    }

    if (typeof q.language !== 'string' || !q.language.trim()) {
      throw new StructuralValidationError(`Question at index ${i} has empty or missing language.`);
    }

    validatedQuestions.push({
      stem: q.stem.trim(),
      type: q.type as QuestionType,
      options: q.options.map((opt: string) => opt.trim()),
      correctOptionIndices: q.correctOptionIndices,
      explanation: q.explanation.trim(),
      scriptureReference: q.scriptureReference.trim(),
      topic: q.topic.trim(),
      difficulty: q.difficulty as QuestionDifficulty,
      language: q.language.trim()
    });
  }

  return { questions: validatedQuestions };
}