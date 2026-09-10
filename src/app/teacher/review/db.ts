import path from 'node:path';
import { SqliteQuestionRepository } from '../../../persistence/sqlite-question-repository';
import { QuestionBankService } from '../../../service/question-bank-service';
import { SqliteQuizRepository } from '../../../persistence/sqlite-quiz-repository';
import { QuizService } from '../../../service/quiz-service';
import { AIGenerationService } from '../../../ai/service/ai-generation-service';
import { FakeAIProvider } from '../../../ai/provider/fake-ai-provider';
import { GeminiAIProvider } from '../../../ai/provider/gemini-ai-provider';
import { SqliteSessionRepository } from '../../../persistence/sqlite-session-repository';
import { SessionService } from '../../../service/session-service';
import { InMemoryRateLimiter } from '../../../service/rate-limiter';

let globalRepo: SqliteQuestionRepository | null = null;
let globalBankService: QuestionBankService | null = null;
let globalQuizRepo: SqliteQuizRepository | null = null;
let globalQuizService: QuizService | null = null;
let globalAIService: AIGenerationService | null = null;
let globalSessionRepo: SqliteSessionRepository | null = null;
let globalSessionService: SessionService | null = null;
let globalRateLimiter: InMemoryRateLimiter | null = null;

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

export function getQuizService(): QuizService {
  if (!globalQuizService) {
    const dbPath = process.env.BAREA_DB_PATH || path.join(process.cwd(), 'barea.db');
    globalQuizRepo = new SqliteQuizRepository(dbPath);
    globalQuizService = new QuizService(globalQuizRepo);
  }
  return globalQuizService;
}

export function setQuizService(service: QuizService | null): void {
  globalQuizService = service;
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

export function getRateLimiter(): InMemoryRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new InMemoryRateLimiter();
  }
  return globalRateLimiter;
}

export function setRateLimiter(limiter: InMemoryRateLimiter | null): void {
  globalRateLimiter = limiter;
}

export function getSessionService(): SessionService {
  if (!globalSessionService) {
    const dbPath = process.env.BAREA_DB_PATH || path.join(process.cwd(), 'barea.db');
    globalSessionRepo = new SqliteSessionRepository(dbPath);
    globalSessionService = new SessionService(globalSessionRepo, getRateLimiter());
  }
  return globalSessionService;
}

export function setSessionService(service: SessionService | null): void {
  globalSessionService = service;
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
 * Checks if the application is running in an explicitly authorized automated test execution environment.
 * Requires process.env.NODE_ENV === 'test'.
 *
 * Security invariant:
 * Runtime process arguments (process.argv, process.execArgv) are untrusted runtime inputs
 * and are NEVER used to establish or infer trusted test environment authorization.
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
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


export interface AuthenticatedUserContext {
  userId: string;
  providerType: string;
  providerSub: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string;
}

let mockUserContext: AuthenticatedUserContext | null = null;

export async function getAuthenticatedUserContext(): Promise<AuthenticatedUserContext> {
  if (mockUserContext !== null) {
    if (!isTestEnvironment() && !isDevelopmentEnvironment()) {
      throw new Error('Forbidden: test authorization overrides are disabled in non-test/production environments.');
    }
    return mockUserContext;
  }

  if (!isDevelopmentEnvironment()) {
    throw new Error('Unauthorized: participant authentication is required.');
  }

  return {
    userId: process.env.BAREA_DEV_USER_ID || 'user-dev-001',
    providerType: 'GOOGLE',
    providerSub: 'google-sub-dev-001',
    email: 'dev.participant@church.org',
    emailVerified: true,
    phone: '+12125550199',
    phoneVerified: true,
    displayName: 'Dev Participant'
  };
}

export function setAuthenticatedUserContext(context: AuthenticatedUserContext | null): void {
  if (process.env.NODE_ENV === 'production' || (!isTestEnvironment() && !isDevelopmentEnvironment())) {
    throw new Error('Forbidden: test authorization overrides cannot be executed in production.');
  }
  mockUserContext = context;
}

let mockClientIp: string | null = null;

export function setTrustedClientIpForTesting(ip: string | null): void {
  if (process.env.NODE_ENV === 'production' || (!isTestEnvironment() && !isDevelopmentEnvironment())) {
    throw new Error('Forbidden: client IP test overrides cannot be executed in production.');
  }
  mockClientIp = ip;
}

/**
 * Extracts and validates IPv4 or IPv6 string. Returns null if invalid format.
 */
function parseValidIp(candidate: string): string | null {
  const trimmed = candidate.trim();
  // IPv4 simple regex: 4 octets 0-255
  const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  // IPv6 basic structure regex
  const ipv6Regex = /^[0-9a-fA-F:.]+$/;
  if (ipv4Regex.test(trimmed)) {
    return trimmed;
  }
  if (ipv6Regex.test(trimmed) && trimmed.includes(':')) {
    return trimmed;
  }
  return null;
}

/**
 * Derives the effective client IP server-side from trusted request metadata.
 * Never accepts client-supplied parameters or unverified forwarding headers.
 */
export async function resolveServerClientIp(): Promise<string> {
  // Test fixture override (strictly guarded to test/dev environment)
  if (mockClientIp !== null) {
    if (!isTestEnvironment() && !isDevelopmentEnvironment()) {
      throw new Error('Forbidden: client IP test overrides cannot be used in production.');
    }
    return mockClientIp;
  }

  try {
    // Dynamic import to avoid Node/CJS vs ESM bundling constraints across tsconfig.test.json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextHeadersModule = await (Function('return import("next/headers")')() as Promise<{
      headers: () => Promise<{ get: (name: string) => string | null }>;
    }>);
    const headerList = await nextHeadersModule.headers();

    // 1. Cloudflare deployment check: CF-Connecting-IP is trusted only when upstream proxy is Cloudflare
    const cfConnectingIp = headerList.get('cf-connecting-ip');
    if (cfConnectingIp) {
      const parsed = parseValidIp(cfConnectingIp);
      if (parsed) return parsed;
    }

    // 2. Standard reverse proxy traversal: X-Forwarded-For right-to-left or leftmost
    const forwardedFor = headerList.get('x-forwarded-for');
    if (forwardedFor) {
      const parts = forwardedFor.split(',').map((s: string) => s.trim()).filter(Boolean);
      // Rightmost entries are added by downstream proxies; leftmost is client IP
      if (parts.length > 0) {
        const clientCandidate = parts[0];
        const parsed = parseValidIp(clientCandidate);
        if (parsed) return parsed;
      }
    }

    // 3. X-Real-IP fallback
    const realIp = headerList.get('x-real-ip');
    if (realIp) {
      const parsed = parseValidIp(realIp);
      if (parsed) return parsed;
    }
  } catch {
    // Outside active Next.js request context (e.g. testing or CLI)
  }

  // Safe fail-closed server fallback
  return '127.0.0.1';
}
