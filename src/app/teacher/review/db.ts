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
import { LiveQuizService } from '../../../service/live-quiz-service';
import { InMemoryRealtimeTransport } from '../../../transport/realtime-transport';

import { cookies } from 'next/headers';
import { SqliteAuthRepository } from '../../../persistence/sqlite-auth-repository';
import { AuthService } from '../../../service/auth-service';
import { TeacherUnauthorizedError, TeacherForbiddenError } from '../../../domain/domain-errors';

let globalRepo: SqliteQuestionRepository | null = null;
let globalBankService: QuestionBankService | null = null;
let globalQuizRepo: SqliteQuizRepository | null = null;
let globalQuizService: QuizService | null = null;
let globalAIService: AIGenerationService | null = null;
let globalSessionRepo: SqliteSessionRepository | null = null;
let globalSessionService: SessionService | null = null;
let globalRateLimiter: InMemoryRateLimiter | null = null;
let globalAuthRepo: SqliteAuthRepository | null = null;
let globalAuthService: AuthService | null = null;

export function getAuthRepository(): SqliteAuthRepository {
  if (!globalAuthRepo) {
    const dbPath = process.env.BAREA_DB_PATH || path.join(process.cwd(), 'barea.db');
    globalAuthRepo = new SqliteAuthRepository(dbPath);
  }
  return globalAuthRepo;
}

export function setAuthRepository(repo: SqliteAuthRepository | null): void {
  globalAuthRepo = repo;
}

export function getAuthService(): AuthService {
  if (!globalAuthService) {
    globalAuthService = new AuthService(getAuthRepository(), {
      rateLimiter: getRateLimiter()
    });
  }
  return globalAuthService;
}

export function setAuthService(service: AuthService | null): void {
  globalAuthService = service;
}


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

export function getSessionRepository(): SqliteSessionRepository {
  if (!globalSessionRepo) {
    const dbPath = process.env.BAREA_DB_PATH || path.join(process.cwd(), 'barea.db');
    globalSessionRepo = new SqliteSessionRepository(dbPath);
  }
  return globalSessionRepo;
}

export function setSessionRepository(repo: SqliteSessionRepository | null): void {
  globalSessionRepo = repo;
}

export function getSessionService(): SessionService {
  if (!globalSessionService) {
    globalSessionService = new SessionService(getSessionRepository(), getRateLimiter());
  }
  return globalSessionService;
}

export function setSessionService(service: SessionService | null): void {
  globalSessionService = service;
}

let globalRealtimeTransport: InMemoryRealtimeTransport | null = null;
let globalLiveQuizService: LiveQuizService | null = null;

export function getRealtimeTransport(): InMemoryRealtimeTransport {
  if (!globalRealtimeTransport) {
    globalRealtimeTransport = new InMemoryRealtimeTransport();
  }
  return globalRealtimeTransport;
}

export function setRealtimeTransport(transport: InMemoryRealtimeTransport | null): void {
  globalRealtimeTransport = transport;
}

export function getLiveQuizService(): LiveQuizService {
  if (!globalLiveQuizService) {
    globalLiveQuizService = new LiveQuizService(
      getSessionRepository(),
      getRateLimiter(),
      getRealtimeTransport()
    );
  }
  return globalLiveQuizService;
}

export function setLiveQuizService(service: LiveQuizService | null): void {
  globalLiveQuizService = service;
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

let mockSessionTokenForTesting: string | null = null;

export function setSessionTokenForTesting(token: string | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Forbidden: session token test overrides cannot be executed in production.');
  }
  mockSessionTokenForTesting = token;
}

/**
 * Resolves the raw session token from the barea_session cookie.
 * Gracefully handles contexts where Next.js cookies() is unavailable (e.g. tests outside request scope).
 */
export async function getSessionTokenFromRequest(): Promise<string | null> {
  if (mockSessionTokenForTesting !== null) {
    return mockSessionTokenForTesting;
  }
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('barea_session');
    return sessionCookie?.value || null;
  } catch {
    return null;
  }
}

/**
 * Derives the authenticated teacher context strictly on the server.
 * Never accepts organization identity or credentials from untrusted client input.
 *
 * Security Boundary:
 * 1. Test fixture override (mockTeacherContext) is evaluated first (strictly permitted only in test or development).
 * 2. If a valid barea_session cookie is present, resolves user and verifies teacher/admin organization membership.
 * 3. If a barea_session cookie is present but invalid/expired, strictly FAILS CLOSED with TeacherUnauthorizedError.
 * 4. Default development context is permitted ONLY when NODE_ENV is explicitly 'development'.
 *    Unset, unknown, or production NODE_ENV strictly FAILS CLOSED.
 * 5. In development mode, requires an explicit, non-empty BAREA_DEV_ORG_ID.
 *    There is NO silent fallback to 'church-berea-default'; missing or empty configuration FAILS CLOSED.
 */
export async function getAuthorizedTeacherContext(): Promise<TeacherContext> {
  // Test fixture override (permitted only in test or development environments)
  if (mockTeacherContext !== null) {
    if (!isTestEnvironment() && !isDevelopmentEnvironment()) {
      throw new TeacherForbiddenError('Forbidden: test authorization overrides are disabled in non-test/production environments.');
    }
    if (!mockTeacherContext.organizationId || !mockTeacherContext.organizationId.trim() || !mockTeacherContext.userId) {
      throw new TeacherUnauthorizedError('Unauthorized: missing or invalid teacher identity.');
    }
    return mockTeacherContext;
  }

  // Check real authenticated server session from cookie
  const sessionToken = await getSessionTokenFromRequest();
  if (sessionToken) {
    const authService = getAuthService();
    const sessionContext = authService.resolveSession(sessionToken);
    if (sessionContext) {
      // Find teacher or admin membership
      const teacherMembership = sessionContext.memberships.find(m => m.role === 'teacher' || m.role === 'admin');
      if (teacherMembership) {
        return {
          userId: sessionContext.user.id,
          organizationId: teacherMembership.organizationId,
          displayName: sessionContext.user.displayName,
          role: teacherMembership.role
        };
      }
      // User is authenticated but has no teacher/admin role -> fail closed
      throw new TeacherForbiddenError('Forbidden: Authenticated user is not authorized as a teacher or admin for any organization.');
    }
    // Session token was provided but could not be resolved (e.g. invalid or expired session)
    // Strictly fail closed as unauthorized; NEVER fall through to development mock!
    throw new TeacherUnauthorizedError('Unauthorized: invalid or expired session.');
  }

  // Non-development / production / unset / unknown environment guard: must fail closed
  if (!isDevelopmentEnvironment()) {
    const env = process.env.NODE_ENV;
    if (env === 'production') {
      throw new TeacherUnauthorizedError('Unauthorized: production teacher authentication is required. Development teacher context is disabled in production.');
    }
    throw new TeacherUnauthorizedError(`Unauthorized: runtime environment (${env || 'unset'}) is not authorized for development teacher context. Explicit trusted teacher authentication is required.`);
  }

  // In explicit development mode, require explicit BAREA_DEV_ORG_ID configuration (no silent fallback)
  const devOrgId = process.env.BAREA_DEV_ORG_ID ? process.env.BAREA_DEV_ORG_ID.trim() : '';

  if (!devOrgId) {
    throw new TeacherUnauthorizedError('Unauthorized: BAREA_DEV_ORG_ID is missing or empty. Development teacher context requires an explicit organization configuration and fails closed.');
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

  // Check real authenticated server session from cookie
  const sessionToken = await getSessionTokenFromRequest();
  if (sessionToken) {
    const authService = getAuthService();
    const sessionContext = authService.resolveSession(sessionToken);
    if (sessionContext) {
      return {
        userId: sessionContext.user.id,
        providerType: sessionContext.session.authProvider || 'LOCAL_PASSWORD',
        providerSub: sessionContext.session.providerSub || sessionContext.user.id,
        email: sessionContext.user.email,
        emailVerified: sessionContext.user.emailVerified,
        phone: null,
        phoneVerified: false,
        displayName: sessionContext.user.displayName
      };
    }
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
let mockRequestHeadersForTesting: Record<string, string> | null = null;

export function setTrustedClientIpForTesting(ip: string | null): void {
  if (process.env.NODE_ENV === 'production' || (!isTestEnvironment() && !isDevelopmentEnvironment())) {
    throw new Error('Forbidden: client IP test overrides cannot be executed in production.');
  }
  mockClientIp = ip;
}

export function setMockRequestHeadersForTesting(headersMap: Record<string, string> | null): void {
  if (process.env.NODE_ENV === 'production' || (!isTestEnvironment() && !isDevelopmentEnvironment())) {
    throw new Error('Forbidden: request header test overrides cannot be executed in production.');
  }
  mockRequestHeadersForTesting = headersMap;
}

/**
 * Extracts and validates IPv4 or IPv6 string. Returns null if invalid format.
 */
function parseValidIp(candidate: string): string | null {
  if (!candidate || typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  // Reject internal spaces or multiple tokens
  if (/\s/.test(trimmed)) return null;

  // IPv4 regex: 4 octets 0-255
  const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  // IPv6 regex
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
 * Derives the effective client IP server-side from authoritative server context.
 * Never accepts client-supplied parameters or unverified forwarding headers.
 *
 * PROVENANCE & NETWORK BOUNDARY SPECIFICATION:
 * In a standard Node.js / Next.js server runtime without a proprietary platform-level
 * or socket-level cryptographic provenance token, incoming HTTP request headers
 * (including CF-Connecting-IP, X-Forwarded-For, and X-Real-IP) cannot be proven to have
 * originated from a trusted proxy. An attacker connecting directly to the server (even
 * when an environment variable like BAREA_TRUSTED_PROXY is set) can forge any of these
 * headers.
 *
 * Therefore, to guarantee that callers cannot select or hop their rate-limit identity:
 * - Forwarding headers (CF-Connecting-IP, X-Forwarded-For, X-Real-IP) are NOT USED.
 * - An environment variable alone is NOT accepted as proof of network provenance.
 * - The server strictly falls back to an authoritative, server-selected address ('127.0.0.1')
 *   or trusted test fixture context that cannot be influenced by incoming request headers.
 *
 * Nat scalability is preserved because rate limiting is multi-tiered (15 failed room
 * lookups/min, /24 subnet containment, 1 join mutation / 5s per authenticated user ID)
 * and imposes zero participant seat quotas.
 */
export async function resolveServerClientIp(): Promise<string | null> {
  // Test fixture override (strictly guarded to test/dev environment)
  if (mockClientIp !== null) {
    if (!isTestEnvironment() && !isDevelopmentEnvironment()) {
      throw new Error('Forbidden: client IP test overrides cannot be used in production.');
    }
    return mockClientIp;
  }

  // Pre-deployment MVP boundary:
  // In the current MVP deployment, no trusted edge proxy boundary (such as Cloudflare Tunnel)
  // has been established or cryptographically proven at the network layer.
  // Forwarding headers (CF-Connecting-IP, X-Forwarded-For, X-Real-IP) are caller-controlled
  // and cannot be trusted to select rate-limiting identity.
  //
  // Rather than manufacturing a false client IP ('127.0.0.1') which would collapse all unauthenticated
  // users into a single shared rate-limiting bucket and create a congregation-wide denial of service,
  // the client IP is explicitly returned as unavailable (null).
  //
  // Rate limiting before edge provenance is established relies on server-authoritative room-code
  // failure throttling and authenticated user ID throttling.
  return null;
}
