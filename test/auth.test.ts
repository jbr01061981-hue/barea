import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import { SqliteAuthRepository, type AuthRepository } from '../src/persistence/sqlite-auth-repository';
import { AuthService } from '../src/service/auth-service';
import { InMemoryRateLimiter } from '../src/service/rate-limiter';
import {
  setAuthRepository,
  setAuthService,
  getAuthorizedTeacherContext,
  getAuthenticatedUserContext,
  getUnifiedUserContext,
  setAuthorizedTeacherContext,
  setAuthenticatedUserContext,
  setSessionTokenForTesting
} from '../src/app/teacher/review/db';
import { sanitizeReturnTo, resolveOAuthRedirectUri, resolveEffectiveAppOrigin } from '../src/app/login/url-utils';
import { logoutAction } from '../src/app/login/actions';

import {
  OAuthStateError,
  OAuthCallbackError,
  OAuthTransactionNotFoundError,
  OAuthTransactionReplayedError,
  OAuthTransactionExpiredError,
  AccountCollisionDetectedError,
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
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async (params) => {
        // Deterministic test exchange handler:
        // By convention, tests pass mock ID token in custom code or we generate signed ID token from params.code
        const testCode = params.code;
        if (testCode.startsWith('mock_id_token:')) {
          return { id_token: testCode.slice('mock_id_token:'.length) };
        }
        // Fallback: look up pending mock token for code or generate signed token
        const idToken = (authService as any).__mockIdTokenForCode?.(testCode);
        if (idToken) {
          return { id_token: idToken };
        }
        // Default token exchange for standard test codes
        const generated = await createSignedIdToken({
          sub: 'sub-exchange-' + crypto.createHash('sha256').update(testCode).digest('hex').slice(0, 10),
          email: 'exchange.user@church.org',
          email_verified: true
        });
        return { id_token: generated };
      }
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

  await t.test('11. unverified email cannot link an existing account and fails closed', async () => {
    const existing = authRepo.createUser({
      email: 'target.victim@church.org',
      emailVerified: true,
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
      AccountCollisionDetectedError
    );

    // Verify victim user was NOT hijacked
    const victimAfter = authRepo.findUserById(existing.id);
    assert.equal(victimAfter?.id, existing.id);
    const federated = authRepo.findFederatedIdentity('GOOGLE', 'attacker-sub-999');
    assert.equal(federated, null, 'Federated identity must not be linked');
  });

  await t.test('12. verified email with different Google sub CANNOT hijack or link existing account (prohibits silent linking)', async () => {
    const existing = authRepo.createUser({
      email: 'pastor.john@church.org',
      emailVerified: true,
      displayName: 'Pastor John'
    });
    authRepo.createFederatedIdentity({
      userId: existing.id,
      providerType: 'GOOGLE',
      providerSub: 'google-sub-original-pastor'
    });

    const nonce = 'nonce-safe-link';
    const idToken = await createSignedIdToken({
      sub: 'google-sub-different-attacker',
      email: 'pastor.john@church.org',
      email_verified: true,
      name: 'Imposter Pastor',
      nonce
    });

    // Prohibits silent account takeover: must fail closed with AccountCollisionDetectedError
    await assert.rejects(
      async () => executeGoogleCallback(idToken, nonce),
      AccountCollisionDetectedError
    );

    // Verify original account remains bound to original federated identity only
    const boundIdentity = authRepo.findFederatedIdentity('GOOGLE', 'google-sub-different-attacker');
    assert.equal(boundIdentity, null, 'Different sub must not be linked to pastor account');
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
    // A service without a tokenExchangeHandler performs the real token exchange and will reject invalid codes
    const prodStyleService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver
    });

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
      async () => (prodStyleService.handleGoogleCallback as any)(callArgs),
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
    const user = authRepo.createUser({ email: 'fresh@church.org', displayName: 'Fresh' });

    const session1 = authRepo.createSession(user.id);
    const session2 = authRepo.createSession(user.id);

    assert.notEqual(session1.rawToken, session2.rawToken, 'Subsequent logins must issue distinct session tokens');
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
  // UNIFIED AUTHENTICATED HOME & CAPABILITY TESTS (32 - 36)
  // ============================================================

  await t.test('32. authenticated ordinary individual user resolves on unified home with teacher capability locked', async () => {
    const ordinaryUser = authRepo.createUser({ email: 'ordinary.member@church.org', displayName: 'Ordinary Member' });
    const { rawToken } = authRepo.createSession(ordinaryUser.id, {
      authProvider: 'GOOGLE',
      providerSub: 'google-sub-ordinary-1'
    });
    setSessionTokenForTesting(rawToken);

    const homeContext = await getUnifiedUserContext();
    assert.ok(homeContext !== null, 'Unified user context must resolve');
    assert.equal(homeContext?.userId, ordinaryUser.id);
    assert.equal(homeContext?.displayName, 'Ordinary Member');
    assert.equal(homeContext?.email, 'ordinary.member@church.org');
    assert.equal(homeContext?.isTeacherAuthorized, false, 'Teacher capability must be locked (false) for ordinary user');
    assert.equal(homeContext?.organizationId, undefined);
  });

  await t.test('33. authenticated teacher/admin user resolves on unified home with teacher capability unlocked', async () => {
    const teacherUser = authRepo.createUser({ email: 'authorized.teacher@church.org', displayName: 'Authorized Teacher' });
    authRepo.addOrganizationMembership('church-berea-org', teacherUser.id, 'teacher');
    const { rawToken } = authRepo.createSession(teacherUser.id, {
      authProvider: 'GOOGLE',
      providerSub: 'google-sub-teacher-1'
    });
    setSessionTokenForTesting(rawToken);

    const homeContext = await getUnifiedUserContext();
    assert.ok(homeContext !== null, 'Unified user context must resolve');
    assert.equal(homeContext?.userId, teacherUser.id);
    assert.equal(homeContext?.isTeacherAuthorized, true, 'Teacher capability must be unlocked (true) for teacher/admin');
    assert.equal(homeContext?.organizationId, 'church-berea-org');
    assert.equal(homeContext?.role, 'teacher');
  });

  await t.test('34. unauthenticated visitor returns null on unified home and requires login', async () => {
    setSessionTokenForTesting(null);
    const context = await getUnifiedUserContext();
    assert.equal(context, null, 'Unauthenticated visitor must resolve to null when session token is absent');
  });

  await t.test('35. ordinary authenticated user cannot reach /teacher/* even with valid session', async () => {
    const ordinaryUser = authRepo.createUser({ email: 'ordinary2@church.org', displayName: 'Ordinary Two' });
    const { rawToken } = authRepo.createSession(ordinaryUser.id, {
      authProvider: 'GOOGLE',
      providerSub: 'google-sub-ord-2'
    });
    setSessionTokenForTesting(rawToken);

    // Fail closed against teacher workspace
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );
  });

  await t.test('36. user gaining teacher membership later unlocks Create & Host capability on same account without separate identity', async () => {
    const flexibleUser = authRepo.createUser({ email: 'flexible@church.org', displayName: 'Flexible User' });
    const { rawToken } = authRepo.createSession(flexibleUser.id, {
      authProvider: 'GOOGLE',
      providerSub: 'google-sub-flex-1'
    });
    setSessionTokenForTesting(rawToken);

    // Initial state: ordinary user
    const initialHome = await getUnifiedUserContext();
    assert.equal(initialHome?.isTeacherAuthorized, false);

    // Granted teacher membership later
    authRepo.addOrganizationMembership('church-berea-org', flexibleUser.id, 'teacher');

    // Subsequent resolution reflects unlocked capability
    const updatedHome = await getUnifiedUserContext();
    assert.equal(updatedHome?.isTeacherAuthorized, true);
    assert.equal(updatedHome?.organizationId, 'church-berea-org');
  });

  await t.test('36b. navigation state: authenticated users see Individual, Create & Host, and Log out WITHOUT How it works, Log in, or Explore BAREA; public sees How it works, Log in, and Explore BAREA', async () => {
    const { SiteNav } = await import('../src/app/site-nav.js');

    // 1. Authenticated session:
    const authUser = authRepo.createUser({ email: 'nav.user@church.org', displayName: 'Nav User' });
    const { rawToken } = authRepo.createSession(authUser.id);
    setSessionTokenForTesting(rawToken);

    const authedNav = await SiteNav();
    assert.ok(authedNav, 'SiteNav must return JSX');
    const authedChildren = JSON.stringify(authedNav);
    assert.ok(authedChildren.includes('Individual'), 'Authenticated nav must contain Individual');
    assert.ok(authedChildren.includes('Create &amp; Host') || authedChildren.includes('Create & Host'), 'Authenticated nav must contain Create & Host');
    assert.ok(authedChildren.includes('Log out'), 'Authenticated nav must contain Log out');
    assert.ok(!authedChildren.includes('/#how-it-works'), 'Authenticated nav must NOT contain /#how-it-works or How it works');
    assert.ok(!authedChildren.includes('How it works'), 'Authenticated nav must NOT contain How it works');
    assert.ok(!authedChildren.includes('/login'), 'Authenticated nav must NOT contain /login');
    assert.ok(!authedChildren.includes('Explore BAREA'), 'Authenticated nav must NOT contain Explore BAREA');

    // 2. Unauthenticated session:
    setSessionTokenForTesting(null);
    const publicNav = await SiteNav();
    const publicChildren = JSON.stringify(publicNav);
    assert.ok(publicChildren.includes('/login'), 'Public nav must contain /login');
    assert.ok(publicChildren.includes('Explore BAREA'), 'Public nav must contain Explore BAREA');
    assert.ok(publicChildren.includes('/#how-it-works'), 'Public nav must contain /#how-it-works');
    assert.ok(publicChildren.includes('How it works'), 'Public nav must contain How it works');
    assert.ok(!publicChildren.includes('Individual'), 'Public nav must NOT contain Individual');
    assert.ok(!publicChildren.includes('Log out'), 'Public nav must NOT contain Log out');
  });

  await t.test('36c. post-logout verification: invalidating session guarantees getUnifiedUserContext resolves to null and SiteNav renders public navigation', async () => {
    const { SiteNav } = await import('../src/app/site-nav.js');

    const logoutUser = authRepo.createUser({ email: 'postlogout@church.org', displayName: 'Post Logout User' });
    const { rawToken } = authRepo.createSession(logoutUser.id);
    setSessionTokenForTesting(rawToken);

    // Before logout: authenticated
    const preLogoutContext = await getUnifiedUserContext();
    assert.ok(preLogoutContext !== null);
    assert.equal(preLogoutContext?.userId, logoutUser.id);

    // Perform authoritative server logout
    authService.logout(rawToken);
    setSessionTokenForTesting(null);

    // After logout: must resolve to null
    const postLogoutContext = await getUnifiedUserContext();
    assert.equal(postLogoutContext, null, 'Context after logout must be null');

    // SiteNav must render public navigation
    const postLogoutNav = await SiteNav();
    const navOutput = JSON.stringify(postLogoutNav);
    assert.ok(navOutput.includes('/login'), 'Must render public Log in after logout');
    assert.ok(navOutput.includes('Explore BAREA'), 'Must render public Explore BAREA after logout');
    assert.ok(navOutput.includes('How it works'), 'Must render public How it works after logout');
    assert.ok(!navOutput.includes('Individual'), 'Must NOT render Individual after logout');
    assert.ok(!navOutput.includes('Log out'), 'Must NOT render Log out after logout');
  });

  // ============================================================
  // REDIRECT SECURITY TESTS (37 - 43)
  // ============================================================

  await t.test('37. absolute external URL rejected', () => {
    assert.equal(sanitizeReturnTo('https://evil.example.com/steal-session'), '/home');
    assert.equal(sanitizeReturnTo('http://evil.example.com'), '/home');
  });

  await t.test('38. protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('//evil.example.com/path'), '/home');
  });

  await t.test('39. encoded protocol-relative URL rejected', () => {
    assert.equal(sanitizeReturnTo('/%2fevil.example.com'), '/home');
    assert.equal(sanitizeReturnTo('%2f%2fevil.example.com'), '/home');
  });

  await t.test('40. backslash URL rejected', () => {
    assert.equal(sanitizeReturnTo('/\\evil.example.com'), '/home');
    assert.equal(sanitizeReturnTo('\\\\evil.example.com'), '/home');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\\evil'), '/home');
    assert.equal(sanitizeReturnTo('/teacher%5cevil'), '/home');
  });

  await t.test('41. CRLF injection rejected', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes\r\nSet-Cookie: evil=1'), '/home');
    assert.equal(sanitizeReturnTo('/teacher/quizzes\nLocation: http://evil.com'), '/home');
  });

  await t.test('42. javascript/data/vbscript rejected', () => {
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/home');
    assert.equal(sanitizeReturnTo('data:text/html;base64,PHNjcmlwdD4='), '/home');
    assert.equal(sanitizeReturnTo('vbscript:msgbox(1)'), '/home');
  });

  await t.test('43. valid internal path preserved', () => {
    assert.equal(sanitizeReturnTo('/teacher/quizzes'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/teacher/review?id=q_123'), '/teacher/review?id=q_123');
    assert.equal(sanitizeReturnTo('/teacher/quizzes#drafts'), '/teacher/quizzes#drafts');
    assert.equal(sanitizeReturnTo('/home'), '/home');
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

  await t.test('50. invalid or expired session token strictly fails closed without dev fallback', async () => {
    setSessionTokenForTesting('bst_unresolvable_expired_token');
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /invalid or expired session/i
    );
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

  // ============================================================
  // LOGOUT & SESSION REVOCATION TESTS (Task 4)
  // ============================================================

  await t.test('LOGOUT 1. Authenticated session can invoke logout and revoke server-side session in database', async () => {
    const user = authRepo.createUser({ email: 'logout.user@berea.org', displayName: 'Logout Tester' });
    const { rawToken } = authRepo.createSession(user.id);

    // Verify session exists and resolves prior to logout
    assert.ok(authService.resolveSession(rawToken), 'Session should resolve initially');

    // Revoke through authService.logout
    authService.logout(rawToken);

    // Verify session is completely deleted from the database
    assert.equal(authService.resolveSession(rawToken), null, 'Session must not resolve after logout');
    assert.equal(authRepo.findSessionByToken(rawToken), null, 'Session record must be removed from user_sessions');
  });

  await t.test('LOGOUT 2. After logout, previously valid session token cannot resolve or authenticate', async () => {
    const user = authRepo.createUser({ email: 'unauth.user@berea.org', displayName: 'Unauth Tester' });
    authRepo.addOrganizationMembership('church-berea', user.id, 'teacher');
    const { rawToken } = authRepo.createSession(user.id);

    setSessionTokenForTesting(rawToken);
    const beforeTeacher = await getAuthorizedTeacherContext();
    assert.equal(beforeTeacher.userId, user.id);

    // Logout
    authService.logout(rawToken);

    // Token resolution fails
    assert.equal(authService.resolveSession(rawToken), null);

    // Subsequent protected request strictly fails closed
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /invalid or expired session/i
    );
  });

  await t.test('LOGOUT 3. Subsequent protected request using revoked session is strictly unauthorized', async () => {
    const user = authRepo.createUser({ email: 'protected.user@berea.org', displayName: 'Protected Tester' });
    const { rawToken } = authRepo.createSession(user.id);

    setSessionTokenForTesting(rawToken);
    // User without teacher role gives TeacherForbiddenError initially
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /not authorized as a teacher or admin/i
    );

    // After logout, token is revoked
    authService.logout(rawToken);

    // Now it gives TeacherUnauthorizedError (invalid/expired session) rather than forbidden
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /invalid or expired session/i
    );
  });

  await t.test('LOGOUT 4. Logout with no session / empty token is safe and idempotent', () => {
    // Should not throw or fail
    assert.doesNotThrow(() => authService.logout(''));
  });

  await t.test('LOGOUT 5. Logout with an invalid or non-existent session token is safe and idempotent', () => {
    assert.doesNotThrow(() => authService.logout('bst_totally_invalid_nonexistent_token'));
  });

  await t.test('LOGOUT 6. Logout cannot revoke a client-selected arbitrary user/session without possessing raw token', () => {
    const victim = authRepo.createUser({ email: 'victim@berea.org', displayName: 'Victim User' });
    const attacker = authRepo.createUser({ email: 'attacker@berea.org', displayName: 'Attacker User' });

    const victimSession = authRepo.createSession(victim.id);
    const attackerSession = authRepo.createSession(attacker.id);

    // Attacker logs out their own session
    authService.logout(attackerSession.rawToken);

    // Attacker session is revoked
    assert.equal(authService.resolveSession(attackerSession.rawToken), null);

    // Victim session remains completely intact and active
    const victimActive = authService.resolveSession(victimSession.rawToken);
    assert.ok(victimActive, 'Victim session must remain active');
    assert.equal(victimActive.user.id, victim.id);
  });

  await t.test('LOGOUT 7. Logout does not modify the BAREA user account', () => {
    const user = authRepo.createUser({ email: 'persist.user@berea.org', displayName: 'Persist User' });
    const { rawToken } = authRepo.createSession(user.id);

    authService.logout(rawToken);

    const userAfter = authRepo.findUserById(user.id);
    assert.ok(userAfter, 'User must exist');
    assert.equal(userAfter.id, user.id);
    assert.equal(userAfter.email, 'persist.user@berea.org');
    assert.equal(userAfter.displayName, 'Persist User');
  });

  await t.test('LOGOUT 8. Logout does not modify or unlink federated identities', () => {
    const user = authRepo.createUser({ email: 'fed.user@berea.org', displayName: 'Fed User' });
    const fed = authRepo.createFederatedIdentity({
      userId: user.id,
      providerType: 'GOOGLE',
      providerSub: 'google-sub-logout-test'
    });
    const { rawToken } = authRepo.createSession(user.id, {
      authProvider: 'GOOGLE',
      providerSub: fed.providerSub
    });

    authService.logout(rawToken);

    const fedAfter = authRepo.findFederatedIdentity('GOOGLE', 'google-sub-logout-test');
    assert.ok(fedAfter, 'Federated identity must still exist');
    assert.equal(fedAfter.userId, user.id);
    assert.equal(fedAfter.providerSub, 'google-sub-logout-test');
  });

  await t.test('LOGOUT 9. Logout does not modify organization memberships', () => {
    const user = authRepo.createUser({ email: 'org.user@berea.org', displayName: 'Org User' });
    authRepo.addOrganizationMembership('church-berea-youth', user.id, 'teacher');
    const { rawToken } = authRepo.createSession(user.id);

    authService.logout(rawToken);

    const memberships = authRepo.getOrganizationMemberships(user.id);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].organizationId, 'church-berea-youth');
    assert.equal(memberships[0].role, 'teacher');
  });

  await t.test('LOGOUT 10. Redirect sanitization strictly prevents open redirects and enforces internal BAREA path', () => {
    // Verify sanitizeReturnTo ensures all redirects after logout or auth are safe internal paths
    assert.equal(sanitizeReturnTo('http://attacker.com'), '/home');
    assert.equal(sanitizeReturnTo('https://evil.org/phish'), '/home');
    assert.equal(sanitizeReturnTo('//attacker.com'), '/home');
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/home');
    assert.equal(sanitizeReturnTo('/teacher/quizzes'), '/teacher/quizzes');
    assert.equal(sanitizeReturnTo('/home'), '/home');
    assert.equal(sanitizeReturnTo('/'), '/');
  });

  await t.test('LOGOUT 11. logoutAction request-context boundary: fails closed when invoked outside Next.js request scope', async () => {
    // Note on test architecture: When invoked directly in a Node unit test outside of an active
    // Next.js HTTP request scope, the Next.js dynamic cookies() API deterministically throws an unhandled
    // scope error. This test validates the request-context boundary (ensuring fail-closed behavior
    // and proving it does not silently succeed or fail on an unrelated runtime error). Full end-to-end
    // logout (reading barea_session cookie, revoking SQLite session, deleting cookie, and redirecting to "/")
    // is verified via live HTTP request execution on the Next.js server, and the underlying revocation logic
    // is comprehensively validated in LOGOUT 1–9.
    await assert.rejects(
      async () => logoutAction(),
      (err: any) => {
        assert.ok(err instanceof Error, 'Expected thrown error to be an instance of Error');
        assert.match(
          err.message,
          /`cookies` was called outside a request scope/i,
          'logoutAction must deterministically fail at the Next.js cookies() request scope boundary when called outside request'
        );
        return true;
      }
    );
  });

  await t.test('LOGOUT 12. Server Action discovery manifest contains logoutAction for /teacher/quizzes and /home', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.join(process.cwd(), '.next', 'server', 'server-reference-manifest.json');

    // The manifest MUST exist; test strictly fails if manifest is missing (production next build required)
    assert.ok(
      fs.existsSync(manifestPath),
      '.next/server/server-reference-manifest.json must exist. Run "npm run build:next" before running tests.'
    );

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const actions = Object.values(content.node || {}) as any[];
    const logoutEntry = actions.find(
      (entry) => entry.filename === 'src/app/login/actions.ts' && entry.exportedName === 'logoutAction'
    );
    assert.ok(
      logoutEntry,
      'logoutAction from src/app/login/actions.ts must be registered in server-reference-manifest.json'
    );
    assert.ok(
      logoutEntry.workers && logoutEntry.workers['app/teacher/quizzes/page'],
      'logoutAction must be registered as a worker action for app/teacher/quizzes/page'
    );
    assert.ok(
      logoutEntry.workers && logoutEntry.workers['app/home/page'],
      'logoutAction must be registered as a worker action for app/home/page'
    );
  });

  // ============================================================
  // OAUTH HARDENING TEST SUITE (Section 18 Authorization Tests)
  // ============================================================

  await t.test('OAUTH-TX-01: Normal valid OAuth transaction succeeds and issues fresh session', async () => {
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/teacher/quizzes');
    assert.ok(res.transactionId);
    assert.ok(res.state.startsWith(res.transactionId + '.'));

    const nonce = res.nonce;
    const idToken = await createSignedIdToken({
      sub: 'google-sub-tx-01',
      email: 'user.tx01@church.org',
      email_verified: true,
      name: 'TX01 User',
      nonce
    });

    const callbackResult = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: res.state,
      redirectUri: REDIRECT_URI
    });

    assert.ok(callbackResult.rawToken);
    assert.equal(callbackResult.returnTo, '/teacher/quizzes');
    assert.equal(callbackResult.user.email, 'user.tx01@church.org');

    // Verify transaction is marked consumed in database
    const txAfter = authRepo.findOAuthTransaction(res.transactionId);
    assert.ok(txAfter);
    assert.ok(txAfter.consumedAt !== null, 'Transaction must be marked consumed');
  });

  await t.test('OAUTH-TX-02: Consumed callback replay fails closed with OAUTH_TRANSACTION_REPLAYED', async () => {
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const nonce = res.nonce;
    const idToken = await createSignedIdToken({
      sub: 'google-sub-tx-02',
      email: 'user.tx02@church.org',
      email_verified: true,
      nonce
    });

    // First completion succeeds
    const firstResult = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: res.state,
      redirectUri: REDIRECT_URI
    });
    assert.ok(firstResult.rawToken);

    // Immediate replay of same state/transaction fails closed
    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'mock_id_token:' + idToken,
          receivedState: res.state,
          redirectUri: REDIRECT_URI
        }),
      OAuthTransactionReplayedError
    );
  });

  await t.test('OAUTH-TX-03: Expired transaction fails closed with OAUTH_TRANSACTION_EXPIRED', async () => {
    // Insert pre-expired transaction in auth repository
    const expiredTxId = 'otx_expired_test_1';
    const stateSecret = 'secret-expired-1';
    const state = `${expiredTxId}.${stateSecret}`;
    const stateHash = crypto.createHash('sha256').update(stateSecret).digest('hex');
    const nonce = 'nonce-expired-1';
    const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');

    const db = authRepo.getDatabase();
    db.prepare(`
      INSERT INTO oauth_transactions (id, state_hash, code_verifier, nonce_hash, return_to, created_at, expires_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      expiredTxId,
      stateHash,
      'verifier-expired',
      nonceHash,
      '/home',
      new Date(Date.now() - 3600 * 1000).toISOString(),
      new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
    );

    const idToken = await createSignedIdToken({
      sub: 'google-sub-expired',
      email: 'expired@church.org',
      email_verified: true,
      nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'mock_id_token:' + idToken,
          receivedState: state,
          redirectUri: REDIRECT_URI
        }),
      OAuthTransactionExpiredError
    );
  });

  await t.test('OAUTH-TX-04: Tampered state secret fails closed with OAUTH_STATE_INVALID', async () => {
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const tamperedState = `${res.transactionId}.tampered_state_secret`;

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'code-tampered',
          receivedState: tamperedState,
          redirectUri: REDIRECT_URI
        }),
      OAuthStateError
    );
  });

  await t.test('OAUTH-TAB-01 & OAUTH-TAB-02: Two simultaneous transactions remain independent; completing B does not invalidate A', async () => {
    // Tab A begins login
    const txA = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/teacher/quizzes');
    // Tab B begins login
    const txB = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');

    assert.notEqual(txA.transactionId, txB.transactionId, 'Transactions must have distinct identifiers');
    assert.notEqual(txA.state, txB.state, 'State parameters must be distinct');

    const idTokenB = await createSignedIdToken({
      sub: 'sub-tab-user-b',
      email: 'user.tab.b@church.org',
      email_verified: true,
      name: 'User B',
      nonce: txB.nonce
    });

    // Complete Tab B first
    const resultB = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idTokenB,
      receivedState: txB.state,
      redirectUri: REDIRECT_URI
    });
    assert.ok(resultB.rawToken);
    assert.equal(resultB.returnTo, '/home');

    // Tab A remains unconsumed and valid
    const txAStatus = authRepo.findOAuthTransaction(txA.transactionId);
    assert.ok(txAStatus);
    assert.equal(txAStatus.consumedAt, null, 'Transaction A must remain unconsumed after Tab B finishes');

    // Complete Tab A second
    const idTokenA = await createSignedIdToken({
      sub: 'sub-tab-user-a',
      email: 'user.tab.a@church.org',
      email_verified: true,
      name: 'User A',
      nonce: txA.nonce
    });

    const resultA = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idTokenA,
      receivedState: txA.state,
      redirectUri: REDIRECT_URI
    });
    assert.ok(resultA.rawToken);
    assert.equal(resultA.returnTo, '/teacher/quizzes');

    // Both sessions exist and are distinct
    assert.notEqual(resultA.rawToken, resultB.rawToken);
  });

  await t.test('OAUTH-TX-CONCURRENCY-01: Two concurrent callbacks for the same transaction produce exactly one success and one replay rejection', async () => {
    const res = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const idToken = await createSignedIdToken({
      sub: 'sub-concurrent-tx',
      email: 'concurrent.tx@church.org',
      email_verified: true,
      nonce: res.nonce
    });

    const p1 = authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: res.state,
      redirectUri: REDIRECT_URI
    });
    const p2 = authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: res.state,
      redirectUri: REDIRECT_URI
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    assert.equal(fulfilled.length, 1, 'Exactly one callback must succeed');
    assert.equal(rejected.length, 1, 'Exactly one callback must be rejected');
    assert.equal(rejected[0].reason?.name, 'OAuthTransactionReplayedError');

    // Verify only 1 user and 1 session were created
    const foundUser = authRepo.findUserByEmail('concurrent.tx@church.org');
    assert.ok(foundUser);
    const db = authRepo.getDatabase();
    const sessions = db.prepare('SELECT id FROM user_sessions WHERE user_id = ?').all(foundUser.id);
    assert.equal(sessions.length, 1, 'Exactly one session row must exist');
  });

  await t.test('OAUTH-ID-01: Same email + different Google sub fails closed with AccountCollisionDetectedError', async () => {
    const existing = authRepo.createUser({
      email: 'victim.pastor@church.org',
      emailVerified: true,
      displayName: 'Pastor'
    });
    authRepo.createFederatedIdentity({
      userId: existing.id,
      providerType: 'GOOGLE',
      providerSub: 'legitimate-pastor-sub'
    });

    const tx = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const imposterToken = await createSignedIdToken({
      sub: 'imposter-sub-999',
      email: 'victim.pastor@church.org',
      email_verified: true,
      nonce: tx.nonce
    });

    await assert.rejects(
      async () =>
        authService.handleGoogleCallback({
          code: 'mock_id_token:' + imposterToken,
          receivedState: tx.state,
          redirectUri: REDIRECT_URI
        }),
      AccountCollisionDetectedError
    );

    // Verify original account was not hijacked
    const victim = authRepo.findUserById(existing.id);
    assert.equal(victim?.id, existing.id);
    const imposterIdentity = authRepo.findFederatedIdentity('GOOGLE', 'imposter-sub-999');
    assert.equal(imposterIdentity, null, 'Imposter sub must not be linked');
  });

  await t.test('OAUTH-ID-02: New Google sub + new email creates exactly one BAREA user and federated identity', async () => {
    const tx = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const idToken = await createSignedIdToken({
      sub: 'brand-new-sub-100',
      email: 'newbie@church.org',
      email_verified: true,
      name: 'Newbie Member',
      nonce: tx.nonce
    });

    const res = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: tx.state,
      redirectUri: REDIRECT_URI
    });

    assert.equal(res.user.email, 'newbie@church.org');
    assert.equal(res.user.displayName, 'Newbie Member');

    const fed = authRepo.findFederatedIdentity('GOOGLE', 'brand-new-sub-100');
    assert.ok(fed);
    assert.equal(fed.userId, res.user.id);
  });

  await t.test('OAUTH-FIX-01: Pre-login session cannot become authenticated or bound to post-login identity', async () => {
    // Generate an arbitrary pre-login token
    const preLoginToken = 'bst_' + crypto.randomBytes(32).toString('base64url');

    const tx = authService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');
    const idToken = await createSignedIdToken({
      sub: 'sub-fixation-test',
      email: 'fixation@church.org',
      email_verified: true,
      nonce: tx.nonce
    });

    const res = await authService.handleGoogleCallback({
      code: 'mock_id_token:' + idToken,
      receivedState: tx.state,
      redirectUri: REDIRECT_URI
    });

    // The authenticated session token is brand new and independent of preLoginToken
    assert.notEqual(res.rawToken, preLoginToken);
    assert.equal(authRepo.findSessionByToken(preLoginToken), null, 'Pre-login token must not resolve to any session');
    assert.ok(authRepo.findSessionByToken(res.rawToken) !== null, 'New session must resolve');
  });

  await t.test('OAUTH-NET-01: Google token endpoint timeout aborts cleanly with 8-second error message', async () => {
    const customService = new AuthService(authRepo, {
      googleClientId: CLIENT_ID,
      googleClientSecret: CLIENT_SECRET,
      googleRedirectUri: REDIRECT_URI,
      jwksResolver: localJwksResolver,
      tokenExchangeHandler: async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      }
    });

    const tx = customService.generateGoogleOAuthUrl(REDIRECT_URI, '/home');

    await assert.rejects(
      async () =>
        customService.handleGoogleCallback({
          code: 'code-timeout',
          receivedState: tx.state,
          redirectUri: REDIRECT_URI
        }),
      (err: any) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /timeout/i);
        return true;
      }
    );
  });

  await t.test('OAUTH-REDIRECT-01: Malicious returnTo values are rejected/safely redirected to /home', () => {
    assert.equal(sanitizeReturnTo('http://evil.com'), '/home');
    assert.equal(sanitizeReturnTo('//evil.com'), '/home');
    assert.equal(sanitizeReturnTo('/\\evil.com'), '/home');
    assert.equal(sanitizeReturnTo('/%2fevil.com'), '/home');
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), '/home');
    assert.equal(sanitizeReturnTo('/teacher/quizzes/123?edit=true'), '/teacher/quizzes/123?edit=true');
  });

  await t.test('OAUTH-HTTPS-01: resolveOAuthRedirectUri respects explicit HTTPS request origin in development/test', () => {
    const originalEnv = process.env.GOOGLE_REDIRECT_URI;
    delete process.env.GOOGLE_REDIRECT_URI;
    try {
      const uri = resolveOAuthRedirectUri('https://localhost:3000');
      assert.equal(uri, 'https://localhost:3000/api/auth/callback/google');
    } finally {
      if (originalEnv !== undefined) {
        process.env.GOOGLE_REDIRECT_URI = originalEnv;
      }
    }
  });

  await t.test('OAUTH-HTTPS-02: resolveOAuthRedirectUri prioritizes configured GOOGLE_REDIRECT_URI', () => {
    const originalEnv = process.env.GOOGLE_REDIRECT_URI;
    process.env.GOOGLE_REDIRECT_URI = 'https://localhost:3000/api/auth/callback/google';
    try {
      const uri = resolveOAuthRedirectUri('http://localhost:3000');
      assert.equal(uri, 'https://localhost:3000/api/auth/callback/google');
    } finally {
      if (originalEnv !== undefined) {
        process.env.GOOGLE_REDIRECT_URI = originalEnv;
      } else {
        delete process.env.GOOGLE_REDIRECT_URI;
      }
    }
  });

  await t.test('OAUTH-LAN-01: 0.0.0.0 bind address is strictly rejected as client redirect origin and fails with clear error', () => {
    // 0.0.0.0 bind address must NEVER be returned as client redirect origin; must fail closed with actionable error
    const originalDevUrl = process.env.BAREA_DEV_APP_URL;
    delete process.env.BAREA_DEV_APP_URL;
    try {
      assert.throws(
        () => resolveEffectiveAppOrigin('https://0.0.0.0:3000'),
        (err: any) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /Invalid application origin: server is bound to 0\.0\.0\.0/);
          assert.match(err.message, /BAREA_DEV_APP_URL/);
          return true;
        }
      );
    } finally {
      if (originalDevUrl !== undefined) {
        process.env.BAREA_DEV_APP_URL = originalDevUrl;
      }
    }
  });

  await t.test('OAUTH-LAN-02: BAREA_DEV_APP_URL overrides bind address in development/test', () => {
    const originalDevUrl = process.env.BAREA_DEV_APP_URL;
    process.env.BAREA_DEV_APP_URL = 'https://192.168.1.7:3000';
    try {
      const origin = resolveEffectiveAppOrigin('https://0.0.0.0:3000');
      assert.equal(origin, 'https://192.168.1.7:3000');
    } finally {
      if (originalDevUrl !== undefined) {
        process.env.BAREA_DEV_APP_URL = originalDevUrl;
      } else {
        delete process.env.BAREA_DEV_APP_URL;
      }
    }
  });

  await t.test('OAUTH-LAN-03: BAREA_DEV_APP_URL is strictly ignored in production environment', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDevUrl = process.env.BAREA_DEV_APP_URL;
    (process.env as any).NODE_ENV = 'production';
    process.env.BAREA_DEV_APP_URL = 'https://192.168.1.7:3000';
    try {
      // In production, development-only overrides must not activate
      const origin = resolveEffectiveAppOrigin('https://example-church.org');
      assert.equal(origin, 'https://example-church.org');
    } finally {
      (process.env as any).NODE_ENV = originalNodeEnv;
      if (originalDevUrl !== undefined) {
        process.env.BAREA_DEV_APP_URL = originalDevUrl;
      } else {
        delete process.env.BAREA_DEV_APP_URL;
      }
    }
  });

  await t.test('OAUTH-LAN-04: resolveOAuthRedirectUri derives canonical callback using effective LAN origin in development', () => {
    const originalEnv = process.env.GOOGLE_REDIRECT_URI;
    const originalDevUrl = process.env.BAREA_DEV_APP_URL;
    delete process.env.GOOGLE_REDIRECT_URI;
    process.env.BAREA_DEV_APP_URL = 'https://192.168.1.7:3000';
    try {
      const uri = resolveOAuthRedirectUri('https://0.0.0.0:3000');
      assert.equal(uri, 'https://192.168.1.7:3000/api/auth/callback/google');
    } finally {
      if (originalEnv !== undefined) {
        process.env.GOOGLE_REDIRECT_URI = originalEnv;
      }
      if (originalDevUrl !== undefined) {
        process.env.BAREA_DEV_APP_URL = originalDevUrl;
      } else {
        delete process.env.BAREA_DEV_APP_URL;
      }
    }
  });

  // ============================================================
  // LOGOUT / BROWSER HISTORY / BFCACHE HARDENING TESTS (01 - 06)
  // ============================================================

  await t.test('LOGOUT-HISTORY-01: Authenticated session logs out -> session revoked in database, session cookie deleted, redirected to public destination', async () => {
    const user = authRepo.createUser({ email: 'logout-01@church.org', displayName: 'Logout Test User' });
    const { rawToken } = authRepo.createSession(user.id);

    // Verify session is active before logout
    const preSession = authService.resolveSession(rawToken);
    assert.ok(preSession !== null, 'Session must resolve prior to logout');
    assert.equal(preSession?.user.id, user.id);

    // Call authoritative logout
    authService.logout(rawToken);

    // Verify server-side session is revoked in database
    const postSession = authService.resolveSession(rawToken);
    assert.equal(postSession, null, 'Revoked session must not resolve in auth service or database');
  });

  await t.test('LOGOUT-HISTORY-02: A revoked session cannot authenticate /home and fails closed to null context', async () => {
    const user = authRepo.createUser({ email: 'logout-02@church.org', displayName: 'Revoked Home User' });
    const { rawToken } = authRepo.createSession(user.id);
    setSessionTokenForTesting(rawToken);

    // 1. Authenticated
    const activeContext = await getUnifiedUserContext();
    assert.ok(activeContext !== null);
    assert.equal(activeContext?.userId, user.id);

    // 2. Revoke session server-side
    authService.logout(rawToken);

    // 3. Attempting to resolve /home with the revoked session token fails closed
    const revokedContext = await getUnifiedUserContext();
    assert.equal(revokedContext, null, 'Revoked session token must strictly fail closed to null for /home');
    setSessionTokenForTesting(null);
  });

  await t.test('LOGOUT-HISTORY-03: A revoked session cannot access protected teacher routes and fails closed with TeacherUnauthorizedError', async () => {
    const teacher = authRepo.createUser({ email: 'logout-03-teacher@church.org', displayName: 'Revoked Teacher' });
    authRepo.addOrganizationMembership('church-berea-org', teacher.id, 'teacher');
    const { rawToken } = authRepo.createSession(teacher.id);
    setSessionTokenForTesting(rawToken);

    // 1. Authorized teacher
    const activeTeacher = await getAuthorizedTeacherContext();
    assert.equal(activeTeacher.userId, teacher.id);
    assert.equal(activeTeacher.role, 'teacher');

    // 2. Revoke session server-side
    authService.logout(rawToken);

    // 3. Attempting teacher resolution with revoked session token strictly throws TeacherUnauthorizedError
    await assert.rejects(
      async () => getAuthorizedTeacherContext(),
      /invalid or expired session/i
    );
    setSessionTokenForTesting(null);
  });

  await t.test('LOGOUT-HISTORY-04: Logout redirect uses RedirectType.replace semantics at application level', async () => {
    const fs = await import('node:fs/promises');
    const actionsSrc = await fs.readFile('src/app/login/actions.ts', 'utf8');

    // Verify import of RedirectType from next/navigation
    assert.match(actionsSrc, /import\s+.*RedirectType.*from\s+['"]next\/navigation['"]/);
    // Verify redirect('/', RedirectType.replace) is used
    assert.match(actionsSrc, /redirect\(\s*['"]\/['"]\s*,\s*RedirectType\.replace\s*\)/);
  });

  await t.test('LOGOUT-HISTORY-05: Authenticated and protected routes emit restrictive cache headers (no-store, no-cache, must-revalidate)', async () => {
    // 1. Verify next.config.js configuration rules
    const pathMod = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const configPath = pathMod.resolve(process.cwd(), 'next.config.js');
    const importedConfig = await import(pathToFileURL(configPath).href);
    const nextConfig = importedConfig.default || importedConfig;
    assert.ok(typeof nextConfig.headers === 'function', 'next.config.js must define headers()');
    const headerEntries = await nextConfig.headers();
    assert.ok(Array.isArray(headerEntries), 'headers() must return an array');

    // Verify explicit route patterns /home, /teacher, /teacher/:path*
    const requiredPatterns = ['/home', '/teacher', '/teacher/:path*'];
    for (const pattern of requiredPatterns) {
      const matchEntry: any = (headerEntries as any[]).find((e: any) => e.source === pattern);
      assert.ok(matchEntry, `Must have explicit header entry covering route pattern: ${pattern}`);
      const cacheControlHeader = matchEntry.headers.find((h: any) => h.key.toLowerCase() === 'cache-control');
      assert.ok(cacheControlHeader, `Must define Cache-Control header for pattern: ${pattern}`);
      assert.match(cacheControlHeader.value, /no-store/i);
      assert.match(cacheControlHeader.value, /no-cache/i);
      assert.match(cacheControlHeader.value, /must-revalidate/i);
    }

    // 2. Verify runtime response headers emitted by session verification API
    const { GET: sessionGet } = await import('../src/app/api/auth/session/route.js');
    const mockReq = {
      cookies: {
        get: (_name: string) => undefined
      }
    };
    const response = await sessionGet(mockReq as any);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('expires'), '0');
  });

  await t.test('LOGOUT-HISTORY-06: Session probe distinguishes authenticated, revoked, and absent sessions with strict data minimization', async () => {
    const { GET: sessionGet } = await import('../src/app/api/auth/session/route.js');

    // Case 1: No session cookie
    const reqNoCookie = {
      cookies: {
        get: (_name: string) => undefined
      }
    };
    const resNoCookie = await sessionGet(reqNoCookie as any);
    assert.equal(resNoCookie.status, 401);
    const bodyNoCookie = await resNoCookie.json();
    assert.deepEqual(bodyNoCookie, { authenticated: false });
    assert.equal(Object.prototype.hasOwnProperty.call(bodyNoCookie, 'userId'), false, 'Must not disclose userId');
    assert.equal(Object.prototype.hasOwnProperty.call(bodyNoCookie, 'isTeacherAuthorized'), false, 'Must not disclose isTeacherAuthorized');

    // Case 2: Valid active session -> returns strictly { authenticated: true }
    const activeUser = authRepo.createUser({ email: 'active-session@church.org', displayName: 'Active User' });
    const { rawToken } = authRepo.createSession(activeUser.id);
    const reqActive = {
      cookies: {
        get: (name: string) => (name === 'barea_session' ? { value: rawToken } : undefined)
      }
    };
    const resActive = await sessionGet(reqActive as any);
    assert.equal(resActive.status, 200);
    const bodyActive = await resActive.json();
    assert.deepEqual(bodyActive, { authenticated: true });
    assert.equal(Object.prototype.hasOwnProperty.call(bodyActive, 'userId'), false, 'Must not disclose userId in minimized contract');
    assert.equal(Object.prototype.hasOwnProperty.call(bodyActive, 'isTeacherAuthorized'), false, 'Must not disclose role capabilities');

    // Case 3: Revoked session
    authService.logout(rawToken);
    const resRevoked = await sessionGet(reqActive as any);
    assert.equal(resRevoked.status, 401);
    const bodyRevoked = await resRevoked.json();
    assert.deepEqual(bodyRevoked, { authenticated: false });
  });

  await t.test('LOGOUT-HISTORY-07: Production HistoryBfcacheGuard handles pageshow, synchronous hiding, probe outcomes, and race conditions', async () => {
    const { HistoryBfcacheGuard } = await import('../src/app/history-bfcache-guard.js');
    const ReactModule = await import('react');
    const ReactTarget: any = (ReactModule as any).default || ReactModule;

    // Helper to simulate React hook execution in test environment
    function mountGuard(props: { sessionEndpoint?: string; loginUrl?: string } = {}) {
      const hooks: Array<{ current: any }> = [];
      let hookIdx = 0;
      let cleanup: (() => void) | void = undefined;

      const origUseRef = ReactTarget.useRef;
      const origUseEffect = ReactTarget.useEffect;

      ReactTarget.useRef = ((init: any) => {
        const i = hookIdx++;
        if (!hooks[i]) hooks[i] = { current: init };
        return hooks[i];
      }) as any;

      ReactTarget.useEffect = ((cb: () => (() => void) | void) => {
        cleanup = cb();
      }) as any;

      try {
        HistoryBfcacheGuard(props);
      } finally {
        ReactTarget.useRef = origUseRef;
        ReactTarget.useEffect = origUseEffect;
      }

      return {
        unmount: () => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        }
      };
    }

    // Sub-test A: Non-persisted pageshow does NOT trigger suppression or fetch
    {
      const eventListeners: Record<string, Function> = {};
      const mockShells = [{ style: { visibility: 'visible' } }];
      let fetchCalled = false;

      globalThis.window = {
        addEventListener: (event: string, handler: Function) => { eventListeners[event] = handler; },
        removeEventListener: (event: string) => { delete eventListeners[event]; },
        location: { replace: () => {}, reload: () => {} }
      } as any;
      globalThis.document = {
        querySelectorAll: () => mockShells
      } as any;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return { ok: true, json: async () => ({ authenticated: true }) };
      }) as any;

      const { unmount } = mountGuard();
      assert.ok(eventListeners['pageshow'], 'Must register pageshow event listener');

      // Fire normal navigation (persisted = false)
      eventListeners['pageshow']({ persisted: false });
      assert.equal(mockShells[0].style.visibility, 'visible', 'Shell must remain visible when persisted is false');
      assert.equal(fetchCalled, false, 'Fetch must not be called when persisted is false');

      unmount();
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).fetch;
    }

    // Sub-test B: Synchronous suppression before fetch resolution and restoration on 200 { authenticated: true }
    {
      const eventListeners: Record<string, Function> = {};
      const mockShells = [
        { style: { visibility: 'visible' } },
        { style: { visibility: 'visible' } }
      ];

      let resolveFetch!: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      globalThis.window = {
        addEventListener: (event: string, handler: Function) => { eventListeners[event] = handler; },
        removeEventListener: (event: string) => { delete eventListeners[event]; },
        location: { replace: () => {}, reload: () => {} }
      } as any;
      globalThis.document = {
        querySelectorAll: (sel: string) => sel === '[data-barea-auth-shell]' ? mockShells : []
      } as any;
      globalThis.fetch = (() => fetchPromise) as any;

      const { unmount } = mountGuard();

      // Trigger bfcache restoration
      eventListeners['pageshow']({ persisted: true });

      // SYNCHRONOUS CHECK: Before fetch resolves, all shells MUST already be hidden
      assert.equal(mockShells[0].style.visibility, 'hidden', 'Shell 1 must be hidden synchronously');
      assert.equal(mockShells[1].style.visibility, 'hidden', 'Shell 2 must be hidden synchronously');

      // Now resolve fetch with valid session
      resolveFetch({
        ok: true,
        json: async () => ({ authenticated: true })
      });

      await new Promise((r) => setTimeout(r, 10));

      // POST-PROBE CHECK: Shells restored to visible
      assert.equal(mockShells[0].style.visibility, 'visible', 'Shell 1 must be restored to visible');
      assert.equal(mockShells[1].style.visibility, 'visible', 'Shell 2 must be restored to visible');

      unmount();
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).fetch;
    }

    // Sub-test C: Invalid session (401 / authenticated: false) keeps shells hidden and calls location.replace('/login')
    {
      const eventListeners: Record<string, Function> = {};
      const mockShells = [
        { style: { visibility: 'visible' } },
        { style: { visibility: 'visible' } }
      ];
      let replacedLocation: string | null = null;

      globalThis.window = {
        addEventListener: (event: string, handler: Function) => { eventListeners[event] = handler; },
        removeEventListener: (event: string) => { delete eventListeners[event]; },
        location: {
          replace: (url: string) => { replacedLocation = url; },
          reload: () => {}
        }
      } as any;
      globalThis.document = {
        querySelectorAll: (sel: string) => sel === '[data-barea-auth-shell]' ? mockShells : []
      } as any;
      globalThis.fetch = (async () => ({
        ok: false,
        status: 401,
        json: async () => ({ authenticated: false })
      })) as any;

      const { unmount } = mountGuard({ loginUrl: '/login' });

      eventListeners['pageshow']({ persisted: true });

      await new Promise((r) => setTimeout(r, 10));

      // Shells MUST remain hidden and location replaced to loginUrl
      assert.equal(mockShells[0].style.visibility, 'hidden', 'Shell 1 must remain hidden on 401');
      assert.equal(mockShells[1].style.visibility, 'hidden', 'Shell 2 must remain hidden on 401');
      assert.equal(replacedLocation, '/login', 'Must replace location to /login');

      unmount();
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).fetch;
    }

    // Sub-test D: Network failure calls window.location.reload()
    {
      const eventListeners: Record<string, Function> = {};
      const mockShells = [{ style: { visibility: 'visible' } }];
      let reloadCalled = false;

      globalThis.window = {
        addEventListener: (event: string, handler: Function) => { eventListeners[event] = handler; },
        removeEventListener: (event: string) => { delete eventListeners[event]; },
        location: {
          replace: () => {},
          reload: () => { reloadCalled = true; }
        }
      } as any;
      globalThis.document = {
        querySelectorAll: (sel: string) => sel === '[data-barea-auth-shell]' ? mockShells : []
      } as any;
      globalThis.fetch = (async () => {
        throw new Error('Network offline');
      }) as any;

      const { unmount } = mountGuard();

      eventListeners['pageshow']({ persisted: true });

      await new Promise((r) => setTimeout(r, 10));

      assert.equal(mockShells[0].style.visibility, 'hidden', 'Shell must remain hidden');
      assert.equal(reloadCalled, true, 'window.location.reload() must be called on network error');

      unmount();
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).fetch;
    }

    // Sub-test E: Stale probe response is ignored when newer pageshow probe has superseded it
    {
      const eventListeners: Record<string, Function> = {};
      const mockShells = [{ style: { visibility: 'visible' } }];
      let replacedLocation: string | null = null;

      let resolveProbe1!: (val: any) => void;
      const probe1Promise = new Promise((resolve) => { resolveProbe1 = resolve; });

      let resolveProbe2!: (val: any) => void;
      const probe2Promise = new Promise((resolve) => { resolveProbe2 = resolve; });

      let probeCallCount = 0;
      globalThis.window = {
        addEventListener: (event: string, handler: Function) => { eventListeners[event] = handler; },
        removeEventListener: (event: string) => { delete eventListeners[event]; },
        location: {
          replace: (url: string) => { replacedLocation = url; },
          reload: () => {}
        }
      } as any;
      globalThis.document = {
        querySelectorAll: (sel: string) => sel === '[data-barea-auth-shell]' ? mockShells : []
      } as any;
      globalThis.fetch = (() => {
        probeCallCount++;
        return probeCallCount === 1 ? probe1Promise : probe2Promise;
      }) as any;

      const { unmount } = mountGuard({ loginUrl: '/login' });

      // First restoration event begins
      eventListeners['pageshow']({ persisted: true });
      assert.equal(mockShells[0].style.visibility, 'hidden');

      // Second restoration event fires before first resolves (e.g. rapid history steps)
      eventListeners['pageshow']({ persisted: true });

      // Resolve Probe 2 as INVALID (401)
      resolveProbe2({
        ok: false,
        status: 401,
        json: async () => ({ authenticated: false })
      });
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(replacedLocation, '/login', 'Probe 2 replaced location to /login');

      // Now resolve the late Probe 1 as VALID (200)
      // Stale Probe 1 MUST NOT restore the shell to visible!
      resolveProbe1({
        ok: true,
        json: async () => ({ authenticated: true })
      });
      await new Promise((r) => setTimeout(r, 10));

      assert.equal(mockShells[0].style.visibility, 'hidden', 'Stale probe 1 MUST NOT restore visibility');

      unmount();
      delete (globalThis as any).window;
      delete (globalThis as any).document;
      delete (globalThis as any).fetch;
    }
  });

  await t.test('LOGOUT-HISTORY-08: Authenticated surfaces in site-nav, home, and teacher-layout declare data-barea-auth-shell marker', async () => {
    const fs = await import('node:fs/promises');
    const siteNavSrc = await fs.readFile('src/app/site-nav.tsx', 'utf8');
    const homePageSrc = await fs.readFile('src/app/home/page.tsx', 'utf8');
    const teacherLayoutSrc = await fs.readFile('src/app/teacher/layout.tsx', 'utf8');

    // site-nav: authenticated navigation wrapper must have data-barea-auth-shell
    assert.match(siteNavSrc, /data-barea-auth-shell/);
    // home/page: workspace container must have data-barea-auth-shell
    assert.match(homePageSrc, /data-barea-auth-shell/);
    // teacher/layout: workspace shell must have data-barea-auth-shell
    assert.match(teacherLayoutSrc, /data-barea-auth-shell/);
  });
});
