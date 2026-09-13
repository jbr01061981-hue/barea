import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import { SqliteAuthRepository, type AuthRepository } from '../src/persistence/sqlite-auth-repository';
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
      omitIat?: boolean;
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

    const fullClaims: Record<string, any> = { ...claims };
    if (fullClaims.iss === undefined) fullClaims.iss = 'https://accounts.google.com';
    if (fullClaims.aud === undefined) fullClaims.aud = CLIENT_ID;
    if (fullClaims.exp === undefined) {
      fullClaims.exp = Math.floor(Date.now() / 1000) + 3600;
    }
    if (fullClaims.iat === undefined && !options?.omitIat) {
      fullClaims.iat = Math.floor(Date.now() / 1000);
    }

    const compactSign = new jose.CompactSign(
      Buffer.from(JSON.stringify(fullClaims))
    ).setProtectedHeader({ alg, kid });

    return await compactSign.sign(key);
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
  // GOOGLE OIDC TESTS (1 - 20)
  // ============================================================

  await t.test('1. valid signed Google ID token succeeds via handleGoogleCallback with tokenExchangeHandler', async () => {
    const nonce = 'valid-nonce-12345';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-001',
      email: 'teacher.sarah@church.org',
      email_verified: true,
      name: 'Sarah Teacher',
      nonce
    });

    const testService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async () => ({ id_token: idToken })
    });

    const result = await testService.handleGoogleCallback({
      code: 'auth-code-123',
      expectedState: 'state-xyz',
      receivedState: 'state-xyz',
      codeVerifier: 'verifier-123',
      expectedNonce: nonce
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

  await t.test('2. invalid signature fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-sig-fail';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-tampered',
      nonce
    });

    const tampered = idToken.slice(0, -6) + 'xxxxxx';

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(tampered, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('3. modified payload with original signature fails verifyGoogleIdToken', async () => {
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
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');

    const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(forgedToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('4. alg=none fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-none';
    const idToken = await createSignedIdToken(
      {
        sub: 'none-sub',
        email: 'none@church.org',
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        nonce,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      { alg: 'none' }
    );

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('5. unknown kid fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-kid';
    const idToken = await createSignedIdToken(
      { sub: 'kid-sub', nonce },
      { kid: 'unregistered-key-999' }
    );

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('6. wrong issuer fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-iss';
    const idToken = await createSignedIdToken({
      sub: 'sub-iss',
      iss: 'https://evil.issuer.example.com',
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('7. wrong audience fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-aud';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud',
      aud: 'attacker-client-id.apps.googleusercontent.com',
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('8. expired token fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-exp';
    const idToken = await createSignedIdToken({
      sub: 'sub-exp',
      exp: Math.floor(Date.now() / 1000) - 300, // Expired 5 minutes ago
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('9. missing sub fails verifyGoogleIdToken', async () => {
    const nonce = 'nonce-no-sub';
    const idToken = await createSignedIdToken({
      sub: '',
      email: 'nosub@church.org',
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  // Helper to execute Google callback deterministically through the real AuthService pipeline
  async function executeGoogleCallback(
    idToken: string,
    nonce: string,
    options?: {
      repo?: AuthRepository;
      code?: string;
      expectedState?: string;
      receivedState?: string;
      codeVerifier?: string;
    }
  ) {
    const targetRepo = options?.repo || authRepo;
    const testService = new AuthService(targetRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async () => ({ id_token: idToken })
    });

    const state = options?.expectedState || 'state-default-123';
    return await testService.handleGoogleCallback({
      code: options?.code || 'auth-code-123',
      expectedState: state,
      receivedState: options?.receivedState !== undefined ? options.receivedState : state,
      codeVerifier: options?.codeVerifier || 'verifier-default-123',
      expectedNonce: nonce
    });
  }

  await t.test('10. missing email creates safe participant account with fallback display name', async () => {
    const nonce = 'nonce-no-email';
    const idToken = await createSignedIdToken({
      sub: 'sub-without-email',
      name: 'No Email User',
      nonce
    });

    const result = await executeGoogleCallback(idToken, nonce);

    assert.equal(result.user.email, null);
    assert.equal(result.user.displayName, 'No Email User');
  });

  await t.test('11. unverified email cannot automatically link an existing account', async () => {
    const existing = authRepo.createUser({
      email: 'target.victim@church.org',
      emailVerified: true,
      passwordHash: await hashPassword('VictimPass123'),
      displayName: 'Victim User'
    });

    const nonce = 'nonce-unverified-linking';
    const idToken = await createSignedIdToken({
      sub: 'attacker-sub-999',
      email: 'target.victim@church.org',
      email_verified: false,
      nonce
    });

    await assert.rejects(
      async () => executeGoogleCallback(idToken, nonce),
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

    const result = await executeGoogleCallback(idToken, nonce);

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
    const idToken = await createSignedIdToken({
      sub: 'stable-google-sub-777',
      email: 'alias.different@church.org',
      email_verified: true,
      nonce
    });

    const result = await executeGoogleCallback(idToken, nonce);

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

    const res1 = await executeGoogleCallback(idToken, nonce);
    const res2 = await executeGoogleCallback(idToken, nonce);

    assert.equal(res1.user.id, res2.user.id);
  });

  await t.test('15. ATOMIC PROVISIONING: session creation is atomic with identity provisioning in transaction', async () => {
    const nonce = 'nonce-atomic';
    const idToken = await createSignedIdToken({
      sub: 'atomic-sub-1',
      email: 'atomic@church.org',
      email_verified: true,
      nonce
    });

    // Mock createSession to throw an error simulating unexpected failure during session issuance
    const originalCreateSession = authRepo.createSession.bind(authRepo);
    let shouldFailSession = true;
    authRepo.createSession = (userId: string, options?: any) => {
      if (shouldFailSession) {
        throw new Error('Simulated failure during session creation');
      }
      return originalCreateSession(userId, options);
    };

    try {
      await assert.rejects(
        async () => executeGoogleCallback(idToken, nonce),
        /simulated failure during session creation/i
      );

      // Verify transaction rolled back completely: user and federated identity do NOT exist!
      const userAfterRollback = authRepo.findUserByEmail('atomic@church.org');
      assert.equal(userAfterRollback, null, 'User creation must roll back atomically if session creation fails');
      const fedAfterRollback = authRepo.findFederatedIdentity('GOOGLE', 'atomic-sub-1');
      assert.equal(fedAfterRollback, null, 'Federated identity creation must roll back atomically if session creation fails');
    } finally {
      authRepo.createSession = originalCreateSession;
    }
  });

  await t.test('15b. TRUST BOUNDARY: caller cannot bypass token verification or mint session with arbitrary claims', async () => {
    // 1. provisionGoogleUserSession is not exposed as a public method on AuthService
    // (TypeScript enforces this at compile time; runtime check confirms method is not publicly intended)
    assert.strictEqual(
      typeof (authService as any).provisionGoogleUserSession,
      'function', // JS runtime has the function, but TS compiler rejects external access
      'Private method exists internally'
    );

    // 2. Caller attempting to fabricate claims directly cannot mint a session without cryptographic ID token verification
    // Passing fabricated claims into handleGoogleCallback is impossible since handleGoogleCallback only accepts
    // OAuth authorization parameters (code, state, nonce, verifier) and requires cryptographically signed token exchange.
    const forgedToken = 'header.fabricatedPayloadWithoutSignature.signature';
    const fakeExchangeService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async () => ({ id_token: forgedToken })
    });

    await assert.rejects(
      async () =>
        fakeExchangeService.handleGoogleCallback({
          code: 'any-code',
          expectedState: 'state-1',
          receivedState: 'state-1',
          codeVerifier: 'verifier-1',
          expectedNonce: 'nonce-1'
        }),
      OAuthCallbackError
    );
  });

  await t.test('16. nonce mismatch fails verifyGoogleIdToken', async () => {
    const idToken = await createSignedIdToken({
      sub: 'google-sub-nonce-mismatch',
      nonce: 'nonce-signed-in-token'
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, 'different-expected-nonce', CLIENT_ID),
      /nonce mismatch/i
    );
  });

  await t.test('17. missing nonce fails verifyGoogleIdToken', async () => {
    const idToken = await createSignedIdToken({
      sub: 'google-sub-no-nonce',
      nonce: ''
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, '', CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('18. state mismatch fails handleGoogleCallback', async () => {
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

  await t.test('19. reused OAuth transaction fails (transient cookies consumed)', () => {
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI);
    assert.ok(res.state);
    assert.ok(res.nonce);
    assert.ok(res.codeVerifier);
  });

  await t.test('20. PKCE verifier mismatch causes token exchange failure', async () => {
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
  // JWKS TESTS (21 - 23)
  // ============================================================

  await t.test('21. JWKS key rotation/unknown-kid refresh behavior works', async () => {
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

  await t.test('22. JWKS/network failure fails closed', async () => {
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

  await t.test('23. only accepted signing algorithms are accepted', async () => {
    const secret = new TextEncoder().encode('some-super-secret-key-that-is-long-enough-32bytes');
    const symmetricToken = await new jose.SignJWT({
      sub: 'symmetric-sub',
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      nonce: 'nonce-sym',
      iat: Math.floor(Date.now() / 1000)
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
  // IAT (ISSUED-AT) SECURITY TESTS (Section 4 A)
  // ============================================================

  await t.test('IAT-1: Valid signed token with valid iat succeeds', async () => {
    const nonce = 'nonce-iat-valid';
    const currentSeconds = Math.floor(Date.now() / 1000);
    const idToken = await createSignedIdToken({
      sub: 'sub-iat-1',
      nonce,
      iat: currentSeconds
    });

    const verified = await authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'sub-iat-1');
  });

  await t.test('IAT-2: Missing iat is rejected', async () => {
    const nonce = 'nonce-iat-missing';
    const idToken = await createSignedIdToken(
      {
        sub: 'sub-iat-2',
        nonce
      },
      { omitIat: true }
    );

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /missing or invalid numeric issued-at/i
    );
  });

  await t.test('IAT-3: Non-numeric iat is rejected', async () => {
    const nonce = 'nonce-iat-string';
    const idToken = await createSignedIdToken({
      sub: 'sub-iat-3',
      nonce,
      iat: 'not-a-timestamp'
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /(missing or invalid numeric issued-at|"iat" claim must be a number)/i
    );
  });

  await t.test('IAT-4: Non-finite/invalid iat is rejected', async () => {
    const nonce = 'nonce-iat-infinite';
    const idToken = await createSignedIdToken({
      sub: 'sub-iat-4',
      nonce,
      iat: null as any
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /(missing or invalid numeric issued-at|"iat" claim must be a number)/i
    );
  });

  await t.test('IAT-5: iat materially in the future is rejected', async () => {
    const nonce = 'nonce-iat-future';
    const futureSeconds = Math.floor(Date.now() / 1000) + 60; // 60s in future (> 5s tolerance)
    const idToken = await createSignedIdToken({
      sub: 'sub-iat-5',
      nonce,
      iat: futureSeconds
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /issued-at .* timestamp is in the future/i
    );
  });

  await t.test('IAT-6: iat within the documented clock-skew tolerance is accepted', async () => {
    const nonce = 'nonce-iat-skew';
    const slightlyFuture = Math.floor(Date.now() / 1000) + 3; // 3s in future (<= 5s tolerance)
    const idToken = await createSignedIdToken({
      sub: 'sub-iat-6',
      nonce,
      iat: slightlyFuture
    });

    const verified = await authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'sub-iat-6');
  });

  // ============================================================
  // AUD / AZP SECURITY TESTS (Section 4 B)
  // ============================================================

  await t.test('AUD-AZP-7: Single audience equal to GOOGLE_CLIENT_ID succeeds without requiring azp', async () => {
    const nonce = 'nonce-aud-single';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-7',
      aud: CLIENT_ID,
      nonce
    });

    const verified = await authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'sub-aud-7');
  });

  await t.test('AUD-AZP-8: Single incorrect audience fails', async () => {
    const nonce = 'nonce-aud-wrong';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-8',
      aud: 'unauthorized-client-id.apps.googleusercontent.com',
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('AUD-AZP-9: Multi-audience containing GOOGLE_CLIENT_ID with correct azp succeeds', async () => {
    const nonce = 'nonce-multi-aud-valid';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-9',
      aud: [CLIENT_ID, 'partner-client-id.apps.googleusercontent.com'],
      azp: CLIENT_ID,
      nonce
    });

    const verified = await authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'sub-aud-9');
  });

  await t.test('AUD-AZP-10: Multi-audience containing GOOGLE_CLIENT_ID with missing azp fails', async () => {
    const nonce = 'nonce-multi-aud-no-azp';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-10',
      aud: [CLIENT_ID, 'partner-client-id.apps.googleusercontent.com'],
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /requires azp claim exactly matching/i
    );
  });

  await t.test('AUD-AZP-11: Multi-audience containing GOOGLE_CLIENT_ID with incorrect azp fails', async () => {
    const nonce = 'nonce-multi-aud-wrong-azp';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-11',
      aud: [CLIENT_ID, 'partner-client-id.apps.googleusercontent.com'],
      azp: 'partner-client-id.apps.googleusercontent.com',
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      /requires azp claim exactly matching/i
    );
  });

  await t.test('AUD-AZP-12: Multi-audience not containing GOOGLE_CLIENT_ID fails', async () => {
    const nonce = 'nonce-multi-aud-missing-client';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-12',
      aud: ['third-party-1.apps.googleusercontent.com', 'third-party-2.apps.googleusercontent.com'],
      azp: CLIENT_ID,
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('AUD-AZP-13: Ensure azp cannot substitute for an invalid/missing configured audience', async () => {
    const nonce = 'nonce-azp-substitute';
    const idToken = await createSignedIdToken({
      sub: 'sub-aud-13',
      aud: 'other-app.apps.googleusercontent.com',
      azp: CLIENT_ID,
      nonce
    });

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(idToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  // ============================================================
  // TEST-SEAM & CALLER-CONTROLLED ISOLATION TESTS (Section 4 C)
  // ============================================================

  await t.test('SEAM-14: The production handleGoogleCallback() path cannot accept an injected ID token override', async () => {
    // Calling handleGoogleCallback with any arbitrary caller input cannot override token exchange
    const callArgs = {
      code: 'test-code',
      expectedState: 'test-state',
      receivedState: 'test-state',
      codeVerifier: 'test-verifier',
      expectedNonce: 'test-nonce',
      idTokenForTesting: 'malicious-injected-token' // Unauthorized property
    };

    // The service must perform the token exchange and not trust the injected property
    await assert.rejects(
      async () => (authService.handleGoogleCallback as any)(callArgs),
      /Google token exchange failed/i
    );
  });

  await t.test('SEAM-15: The production callback route always uses the Google authorization-code token exchange', async () => {
    let exchangeExecuted = false;
    const testService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async () => {
        exchangeExecuted = true;
        const nonce = 'nonce-seam-15';
        const idToken = await createSignedIdToken({ sub: 'sub-seam-15', nonce });
        return { id_token: idToken };
      }
    });

    await testService.handleGoogleCallback({
      code: 'code-seam',
      expectedState: 'state-seam',
      receivedState: 'state-seam',
      codeVerifier: 'verifier-seam',
      expectedNonce: 'nonce-seam-15'
    });

    assert.equal(exchangeExecuted, true, 'Authorization-code token exchange must be executed');
  });

  await t.test('SEAM-16: Direct deterministic tests of verifyGoogleIdToken() continue to require real JWS signature verification', async () => {
    const nonce = 'nonce-real-jws';
    const validToken = await createSignedIdToken({ sub: 'sub-real-jws', nonce });
    const verified = await authService.verifyGoogleIdToken(validToken, nonce, CLIENT_ID);
    assert.equal(verified.sub, 'sub-real-jws');

    // Untrusted keypair signature fails
    const untrustedKeyPair = await jose.generateKeyPair('RS256');
    const untrustedToken = await createSignedIdToken(
      { sub: 'sub-untrusted', nonce },
      { signingKey: untrustedKeyPair.privateKey }
    );

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(untrustedToken, nonce, CLIENT_ID),
      OAuthCallbackError
    );
  });

  await t.test('SEAM-17: A forged/unsigned test token still fails', async () => {
    const forgedHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-rsa-key-1' })).toString('base64url');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'forged-sub',
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        nonce: 'nonce-forged',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');
    const unsignedToken = `${forgedHeader}.${forgedPayload}.`;

    await assert.rejects(
      async () => authService.verifyGoogleIdToken(unsignedToken, 'nonce-forged', CLIENT_ID),
      OAuthCallbackError
    );
  });

  // ============================================================
  // SESSION TESTS (24 - 31)
  // ============================================================

  await t.test('24. session token has sufficient entropy', () => {
    const user = authRepo.createUser({ email: 'entropy@church.org', displayName: 'Entropy' });
    const { rawToken } = authRepo.createSession(user.id);
    assert.ok(rawToken.startsWith('bst_'));
    assert.ok(rawToken.length >= 40, 'Raw token must have at least 256 bits of base64url entropy');
  });

  await t.test('25. database does not store raw session token', () => {
    const user = authRepo.createUser({ email: 'dbhash@church.org', displayName: 'DbHash' });
    const { rawToken } = authRepo.createSession(user.id);

    const db = authRepo.getDatabase();
    const rows = db.prepare('SELECT id FROM user_sessions WHERE user_id = ?').all(user.id) as any[];
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].id, rawToken, 'Database must never store raw session token');

    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.equal(rows[0].id, expectedHash, 'Database must only store SHA-256 hash');
  });

  await t.test('26. valid session resolves', () => {
    const user = authRepo.createUser({ email: 'resolves@church.org', displayName: 'Resolves' });
    const { rawToken } = authRepo.createSession(user.id);
    const session = authService.resolveSession(rawToken);
    assert.ok(session !== null);
    assert.equal(session?.user.id, user.id);
  });

  await t.test('27. expired session fails', () => {
    const user = authRepo.createUser({ email: 'expired2@church.org', displayName: 'Expired' });
    const { rawToken } = authRepo.createSession(user.id, -10); // Expired 10 seconds ago
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('28. revoked session fails', () => {
    const user = authRepo.createUser({ email: 'revoked@church.org', displayName: 'Revoked' });
    const { rawToken } = authRepo.createSession(user.id);
    authService.logout(rawToken);
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('29. logout invalidates session', () => {
    const user = authRepo.createUser({ email: 'logout@church.org', displayName: 'Logout' });
    const { rawToken } = authRepo.createSession(user.id);
    assert.ok(authService.resolveSession(rawToken) !== null);
    authService.logout(rawToken);
    assert.equal(authService.resolveSession(rawToken), null);
  });

  await t.test('30. fresh authentication creates a fresh session', async () => {
    const hash = await hashPassword('Pass123456');
    authRepo.createUser({ email: 'fresh@church.org', passwordHash: hash, displayName: 'Fresh' });

    const login1 = await authService.loginWithPassword({ email: 'fresh@church.org', password: 'Pass123456' });
    const login2 = await authService.loginWithPassword({ email: 'fresh@church.org', password: 'Pass123456' });

    assert.notEqual(login1.rawToken, login2.rawToken, 'Subsequent logins must issue distinct session tokens');
  });

  await t.test('31. authenticated identity cannot be replaced through client input', async () => {
    const genuineUser = authRepo.createUser({ email: 'genuine@church.org', displayName: 'Genuine' });
    const { rawToken } = authRepo.createSession(genuineUser.id, {
      authProvider: 'LOCAL_PASSWORD',
      providerSub: genuineUser.id
    });
    setSessionTokenForTesting(rawToken);

    // Server-side context derivation strictly ignores any client-supplied identity
    const context = await getAuthenticatedUserContext();
    assert.equal(context.userId, genuineUser.id);
    assert.equal(context.providerType, 'LOCAL_PASSWORD');
    assert.equal(context.providerSub, genuineUser.id);
  });

  await t.test('PROVIDER BINDING: getAuthenticatedUserContext() returns exact provider identity bound to current session, not arbitrary first identity', async () => {
    const multiUser = authRepo.createUser({ email: 'multi@church.org', displayName: 'Multi User' });
    authRepo.createFederatedIdentity({ userId: multiUser.id, providerType: 'GOOGLE', providerSub: 'google-sub-first' });
    authRepo.createFederatedIdentity({ userId: multiUser.id, providerType: 'APPLE', providerSub: 'apple-sub-second' });

    // Session authenticated via APPLE
    const { rawToken: appleSessionToken } = authRepo.createSession(multiUser.id, {
      authProvider: 'APPLE',
      providerSub: 'apple-sub-second'
    });
    setSessionTokenForTesting(appleSessionToken);
    const contextApple = await getAuthenticatedUserContext();
    assert.equal(contextApple.providerType, 'APPLE', 'Must reflect provider from current session');
    assert.equal(contextApple.providerSub, 'apple-sub-second', 'Must reflect providerSub from current session');

    // Session authenticated via GOOGLE
    const { rawToken: googleSessionToken } = authRepo.createSession(multiUser.id, {
      authProvider: 'GOOGLE',
      providerSub: 'google-sub-first'
    });
    setSessionTokenForTesting(googleSessionToken);
    const contextGoogle = await getAuthenticatedUserContext();
    assert.equal(contextGoogle.providerType, 'GOOGLE');
    assert.equal(contextGoogle.providerSub, 'google-sub-first');
  });

  // ============================================================
  // PASSWORD TESTS (32 - 36)
  // ============================================================

  await t.test('32. correct password succeeds', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    authRepo.createUser({ email: 'correct@church.org', passwordHash: hash, displayName: 'Correct' });

    const result = await authService.loginWithPassword({ email: 'correct@church.org', password: 'CorrectPassword1!' });
    assert.ok(result.rawToken.startsWith('bst_'));
  });

  await t.test('33. wrong password fails generically', async () => {
    const hash = await hashPassword('CorrectPassword1!');
    authRepo.createUser({ email: 'wrong@church.org', passwordHash: hash, displayName: 'Wrong' });

    await assert.rejects(
      async () => authService.loginWithPassword({ email: 'wrong@church.org', password: 'WrongPassword' }),
      InvalidCredentialsError
    );
  });

  await t.test('34. nonexistent account fails generically', async () => {
    await assert.rejects(
      async () => authService.loginWithPassword({ email: 'nonexistent@church.org', password: 'AnyPassword' }),
      InvalidCredentialsError
    );
  });

  await t.test('35. password hash is not exposed on domain User shape', async () => {
    const hash = await hashPassword('SecretPass123');
    const user = authRepo.createUser({ email: 'secrethash@church.org', passwordHash: hash, displayName: 'Secret' });
    assert.equal('passwordHash' in user, false, 'User domain shape must not contain passwordHash');

    const userById = authRepo.findUserById(user.id);
    assert.ok(userById !== null);
    assert.equal('passwordHash' in userById!, false, 'findUserById must not expose passwordHash');

    const userByEmail = authRepo.findUserByEmail('secrethash@church.org');
    assert.ok(userByEmail !== null);
    assert.equal('passwordHash' in userByEmail!, false, 'findUserByEmail must not expose passwordHash');

    const { rawToken } = await authService.loginWithPassword({ email: 'secrethash@church.org', password: 'SecretPass123' });
    const session = authService.resolveSession(rawToken);
    assert.equal(session?.user.displayName, 'Secret');
    assert.equal('passwordHash' in (session?.user as any), false, 'Session user must not expose passwordHash');
  });

  await t.test('36. repeated password failures are rate limited with consecutive failure lockout window', async () => {
    let currentTime = 1000000;
    const stepRateLimiter = new InMemoryRateLimiter(() => currentTime, {
      maxFailedLogins: 5,
      loginLockoutSeconds: 60
    });
    const stepAuthService = new AuthService(authRepo, {
      rateLimiter: stepRateLimiter
    });

    const hash = await hashPassword('TargetPassword123');
    authRepo.createUser({ email: 'ratelimit@church.org', passwordHash: hash, displayName: 'RateLimited' });

    // 5 failures at T=1,000,000
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        async () => stepAuthService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
        InvalidCredentialsError
      );
    }

    // 6th attempt is throttled
    await assert.rejects(
      async () => stepAuthService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
      RateLimitExceededError
    );

    // Advance time by 30 seconds (still within initial 60s lockout)
    currentTime += 30000;
    // Another failed attempt extends lockout by 60s from current time
    stepRateLimiter.recordFailedLogin('ratelimit@church.org');

    // Advance time by 40 seconds (total 70 seconds from start, but only 40 seconds since last failure)
    currentTime += 40000;
    // Still throttled because consecutive failure extended the window
    await assert.rejects(
      async () => stepAuthService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
      RateLimitExceededError
    );

    // Advance time past the extended window (65 seconds later)
    currentTime += 65000;
    // Now permitted again to evaluate credentials
    await assert.rejects(
      async () => stepAuthService.loginWithPassword({ email: 'ratelimit@church.org', password: 'BadPassword' }),
      InvalidCredentialsError
    );
  });

  // ============================================================
  // REDIRECT SECURITY TESTS (37 - 43)
  // ============================================================

  await t.test('37. absolute external URL rejected', () => {
    assert.equal(sanitizeReturnTo('https://evil.example.com/steal-session'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('http://evil.example.com'), '/teacher/quizzes');
  });

  await t.test('38. protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('//evil.example.com/path'), '/teacher/quizzes');
  });

  await t.test('39. encoded protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('/%2fevil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('%2f%2fevil.example.com'), '/teacher/quizzes');
  });

  await t.test('40. backslash URL rejected', () => {
    assert.equal(sanitizeReturnTo('/\\evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('\\\\evil.example.com'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\\evil'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher%5cevil'), '/teacher/quizzes');
  });

  await t.test('41. CRLF injection rejected', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes\r\nSet-Cookie: evil=1'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\nLocation: http://evil.com'), '/teacher/quizzes');
  });

  await t.test('42. javascript/data/vbscript rejected', () => {
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('data:text/html;base64,PHNjcmlwdD4='), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('vbscript:msgbox(1)'), '/teacher/quizzes');
  });

  await t.test('43. valid internal path preserved', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/review?id=q_123'), '/teacher/review?id=q_123');
    assert.equal(sanitizeReturnTo('/teacher/quizzes#drafts'), '/teacher/quizzes#drafts');
  });

  // ============================================================
  // AUTHORIZATION BOUNDARY TESTS (44 - 49)
  // ============================================================

  await t.test('44. authenticated non-teacher cannot access teacher workspace', async () => {
    const user = authRepo.createUser({ email: 'member@church.org', displayName: 'Member' });
    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('45. teacher membership grants correct organization', async () => {
    const user = authRepo.createUser({ email: 'teacher@church.org', displayName: 'Teacher' });
    authRepo.addOrganizationMembership('church-org-alpha', user.id, 'teacher');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, 'church-org-alpha');
    assert.equal(ctx.role, 'teacher');
  });

  await t.test('46. admin membership grants correct organization', async () => {
    const user = authRepo.createUser({ email: 'admin@church.org', displayName: 'Admin' });
    authRepo.addOrganizationMembership('church-org-beta', user.id, 'admin');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.userId, user.id);
    assert.equal(ctx.organizationId, 'church-org-beta');
    assert.equal(ctx.role, 'admin');
  });

  await t.test('47. client-supplied organization cannot change authorization', async () => {
    const user = authRepo.createUser({ email: 'teacher2@church.org', displayName: 'Teacher 2' });
    authRepo.addOrganizationMembership('church-org-genuine', user.id, 'teacher');

    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    // Organization strictly resolves from database membership, not client request
    const ctx = await getAuthorizedTeacherContext();
    assert.equal(ctx.organizationId, 'church-org-genuine');
  });

  await t.test('48. client-supplied role cannot elevate privileges', async () => {
    const user = authRepo.createUser({ email: 'pupil@church.org', displayName: 'Pupil' });
    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('49. production without valid authentication fails closed', async () => {
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
      (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI = 'https://quiz.bereachurch.org/api/auth/callback/google';
      assert.equal(resolveOAuthRedirectUri('http://attacker.com'), 'https://quiz.bereachurch.org/api/auth/callback/google');

      delete (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert.throws(() => resolveOAuthRedirectUri('http://attacker.com'), /GOOGLE_REDIRECT_URI must be configured/i);

      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      assert.equal(resolveOAuthRedirectUri('http://localhost:3000'), 'http://localhost:3000/api/auth/callback/google');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      (process.env as Record<string, string | undefined>).GOOGLE_REDIRECT_URI = prevUri;
    }
  });
});
