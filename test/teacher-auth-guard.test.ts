import test from 'node:test';
import assert from 'node:assert/strict';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import { ensureAuthorizedTeacherPage } from '../src/app/teacher/auth-guard.js';
import {
  setAuthorizedTeacherContext,
  setAuthRepository,
  setAuthService,
  setSessionTokenForTesting,
} from '../src/app/teacher/review/db.js';
import { SqliteAuthRepository } from '../src/persistence/sqlite-auth-repository.js';
import { AuthService } from '../src/service/auth-service.js';
import { InMemoryRateLimiter } from '../src/service/rate-limiter.js';

test('Teacher Auth Guard - Route Navigation Failure Semantics', async (t) => {
  let authRepo: SqliteAuthRepository;
  let authService: AuthService;

  t.before(() => {
    authRepo = new SqliteAuthRepository(':memory:');
    const rateLimiter = new InMemoryRateLimiter();
    authService = new AuthService(authRepo, { rateLimiter });
    setAuthRepository(authRepo);
    setAuthService(authService);
  });

  t.after(() => {
    setAuthorizedTeacherContext(null);
    setSessionTokenForTesting(null);
    setAuthRepository(null);
    setAuthService(null);
    authRepo.close();
  });

  t.beforeEach(() => {
    setAuthorizedTeacherContext(null);
    setSessionTokenForTesting(null);
  });

  await t.test('1. Unauthenticated user: redirects to login with returnTo preserved for base route', async () => {
    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    try {
      setSessionTokenForTesting(null);
      // In production mode without session token, getAuthorizedTeacherContext throws TeacherUnauthorizedError
      envMap.NODE_ENV = 'production';

      await assert.rejects(
        async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
        (err: any) => {
          assert.equal(err?.digest?.startsWith('NEXT_REDIRECT'), true, 'Should trigger NEXT_REDIRECT');
          // Next.js redirect errors encode url in digest as "NEXT_REDIRECT;replace;/login?returnTo=...;307;"
          assert.match(String(err?.digest || ''), /\/login\?returnTo=%2Fteacher%2Fquizzes/);
          return true;
        }
      );
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
    }
  });

  await t.test('1b. Unauthenticated user on child routes: preserves exact child route returnTo (/teacher/quizzes/<id> and /teacher/review?id=<id>)', async () => {
    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    try {
      setSessionTokenForTesting(null);
      envMap.NODE_ENV = 'production';

      // Test child route /teacher/quizzes/qz-12345
      await assert.rejects(
        async () => ensureAuthorizedTeacherPage('/teacher/quizzes/qz-12345'),
        (err: any) => {
          assert.equal(err?.digest?.startsWith('NEXT_REDIRECT'), true);
          assert.match(String(err?.digest || ''), /\/login\?returnTo=%2Fteacher%2Fquizzes%2Fqz-12345/);
          return true;
        }
      );

      // Test child route with query parameters /teacher/review?id=q-98765
      await assert.rejects(
        async () => ensureAuthorizedTeacherPage('/teacher/review?id=q-98765'),
        (err: any) => {
          assert.equal(err?.digest?.startsWith('NEXT_REDIRECT'), true);
          assert.match(String(err?.digest || ''), /\/login\?returnTo=%2Fteacher%2Freview%3Fid%3Dq-98765/);
          return true;
        }
      );
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
    }
  });

  await t.test('2. Authenticated user lacking teacher/admin role: redirects to access-denied error', async () => {
    // Create an authenticated user with NO teacher or admin memberships
    const user = await authRepo.createUser({
      displayName: 'Student Jane',
      email: 'student@berea.org',
      emailVerified: true,
    });

    const { rawToken } = await authRepo.createSession(user.id, 3600);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
      (err: any) => {
        assert.equal(err?.digest?.startsWith('NEXT_REDIRECT'), true, 'Should trigger NEXT_REDIRECT');
        assert.match(String(err?.digest || ''), /\/login\?error=Access\+denied\.\+Teacher\+capability\+is\+required\./);
        return true;
      }
    );
  });

  await t.test('3. Unexpected application or database error: MUST propagate and NOT convert to login redirect', async () => {
    // Create broken repository throwing an unhandled database disk failure
    const brokenAuthRepo = {
      findSessionByToken: () => {
        throw new Error('Database disk I/O error: disk image malformed');
      },
    } as unknown as SqliteAuthRepository;

    const rateLimiter = new InMemoryRateLimiter();
    const brokenAuthService = new AuthService(brokenAuthRepo, { rateLimiter });
    setAuthService(brokenAuthService);
    setSessionTokenForTesting('valid-looking-token-123');

    try {
      // The guard MUST rethrow the database error without swallowing or redirecting to /login
      await assert.rejects(
        async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
        (err: any) => {
          assert.equal(err instanceof Error, true);
          assert.equal(err.message, 'Database disk I/O error: disk image malformed');
          assert.equal(err?.digest, undefined, 'Must not be a NEXT_REDIRECT signal');
          return true;
        }
      );
    } finally {
      setAuthService(authService);
    }
  });

  await t.test('4. Next.js internal signals (NEXT_REDIRECT / NEXT_NOT_FOUND): propagate directly', async () => {
    const redirectSignal = new Error('NEXT_REDIRECT');
    (redirectSignal as any).digest = 'NEXT_REDIRECT;replace;/somewhere;307;';

    const notFoundSignal = new Error('NEXT_NOT_FOUND');
    (notFoundSignal as any).digest = 'NEXT_NOT_FOUND';

    setAuthorizedTeacherContext({
      get userId(): string {
        throw redirectSignal;
      },
      organizationId: 'org-test',
      displayName: 'Teacher',
      role: 'teacher',
    });

    await assert.rejects(
      async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
      (err: any) => {
        assert.equal(err, redirectSignal);
        return true;
      }
    );

    setAuthorizedTeacherContext({
      get userId(): string {
        throw notFoundSignal;
      },
      organizationId: 'org-test',
      displayName: 'Teacher',
      role: 'teacher',
    });

    await assert.rejects(
      async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
      (err: any) => {
        assert.equal(err, notFoundSignal);
        return true;
      }
    );
  });

  await t.test('5. Authorized teacher: successfully returns TeacherContext without redirecting', async () => {
    const teacherUser = await authRepo.createUser({
      displayName: 'Teacher Mark',
      email: 'teacher@berea.org',
      emailVerified: true,
    });
    await authRepo.addOrganizationMembership('org-sunday-school', teacherUser.id, 'teacher');

    const { rawToken } = await authRepo.createSession(teacherUser.id, 3600);
    setSessionTokenForTesting(rawToken);

    const ctx = await ensureAuthorizedTeacherPage('/teacher/quizzes');
    assert.equal(ctx.userId, teacherUser.id);
    assert.equal(ctx.organizationId, 'org-sunday-school');
    assert.equal(ctx.role, 'teacher');
    assert.equal(ctx.displayName, 'Teacher Mark');
  });

  await t.test('6. Invalid or expired session token: strictly fails closed with login redirect and does not fallback', async () => {
    // Provide a session token that does not exist in the repository
    setSessionTokenForTesting('bst_nonexistent_token_12345');

    await assert.rejects(
      async () => ensureAuthorizedTeacherPage('/teacher/quizzes'),
      (err: any) => {
        assert.equal(err?.digest?.startsWith('NEXT_REDIRECT'), true, 'Should trigger NEXT_REDIRECT');
        assert.match(String(err?.digest || ''), /\/login\?returnTo=%2Fteacher%2Fquizzes/);
        return true;
      }
    );
  });
});
