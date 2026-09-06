import path from 'node:path';
import { SqliteQuestionRepository } from '../../../persistence/sqlite-question-repository';
import { QuestionBankService } from '../../../service/question-bank-service';
import { AIGenerationService } from '../../../ai/service/ai-generation-service';
import { FakeAIProvider } from '../../../ai/provider/fake-ai-provider';
import { GeminiAIProvider } from '../../../ai/provider/gemini-ai-provider';

let globalRepo: SqliteQuestionRepository | null = null;
let globalBankService: QuestionBankService | null = null;
let globalAIService: AIGenerationService | null = null;

export function getQuestionBankService(): QuestionBankService {
  if (!globalBankService) {
    const dbPath = process.env.BAREA_DB_PATH || path.join(process.cwd(), 'barea.db');
    globalRepo = new SqliteQuestionRepository(dbPath);
    globalBankService = new QuestionBankService(globalRepo);
  }
  return globalBankService;
}

export function setQuestionBankService(service: QuestionBankService | null): void {
  globalBankService = service;
}

export function getAIGenerationService(): AIGenerationService {
  if (!globalAIService) {
    const bankService = getQuestionBankService();
    const provider = process.env.GEMINI_API_KEY
      ? new GeminiAIProvider()
      : new FakeAIProvider();
    globalAIService = new AIGenerationService({
      aiProvider: provider,
      questionBankService: bankService,
    });
  }
  return globalAIService;
}

export function setAIGenerationService(service: AIGenerationService | null): void {
  globalAIService = service;
}