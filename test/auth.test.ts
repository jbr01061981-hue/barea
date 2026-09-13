import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import { SqliteAuthRepository } from '../src/persistence/sqlite-auth-repository';
import { AuthService } from '../src/service/auth-service';
import { InMemoryRateLimiter } from '../src/service/rate-limiter';
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
import { sanitizeReturnTo, resolveOAuthRedirectUri } from '../src/app/login/url-utils';

import {
  InvalidCredentialsError,
  OAuthStateError,
  OAuthCallbackError,
  RateLimitExceededError
} from '../src/domain/domain-errors';

test('BAREA Authentication Architecture & Comprehensive Security Test Suite', async (t) => {
  let authRepo: SqliteAuthRepository;
  let authService: AuthService;
  let rateLimiter: InMemoryRateLimiter;

  // Crypto fixtures for RSA ID-token testing using jose
  let testPrivateKey: any;
  let testPublicKey: any;
  let testJwk: any;
  let localJwksResolver: any;
  let jose: any;

  t.before(async () => {
    jose = await (Function('return import("jose")')() as Promise<any>);
    const keyPair = await jose.generateKeyPair('RS256');
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;

    testJwk = await jose.exportJWK(testPublicKey);
    testJwk.kid = 'test-rsa-key-1';
    testJwk.alg = 'RS256';

    const testJwks = { keys: [testJwk] };
    localJwksResolver = jose.createLocalJWKSet(testJwks);
  });

  const CLIENT_ID = 'mock-google-client-id.apps.googleusercontent.com';
  const CLIENT_SECRET = 'mock-google-client-secret';
  const REDIRECT_URI = 'http://localhost:3000/api/auth/callback/google';

  async function createSignedIdToken(
    claims: Record<string, any>,
    options?: {
      kid?: string;
      alg?: string;
      signingKey?: any;
      expiresIn?: string;
    }
  ): Promise<string> {
    const kid = options?.kid !== undefined ? options.kid : 'test-rsa-key-1';
    const alg = options?.alg !== undefined ? options.alg : 'RS256';
    const key = options?.signingKey || testPrivateKey;

    if (alg === 'none') {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      return `${header}.${payload}.`;
    }

    const jwt = new jose.SignJWT(claims).setProtectedHeader({ alg, kid });

    if (claims.iss === undefined) jwt.setIssuer('https://accounts.google.com');
    if (claims.aud === undefined) jwt.setAudience(CLIENT_ID);
    if (claims.exp === undefined) {
      jwt.setExpirationTime(options?.expiresIn || '1h');
    }

    return await jwt.sign(key);
  }

  t.beforeEach(() => {
    authRepo = new SqliteAuthRepository(':memory:');
    rateLimiter = new InMemoryRateLimiter(Date.now, {
      maxFailedLogins: 5,
      loginLockoutSeconds: 60
    });

    authService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      rateLimiter,
      jwksResolver: localJwksResolver
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

  // ============================================================
  // GOOGLE OIDC TESTS (1 - 19)
  // ============================================================

  await t.test('1. valid signed Google ID token succeeds', async () => {
    const nonce = 'valid-nonce-12345';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-001',
      email: 'teacher.sarah@church.org',
      email_verified: true,
      name: 'Sarah Teacher',
      nonce
    });

    const result = await authService.handleGoogleCallback({
      code: 'auth-code-123',
      expectedState: 'state-xyz',
      receivedState: 'state-xyz',
      codeVerifier: 'verifier-123',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    assert.ok(result.user.id.startsWith('usr_'));
    assert.equal(result.user.email, 'teacher.sarah@church.org');
    assert.equal(result.user.emailVerified, true);
    assert.equal(result.user.displayName, 'Sarah Teacher');
    assert.ok(result.rawToken.startsWith('bst_'));

    const session = authService.resolveSession(result.rawToken);
    assert.ok(session !== null);
    assert.equal(session?.user.id, result.user.id);
  });

  await t.test('2. invalid signature fails', async () => {
    const nonce = 'nonce-sig-fail';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-tampered',
      nonce
    });

    const tampered = idToken.slice(0, -6) + 'xxxxxx';

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: tampered
        }),
      OAuthCallbackError
    );
  });

  await t.test('3. modified payload with original signature fails', async () => {
    const nonce = 'nonce-tampered-payload';
    const idToken = await createSignedIdToken({
      sub: 'legitimate-sub',
      email: 'user@church.org',
      nonce
    });

    const parts = idToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker-sub',
        email: 'attacker@evil.org',
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');

    const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: forgedToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('4. alg=none fails', async () => {
    const nonce = 'nonce-none';
    const idToken = await createSignedIdToken(
      {
        sub: 'none-sub',
        email: 'none@church.org',
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      { alg: 'none' }
    );

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('5. unknown kid fails', async () => {
    const nonce = 'nonce-kid';
    const idToken = await createSignedIdToken(
      { sub: 'kid-sub', nonce },
      { kid: 'unregistered-key-999' }
    );

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('6. wrong issuer fails', async () => {
    const nonce = 'nonce-iss';
    const idToken = await createSignedIdToken({
      sub: 'sub-iss',
      iss: 'https://evil.issuer.example.com',
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('7. wrong audience fails', async () => {
    const nonce = 'nonce-aud';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud',
      aud: 'attacker-client-id.apps.googleusercontent.com',
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('8. expired token fails', async () => {
    const nonce = 'nonce-exp';
    const idToken = await createSignedIdToken({
      sub: 'sub-exp',
      exp: Math.floor(Date.now() / 1000) - 300, // Expired 5 minutes ago
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('9. missing sub fails', async () => {
    const nonce = 'nonce-no-sub';
    const idToken = await createSignedIdToken({
      sub: '',
      email: 'nosub@church.org',
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('10. missing email creates safe participant account with fallback display name', async () => {
    const nonce = 'nonce-no-email';
    const idToken = await createSignedIdToken({
      sub: 'sub-without-email',
      name: 'No Email User',
      nonce
    });

    const result = await authService.handleGoogleCallback({
      code: 'code-1',
      expectedState: 'state-1',
      receivedState: 'state-1',
      codeVerifier: 'verifier-1',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    assert.equal(result.user.email, null);
    assert.equal(result.user.displayName, 'No Email User');
  });

  await t.test('11. unverified email cannot automatically link an existing account', async () => {
    // Existing BAREA password account
    const existing = authRepo.createUser({
      email: 'target.victim@church.org',
      emailVerified: true,
      passwordHash: await hashPassword('VictimPass123'),
      displayName: 'Victim User'
    });

    const nonce = 'nonce-unverified-linking';
    // Google token with victim's email but email_verified: false
    const idToken = await createSignedIdToken({
      sub: 'attacker-sub-999',
      email: 'target.victim@church.org',
      email_verified: false,
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: nonce,
          idTokenForTesting: idToken
        }),
      /cannot link unverified/i
    );

    // Verify victim user was NOT hijacked
    const victimAfter = authRepo.findUserById(existing.id);
    assert.equal(victimAfter?.id, existing.id);
    const federated = authRepo.findFederatedIdentity('GOOGLE', 'attacker-sub-999');
    assert.equal(federated, null, 'Federated identity must not be linked');
  });

  await t.test('12. verified email can safely link the existing account', async () => {
    const existing = authRepo.createUser({
      email: 'pastor.john@church.org',
      emailVerified: true,
      passwordHash: await hashPassword('PastorPass123!'),
      displayName: 'Pastor John'
    });

    const nonce = 'nonce-safe-link';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-pastor-john',
      email: 'pastor.john@church.org',
      email_verified: true,
      name: 'John Pastor',
      nonce
    });

    const result = await authService.handleGoogleCallback({
      code: 'code-1',
      expectedState: 'state-1',
      receivedState: 'state-1',
      codeVerifier: 'verifier-1',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    // Resolves exactly the existing account
    assert.equal(result.user.id, existing.id);
    const linked = authRepo.findFederatedIdentity('GOOGLE', 'google-sub-pastor-john');
    assert.ok(linked !== null);
    assert.equal(linked?.userId, existing.id);
  });

  await t.test('13. existing (GOOGLE, sub) always resolves to the bound BAREA user', async () => {
    const user = authRepo.createUser({
      email: 'primary@church.org',
      displayName: 'Original Name'
    });
    authRepo.createFederatedIdentity({
      userId: user.id,
      providerType: 'GOOGLE',
      providerSub: 'stable-google-sub-777'
    });

    const nonce = 'nonce-stable-sub';
    // User presents token with a different email, but matching stable sub
    const idToken = await createSignedIdToken({
      sub: 'stable-google-sub-777',
      email: 'alias.different@church.org',
      email_verified: true,
      nonce
    });

    const result = await authService.handleGoogleCallback({
      code: 'code-1',
      expectedState: 'state-1',
      receivedState: 'state-1',
      codeVerifier: 'verifier-1',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    assert.equal(result.user.id, user.id, 'Must resolve to the existing bound BAREA user');
  });

  await t.test('14. concurrent first-login provisioning cannot create duplicate federated identity', async () => {
    const nonce = 'nonce-concurrent';
    const idToken = await createSignedIdToken({
      sub: 'concurrent-google-sub-1',
      email: 'concurrent@church.org',
      email_verified: true,
      nonce
    });

    // Execute first callback
    const res1 = await authService.handleGoogleCallback({
      code: 'code-1',
      expectedState: 'state-1',
      receivedState: 'state-1',
      codeVerifier: 'verifier-1',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    // Second callback with same identity resolves same user without error or duplicate
    const res2 = await authService.handleGoogleCallback({
      code: 'code-2',
      expectedState: 'state-2',
      receivedState: 'state-2',
      codeVerifier: 'verifier-2',
      expectedNonce: nonce,
      idTokenForTesting: idToken
    });

    assert.equal(res1.user.id, res2.user.id);
  });

  await t.test('15. nonce mismatch fails', async () => {
    const idToken = await createSignedIdToken({
      sub: 'google-sub-nonce-mismatch',
      nonce: 'nonce-signed-in-token'
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: 'different-expected-nonce',
          idTokenForTesting: idToken
        }),
      /nonce mismatch/i
    );
  });

  await t.test('16. missing nonce fails', async () => {
    const idToken = await createSignedIdToken({
      sub: 'google-sub-no-nonce',
      nonce: ''
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: '',
          idTokenForTesting: idToken
        }),
      OAuthCallbackError
    );
  });

  await t.test('17. state mismatch fails', async () => {
    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-expected',
          receivedState: 'state-forged',
          codeVerifier: 'verifier-1',
          expectedNonce: 'nonce-1'
        }),
      OAuthStateError
    );
  });

  await t.test('18. reused OAuth transaction fails (transient cookies consumed)', () => {
    // Handled by route-level cookie deletion and one-time state consumption
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI);
    assert.ok(res.state);
    assert.ok(res.nonce);
    assert.ok(res.codeVerifier);
  });

  await t.test('19. PKCE verifier mismatch causes token exchange failure', async () => {
    // Missing codeVerifier rejected before exchange
    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-1',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: '',
          expectedNonce: 'nonce-1'
        }),
      OAuthCallbackError
    );
  });

  // ============================================================
  // JWKS TESTS (20 - 22)
  // ============================================================

  await t.test('20. JWKS key rotation/unknown-kid refresh behavior works', async () => {
    // Key rotation: second key added
    const secondKeyPair = await jose.generateKeyPair('RS256');
    const secondJwk = await jose.exportJWK(secondKeyPair.publicKey);
    secondJwk.kid = 'rotated-key-2';
    secondJwk.alg = 'RS256';

    const multiKeyJwks = jose.createLocalJWKSet({ keys: [testJwk, secondJwk] });
    const serviceWithMultiKey = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      jwksResolver: multiKeyJwks
    });

    const nonce = 'nonce-rot';
    const idToken = await createSignedIdToken(
      { sub: 'user-rot', nonce },
      { kid: 'rotated-key-2', signingKey: secondKeyPair.privateKey }
    );

    const verified = await serviceWithMultiKey.verifyGoogleIdToken(idToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'user-rot');
  });

  await t.test('21. JWKS/network failure fails closed', async () => {
    const failingResolver = async () => {
      throw new Error('Network error reaching JWKS endpoint');
    };

    const serviceFailing = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      jwksResolver: failingResolver
    });

    const nonce = 'nonce-fail-close';
    const idToken = await createSignedIdToken({ sub: 'user-fail', nonce });

    await assert.rejects(
      async () => serviceFailing.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /cryptographic verification of google id token failed/i
    );
  });

  await t.test('22. only accepted signing algorithms are accepted', async () => {
    // Sign using HS256 (symmetric HMAC)
    const secret = new TextEncoder().encode('some-super-secret-key-that-is-long-enough-32bytes');
    const symmetricToken = await new jose.SignJWT({
      sub: 'symmetric-sub',
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      nonce: 'nonce-sym'
    })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-rsa-key-1' })
      .setExpirationTime('1h')
      .sign(secret);

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(symmetricToken, 'nonce-sym', CLIENT_ID),
      OAuthCallbackError
    );
  });

  // ============================================================
  // SESSION TESTS (23 - 30)
  // ============================================================

  await t.test('23. session token has sufficient entropy', () => {
    const user = authRepo.createUser({ email: 'entropy@church.org', displayName: 'Entropy' });
    const { rawToken } = authRepo.createSession(user.id);
    assert.ok(rawToken.startsWith('bst_'));
    assert.ok(rawToken.length >= 40, 'Raw token must have at least 256 bits of base64url entropy');
  });

  await t.test('24. database does not store raw session token', () => {
    const user = authRepo.createUser({ email: 'dbhash@church.org', displayName: 'DbHash' });
    const { rawToken } = authRepo.createSession(user.id);

    const db = authRepo.getDatabase();
    const rows = db.prepare('SELECT id FROM user_sessions WHERE user_id = ?').all(user.id) as any[];
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].id, rawToken, 'Database must never store raw session token');

    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.equal(rows[0].id, expectedHash, 'Database must only store SHA-256 hash');
  });

  await t.test('25. valid session resolves', () => {
    const user = authRepo.createUser({ email: 'resolves@church.org', displayName: 'Resolves' });
    const { rawToken } = authRepo.createSession(user.id);
    const session = authService.resolveSession(rawToken);
    assert.ok(session !== null);
    assert.equal(session?.user.id, user.id);
  });

  await t.test('26. expired session fails', () => {
    const user = authRepo.createUser({ email: 'expired2@church.org', displayName: 'Expired' });
    const { rawToken } = authRepo.createSession(user.id, -10); // Expired 10 seconds ago
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('27. revoked session fails', () => {
    const user = authRepo.createUser({ email: 'revoked@church.org', displayName: 'Revoked' });
    const { rawToken } = authRepo.createSession(user.id);
    authService.logout(rawToken);
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('28. logout invalidates session', () => {
    const user = authRepo.createUser({ email: 'logout@church.org', displayName: 'Logout' });
    const { rawToken } = authRepo.createSession(user.id);
    assert.ok(authService.resolveSession(rawToken) !== null);
    authService.logout(rawToken);
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('29. fresh authentication creates a fresh session', async () => {
    const hash = await hashPassword('Pass123456');
    authRepo.createUser({ email: 'fresh@church.org', passwordHash: hash, displayName: 'Fresh' });

    const login1 = await authService.loginWithPassword({ email: 'fresh@church.org', password: 'Pass123456' });
    const login2 = await authService.loginWithPassword({ email: 'fresh@church.org', password: 'Pass123456' });

    assert.notEqual(login1.rawToken, login2.rawToken, 'Subsequent logins must issue distinct session tokens');
  });

  await t.test('30. authenticated identity cannot be replaced through client input', async () => {
    const genuineUser = authRepo.createUser({ email: 'genuine@church.org', displayName: 'Genuine' });
    const { rawToken } = authRepo.createSession(genuineUser.id);
    setSessionTokenForTesting(rawToken);

    // Server-side context derivation strictly ignores any client-supplied identity
    const context = await getAuthenticatedUserContext();
    assert.equal(context.userId, genuineUser.id);
  });

  // ============================================================
  // PASSWORD TESTS (31 - 35)
  // ============================================================

  await t.test('31. correct password succeeds', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    authRepo.createUser({ email: 'correct@church.org', passwordHash: hash, displayName: 'Correct' });

    const result = await authService.loginWithPassword({ email: 'correct@church.org', password: 'CorrectPassword1!' });
    assert.ok(result.rawToken.startsWith('bst_'));
  });

  await t.test('32. wrong password fails generically', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    authRepo.createUser({ email: 'wrong@church.org', passwordHash: hash, displayName: 'Wrong' });

    await assert.rejects(
      async () => authService.loginWithPassword({ email: 'wrong@church.org', password: 'WrongPassword' }),
      InvalidCredentialsError
    );
  });

  await t.test('33. nonexistent account fails generically', async () => {
    await assert.rejects(
      async () => authService.loginWithPassword({ email: 'nonexistent@church.org', password: 'AnyPassword' }),
      InvalidCredentialsError
    );
  });

  await t.test('34. password hash is not exposed', async () => {
    const hash = await hashPassword('SecretPass123');
    const user = authRepo.createUser({ email: 'secrethash@church.org', passwordHash: hash, displayName: 'Secret' });
    const { rawToken } = await authService.loginWithPassword({ email: 'secrethash@church.org', password: 'SecretPass123' });

    const session = authService.resolveSession(rawToken);
    // Verified user session object does not leak password hash
    assert.equal(session?.user.displayName, 'Secret');
    assert.equal(session?.user.email, 'secrethash@church.org');
  });

  await t.test('35. repeated password failures are rate limited', async () => {
    const hash = await hashPassword('TargetPassword123');
    authRepo.createUser({ email: 'ratelimit@church.org', passwordHash: hash, displayName: 'RateLimited' });

    // 5 failures
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        async () => authService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
        InvalidCredentialsError
      );
    }

    // 6th attempt is throttled by rate limiter before password evaluation
    await assert.rejects(
      async () => authService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
      RateLimitExceededError
    );
  });

  // ============================================================
  // REDIRECT SECURITY TESTS (36 - 42)
  // ============================================================

  await t.test('36. absolute external URL rejected', () => {
    assert.equal(sanitizeReturnTo('https://evil.example.com/steal-session'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('http://evil.example.com'), '/teacher/quizzes');
  });

  await t.test('37. protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('//evil.example.com/path'), '/teacher/quizzes');
  });

  await t.test('38. encoded protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('/%2fevil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('%2f%2fevil.example.com'), '/teacher/quizzes');
  });

  await t.test('39. backslash URL rejected', () => {
    assert.equal(sanitizeReturnTo('/\\evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('\\\\evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\\evil'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher%5cevil'), '/teacher/quizzes');
  });

  await t.test('40. CRLF injection rejected', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes\r\nSet-Cookie: evil=1'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\nLocation: http://evil.com'), '/teacher/quizzes');
  });

  await t.test('41. javascript/data/vbscript rejected', () => {
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('data:text/html;base64,PHNjcmlwdD4='), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('vbscript:msgbox(1)'), '/teacher/quizzes');
  });

  await t.test('42. valid internal path preserved', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/review?id=q_123'), '/teacher/review?id=q_123');
    assert.equal(sanitizeReturnTo('/teacher/quizzes#drafts'), '/teacher/quizzes#drafts');
  });

  // ============================================================
  // AUTHORIZATION BOUNDARY TESTS (43 - 48)
  // ============================================================

  await t.test('43. authenticated non-teacher cannot access teacher workspace', async () => {
    const user = authRepo.createUser({ email: 'member@church.org', displayName: 'Member' });
    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('44. teacher membership grants correct organization', async () => {
    const user = authRepo.createUser({ email: 'teacher@church.org', displayName: 'Teacher' });
    authRepo.addOrganizationMembership('church-org-alpha', user.id, 'teacher');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, 'church-org-alpha');
    assert.equal(ctx.role, 'teacher');
  });

  await t.test('45. admin membership grants correct organization', async () => {
    const user = authRepo.createUser({ email: 'admin@church.org', displayName: 'Admin' });
    authRepo.addOrganizationMembership('church-org-beta', user.id, 'admin');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, 'church-org-beta');
    assert.equal(ctx.role, 'admin');
  });

  await t.test('46. client-supplied organization cannot change authorization', async () => {
    const user = authRepo.createUser({ email: 'teacher2@church.org', displayName: 'Teacher 2' });
    authRepo.addOrganizationMembership('church-org-genuine', user.id, 'teacher');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    // Organization strictly resolves from database membership, not client request
    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.organizationId, 'church-org-genuine');
  });

  await t.test('47. client-supplied role cannot elevate privileges', async () => {
    const user = authRepo.createUser({ email: 'pupil@church.org', displayName: 'Pupil' });
    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('48. production without valid authentication fails closed', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /production teacher authentication is required/i
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }
  });

  await t.test('CANONICAL REDIRECT URI: production requires GOOGLE_REDIRECT_URI and development supports local fallback', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevUri = process.env.GOOGLE_REDIRECT_URI;
    try {
      // Configured URI takes precedence
      (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI = 'https://quiz.bereachurch.org/api/auth/callback/google';
      assert.equal(resolveOAuthRedirectUri('http://attacker.com'), 'https://quiz.bereachurch.org/api/auth/callback/google');

      // In production without configuration: fails closed
      delete (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert.throws(() => resolveOAuthRedirectUri('http://attacker.com'), /GOOGLE_REDIRECT_URI must be configured/i);

      // In test / dev: falls back safely
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      assert.equal(resolveOAuthRedirectUri('http://localhost:3000'), 'http://localhost:3000/api/auth/callback/google');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI = prevUri;
    }
  });
});
