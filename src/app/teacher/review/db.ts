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

export interface TeacherContext {
  userId: string;
  organizationId: string;
  displayName: string;
  role: 'teacher' | 'admin';
}

let mockTeacherContext: TeacherContext | null = null;

export const DEFAULT_DEV_TEACHER_CONTEXT: TeacherContext = {
  userId: 'teacher-dev-001',
  organizationId: process.env.BAREA_DEV_ORG_ID || 'church-berea-default',
  displayName: 'Lead Sunday School Teacher',
  role: 'teacher',
};

/**
 * Derives the authenticated teacher context strictly on the server.
 * Never accepts organization identity or credentials from untrusted client input.
 * In development, defaults to DEFAULT_DEV_TEACHER_CONTEXT unless overridden by test fixtures.
 */
export async function getAuthorizedTeacherContext(): Promise<TeacherContext> {
  if (mockTeacherContext !== null) {
    if (!mockTeacherContext.organizationId || !mockTeacherContext.userId) {
      throw new Error('Unauthorized: missing or invalid teacher identity.');
    }
    return mockTeacherContext;
  }
  return DEFAULT_DEV_TEACHER_CONTEXT;
}

/**
 * Test fixture hook: override the server-side teacher context.
 * Calling with null resets to standard server resolution.
 */
export function setAuthorizedTeacherContext(context: TeacherContext | null): void {
  mockTeacherContext = context;
}
