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

/**
 * Checks if the application is running in an authorized local development or test environment.
 */
export function isDevelopmentOrTestEnvironment(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test' || !env;
}

/**
 * Derives the authenticated teacher context strictly on the server.
 * Never accepts organization identity or credentials from untrusted client input.
 *
 * Security Boundary:
 * 1. Test fixture override (mockTeacherContext) is evaluated first.
 * 2. Default development context is permitted ONLY in explicitly recognized development/test execution
 *    and requires a valid, non-empty organization ID (via BAREA_DEV_ORG_ID or default development org).
 * 3. In non-development/production environments without a genuine trusted context, FAILS CLOSED.
 * 4. Missing or empty organization identity FAILS CLOSED.
 */
export async function getAuthorizedTeacherContext(): Promise<TeacherContext> {
  // Test fixture override
  if (mockTeacherContext !== null) {
    if (!mockTeacherContext.organizationId || !mockTeacherContext.organizationId.trim() || !mockTeacherContext.userId) {
      throw new Error('Unauthorized: missing or invalid teacher identity.');
    }
    return mockTeacherContext;
  }

  // Non-development / production guard: must fail closed until production authentication is implemented
  if (!isDevelopmentOrTestEnvironment()) {
    throw new Error('Unauthorized: production teacher authentication is required. Development teacher context is disabled in production.');
  }

  // In development/test mode, resolve development organization
  const devOrgId = (process.env.BAREA_DEV_ORG_ID !== undefined)
    ? process.env.BAREA_DEV_ORG_ID.trim()
    : 'church-berea-default';

  if (!devOrgId) {
    throw new Error('Unauthorized: development organization identity is missing or empty. Development teacher context failed closed.');
  }

  return {
    userId: process.env.BAREA_DEV_USER_ID || 'teacher-dev-001',
    organizationId: devOrgId,
    displayName: process.env.BAREA_DEV_USER_NAME || 'Lead Sunday School Teacher',
    role: 'teacher',
  };
}

/**
 * Test fixture hook: override the server-side teacher context.
 * Calling with null resets to standard server resolution.
 * Guarded against execution in production mode.
 */
export function setAuthorizedTeacherContext(context: TeacherContext | null): void {
  if (!isDevelopmentOrTestEnvironment()) {
    throw new Error('Forbidden: test authorization overrides cannot be executed in production environment.');
  }
  mockTeacherContext = context;
}
