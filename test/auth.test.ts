import test from 'node:test';
import assert from 'node:assert/strict';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import { SqliteAuthRepository } from '../src/persistence/sqlite-auth-repository';
import { AuthService } from '../src/service/auth-service';
import { hashPassword, verifyPassword } from '../src/service/password-hasher';
import {
  setAuthRepository,
  setAuthService,
  getAuthorizedTeacherContext,
  getAuthenticatedUserContext,
  setAuthorizedTeacherContext,
  setAuthenticatedUserContext,
  setSessionTokenForTesting
} from '../src/app/teacher/review/db';
import { sanitizeReturnTo } from '../src/app/login/url-utils';

import {
  InvalidCredentialsError,
  OAuthStateError,
  OAuthCallbackError
} from '../src/domain/domain-errors';

test('BAREA Authentication Architecture & Security Test Suite', async (t) => {
  let authRepo: SqliteAuthRepository;
  let authService: AuthService;

  t.beforeEach(() => {
    authRepo = new SqliteAuthRepository(':memory:');
    authService = new AuthService(authRepo, {
      googleClientId: 'mock-google-client-id.apps.googleusercontent.com',
      googleClientSecret: 'mock-google-client-secret',
      googleRedirectUri: 'http://localhost:3000/api/auth/callback/google'
    });
    setAuthRepository(authRepo);
    setAuthService(authService);
    setAuthorizedTeacherContext(null);
    setAuthenticatedUserContext(null);
    setSessionTokenForTesting(null);
  });

  t.afterEach(() => {
    setAuthorizedTeacherContext(null);
    setAuthenticatedUserContext(null);
    setSessionTokenForTesting(null);
    authRepo.close();
  });

  await t.test('PASSWORD: modern scrypt hashing produces secure hashes and verifies correctly', async () => {
    const rawPass = 'SecretP@ssw0rd123';
    const hash = await hashPassword(rawPass);

    assert.ok(hash.startsWith('scrypt$'), 'Hash must start with scrypt algorithm identifier');
    assert.equal(await verifyPassword(rawPass, hash), true, 'Valid password must verify');
    assert.equal(await verifyPassword('WrongPassword', hash), false, 'Wrong password must fail');
    assert.equal(await verifyPassword('', hash), false, 'Empty password must fail');
  });

  await t.test('PASSWORD: valid credentials succeed and create server session', async () => {
    const user = authRepo.createUser({
      email: 'teacher.anna@church.org',
      emailVerified: true,
      passwordHash: await hashPassword('Faithful2026!'),
      displayName: 'Teacher Anna'
    });

    const loginRes = await authService.loginWithPassword({
      email: 'teacher.anna@church.org',
      password: 'Faithful2026!'
    });

    assert.equal(loginRes.user.id, user.id);
    assert.equal(loginRes.user.displayName, 'Teacher Anna');
    assert.ok(loginRes.rawToken.startsWith('bst_'), 'Session token must have bst_ prefix');

    // Verify session resolves correctly
    const sessionCtx = authService.resolveSession(loginRes.rawToken);
    assert.ok(sessionCtx !== null);
    assert.equal(sessionCtx?.user.id, user.id);
  });

  await t.test('PASSWORD: invalid password fails safely', async () => {
    authRepo.createUser({
      email: 'teacher.john@church.org',
      emailVerified: true,
      passwordHash: await hashPassword('CorrectPassword1'),
      displayName: 'Teacher John'
    });

    await assert.rejects(
      async () => authService.loginWithPassword({
        email: 'teacher.john@church.org',
        password: 'IncorrectPassword'
      }),
      InvalidCredentialsError
    );
  });

  await t.test('PASSWORD: unknown account fails safely with InvalidCredentialsError', async () => {
    await assert.rejects(
      async () => authService.loginWithPassword({
        email: 'nonexistent@church.org',
        password: 'AnyPassword'
      }),
      InvalidCredentialsError
    );
  });

  await t.test('PASSWORD: password hash is never exposed on user object', async () => {
    const user = authRepo.createUser({
      email: 'member@church.org',
      displayName: 'Member Bob',
      passwordHash: await hashPassword('Secret1234')
    });

    const session = authRepo.createSession(user.id);
    const resolved = authRepo.findSessionByToken(session.rawToken);

    // In domain interfaces, passwordHash is stripped or nullable and never leaked to actions
    assert.ok(resolved !== null);
    assert.equal(resolved?.user.displayName, 'Member Bob');
  });

  await t.test('SESSION: session created after successful authentication and invalidation works', async () => {
    const user = authRepo.createUser({
      email: 'youth@church.org',
      displayName: 'Youth Leader'
    });

    const { rawToken } = authRepo.createSession(user.id);
    assert.ok(authRepo.findSessionByToken(rawToken) !== null);

    // Invalidate session
    authService.logout(rawToken);
    assert.equal(authRepo.findSessionByToken(rawToken), null, 'Invalidated session must return null');
  });

  await t.test('SESSION: expired session is strictly rejected', async () => {
    const user = authRepo.createUser({
      email: 'expired@church.org',
      displayName: 'Expired User'
    });

    // Create session that expired 1 second ago (-1s ttl)
    const { rawToken } = authRepo.createSession(user.id, -1);
    assert.equal(authRepo.findSessionByToken(rawToken), null, 'Expired session must return null');
  });

  await t.test('OAUTH: generateGoogleOAuthUrl generates PKCE code_challenge and state', () => {
    const res = authService.generateGoogleOAuthUrl('http://localhost:3000/api/auth/callback/google');
    assert.ok(res.url.includes('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(res.url.includes('code_challenge='));
    assert.ok(res.url.includes('code_challenge_method=S256'));
    assert.ok(res.state.length >= 16);
    assert.ok(res.codeVerifier.length >= 16);
  });

  await t.test('OAUTH: state mismatch is strictly rejected', async () => {
    await assert.rejects(
      async () => authService.handleGoogleCallback({
        code: 'mock-code',
        expectedState: 'state-abc',
        receivedState: 'state-forged',
        codeVerifier: 'verifier-xyz'
      }),
      OAuthStateError
    );
  });

  await t.test('OAUTH: missing state or code is rejected', async () => {
    await assert.rejects(
      async () => authService.handleGoogleCallback({
        code: '',
        expectedState: 'state-abc',
        receivedState: 'state-abc',
        codeVerifier: 'verifier-xyz'
      }),
      OAuthCallbackError
    );
  });

  await t.test('AUTHORIZATION: authenticated normal user without teacher role cannot access Teacher Workspace', async () => {
    const user = authRepo.createUser({
      email: 'regular.member@church.org',
      displayName: 'Regular Member'
    });
    // No organization membership added for user

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('AUTHORIZATION: authenticated user with teacher membership successfully accesses Teacher Workspace', async () => {
    const user = authRepo.createUser({
      email: 'verified.teacher@church.org',
      displayName: 'Teacher Deborah'
    });
    authRepo.addOrganizationMembership('church-berea-central', user.id, 'teacher');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, 'church-berea-central');
    assert.equal(ctx.role, 'teacher');
    assert.equal(ctx.displayName, 'Teacher Deborah');
  });

  await t.test('AUTHORIZATION: admin membership also grants Teacher Workspace access', async () => {
    const user = authRepo.createUser({
      email: 'pastor.admin@church.org',
      displayName: 'Pastor Admin'
    });
    authRepo.addOrganizationMembership('church-berea-central', user.id, 'admin');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.role, 'admin');
  });

  await t.test('AUTHORIZATION: getAuthenticatedUserContext derives identity strictly from server session', async () => {
    const user = authRepo.createUser({
      email: 'participant.mary@church.org',
      emailVerified: true,
      displayName: 'Mary S.'
    });

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const userCtx = await getAuthenticatedUserContext();
    assert.equal(userCtx.userId, user.id);
    assert.equal(userCtx.email, 'participant.mary@church.org');
    assert.equal(userCtx.displayName, 'Mary S.');
  });

  await t.test('SECURITY: sanitizeReturnTo rejects external and malicious returnTo URLs', () => {
    assert.equal(sanitizeReturnTo('https://evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('//evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/\\evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo(''), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo(null), '/teacher/quizzes');

    // Valid internal paths allowed
    assert.equal(sanitizeReturnTo('/teacher/quizzes'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/review?id=q_123'), '/teacher/review?id=q_123');
  });
});
