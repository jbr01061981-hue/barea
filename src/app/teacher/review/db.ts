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
 * Checks if the application is running in an explicitly authorized local development environment.
 * Unset or unknown NODE_ENV is strictly NOT treated as development.
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if the application is running in a recognized automated test execution environment.
 */
export function isTestEnvironment(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  // Node.js built-in test runner sets --test flag in process.execArgv or command line
  if (Array.isArray(process.execArgv) && process.execArgv.includes('--test')) return true;
  if (Array.isArray(process.argv) && process.argv.some(arg => arg.includes('test'))) return true;
  return false;
}

/**
 * Derives the authenticated teacher context strictly on the server.
 * Never accepts organization identity or credentials from untrusted client input.
 *
 * Security Boundary:
 * 1. Test fixture override (mockTeacherContext) is evaluated first (strictly permitted only in test or development).
 * 2. Default development context is permitted ONLY when NODE_ENV is explicitly 'development'.
 *    Unset, unknown, or production NODE_ENV strictly FAILS CLOSED.
 * 3. In development mode, requires an explicit, non-empty BAREA_DEV_ORG_ID.
 *    There is NO silent fallback to 'church-berea-default'; missing or empty configuration FAILS CLOSED.
 */
export async function getAuthorizedTeacherContext(): Promise<TeacherContext> {
  // Test fixture override (permitted only in test or development environments)
  if (mockTeacherContext !== null) {
    if (!isTestEnvironment() && !isDevelopmentEnvironment()) {
      throw new Error('Forbidden: test authorization overrides are disabled in non-test/production environments.');
    }
    if (!mockTeacherContext.organizationId || !mockTeacherContext.organizationId.trim() || !mockTeacherContext.userId) {
      throw new Error('Unauthorized: missing or invalid teacher identity.');
    }
    return mockTeacherContext;
  }

  // Non-development / production / unset / unknown environment guard: must fail closed
  if (!isDevelopmentEnvironment()) {
    const env = process.env.NODE_ENV;
    if (env === 'production') {
      throw new Error('Unauthorized: production teacher authentication is required. Development teacher context is disabled in production.');
    }
    throw new Error(`Unauthorized: runtime environment (${env || 'unset'}) is not authorized for development teacher context. Explicit trusted teacher authentication is required.`);
  }

  // In explicit development mode, require explicit BAREA_DEV_ORG_ID configuration (no silent fallback)
  const devOrgId = process.env.BAREA_DEV_ORG_ID ? process.env.BAREA_DEV_ORG_ID.trim() : '';

  if (!devOrgId) {
    throw new Error('Unauthorized: BAREA_DEV_ORG_ID is missing or empty. Development teacher context requires an explicit organization configuration and fails closed.');
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
  if (process.env.NODE_ENV === 'production' || (!isTestEnvironment() && !isDevelopmentEnvironment())) {
    throw new Error('Forbidden: test authorization overrides cannot be executed in production or unauthorized environments.');
  }
  mockTeacherContext = context;
}
