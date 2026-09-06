import type { AIProvider } from './ai-provider';
import {
  QuestionType
} from '../../domain/question';
import type {
  GenerationRequest,
  GeneratedQuestionBatch
} from '../schema/types';

export class FakeAIProvider implements AIProvider {
  public readonly name = 'fake-ai-provider';
  private responses: (unknown | Error)[] = [];
  public callHistory: GenerationRequest[] = [];

  constructor(initialResponses: (unknown | Error)[] = []) {
    this.responses = [...initialResponses];
  }

  setResponses(responses: (unknown | Error)[]): void {
    this.responses = [...responses];
  }

  queueResponse(response: unknown | Error): void {
    this.responses.push(response);
  }

  async generateRaw(request: GenerationRequest): Promise<unknown> {
    this.callHistory.push({ ...request });

    if (this.responses.length > 0) {
      const next = this.responses.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next;
    }

    // Default deterministic generator matching requested count
    const batch: GeneratedQuestionBatch = {
      questions: []
    };

    const targetType = request.type || QuestionType.MULTIPLE_CHOICE;

    for (let i = 1; i <= request.count; i++) {
      let options = [
        `Option A for ${i}`,
        `Option B for ${i}`,
        `Option C for ${i}`,
        `Option D for ${i}`
      ];
      let correctIndices = [0];

      if (targetType === QuestionType.TRUE_FALSE) {
        options = ['True', 'False'];
        correctIndices = [0];
      } else if (targetType === QuestionType.MULTI_SELECT) {
        options = ['Point 1', 'Point 2', 'Point 3', 'Point 4'];
        correctIndices = [0, 1];
      }

      batch.questions.push({
        stem: `Generated question ${i} about ${request.topic}?`,
        type: targetType,
        options,
        correctOptionIndices: correctIndices,
        explanation: `Explanation for question ${i}.`,
        scriptureReference: request.passageReference || 'Genesis 1:1',
        topic: request.topic,
        difficulty: request.difficulty,
        language: request.language
      });
    }

    return batch;
  }
}