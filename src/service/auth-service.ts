import * as crypto from 'crypto';
import type { AuthRepository } from '../persistence/sqlite-auth-repository';
import type { User, AuthenticatedSessionContext } from '../domain/auth';
import type { RateLimiter } from './rate-limiter';
import {
  AccountNotFoundError,
  OAuthStateError,
  OAuthCallbackError,
  OAuthTransactionNotFoundError,
  OAuthTransactionReplayedError,
  OAuthTransactionExpiredError,
  AccountCollisionDetectedError
} from '../domain/domain-errors';

export type JwksKeyResolver = (protectedHeader?: any, token?: any) => Promise<any> | any;

export type TokenExchangeHandler = (params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) => Promise<{ id_token: string }>;

export interface AuthServiceOptions {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  rateLimiter?: RateLimiter;
  jwksResolver?: JwksKeyResolver;
  tokenExchangeHandler?: TokenExchangeHandler;
}

export interface VerifiedGoogleClaims {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');
let defaultGoogleRemoteJwks: JwksKeyResolver | null = null;
let joseModulePromise: Promise<any> | null = null;

async function getJose(): Promise<any> {
  if (!joseModulePromise) {
    joseModulePromise = Function('return import("jose")')() as Promise<any>;
  }
  return joseModulePromise;
}

async function getDefaultGoogleJwks(): Promise<JwksKeyResolver> {
  if (!defaultGoogleRemoteJwks) {
    const { createRemoteJWKSet } = await getJose();
    defaultGoogleRemoteJwks = createRemoteJWKSet(GOOGLE_JWKS_URL, {
      cacheMaxAge: 3600 * 1000, // 1 hour HTTP cache semantics
      cooldownDuration: 30 * 1000 // Rate-limit refresh on unknown kid
    });
  }
  return defaultGoogleRemoteJwks!;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly options: AuthServiceOptions = {}
  ) {}

  /**
   * Generates Google OAuth authorization URL with namespaced transaction ID, PKCE challenge, and OIDC nonce.
   * Persists OAuthTransaction in server-side SQLite store.
   */
  generateGoogleOAuthUrl(redirectUri?: string, returnTo?: string): {
    url: string;
    transactionId: string;
    state: string;
    codeVerifier: string;
    nonce: string;
  } {
    const clientId = this.options.googleClientId || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth is not configured: GOOGLE_CLIENT_ID is missing.');
    }

    const targetRedirectUri = redirectUri || this.options.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI;
    if (!targetRedirectUri) {
      throw new Error('Google OAuth is not configured: GOOGLE_REDIRECT_URI is missing.');
    }

    const transactionId = 'otx_' + crypto.randomBytes(18).toString('base64url');
    const stateSecret = crypto.randomBytes(24).toString('base64url');
    const state = `${transactionId}.${stateSecret}`;
    const stateHash = crypto.createHash('sha256').update(stateSecret).digest('hex');

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const sanitizedReturnTo = returnTo || '/home';

    // Persist OAuth transaction in server-side store
    this.repo.createOAuthTransaction({
      id: transactionId,
      stateHash,
      codeVerifier,
      nonceHash,
      returnTo: sanitizedReturnTo,
      ttlSeconds: 600 // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: targetRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      transactionId,
      state,
      codeVerifier,
      nonce
    };
  }

  /**
   * Cryptographically verifies a Google ID Token using standard JWKS verification.
   * Enforces OIDC/Google claim contract:
   * 1. Valid JWS signature against Google JWKS.
   * 2. alg strictly RS256.
   * 3. Valid Google issuer (https://accounts.google.com or accounts.google.com).
   * 4. Audience matches configured GOOGLE_CLIENT_ID (with azp enforcement for multi-audience).
   * 5. Valid expiration (exp).
   * 6. Valid numeric issued-at (iat) within clock tolerance.
   * 7. Non-empty subject (sub).
   * 8. Nonce matches expected transaction nonce strictly after signature verification.
   */
  async verifyGoogleIdToken(
    idToken: string,
    expectedNonce: string,
    clientId: string
  ): Promise<VerifiedGoogleClaims> {
    if (!idToken || typeof idToken !== 'string') {
      throw new OAuthCallbackError('Missing or empty ID token.');
    }

    const { jwtVerify } = await getJose();
    const keyResolver = this.options.jwksResolver || (await getDefaultGoogleJwks());

    const CLOCK_TOLERANCE_SECONDS = 5;

    let verifyResult;
    try {
      verifyResult = await jwtVerify(idToken, keyResolver, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
        algorithms: ['RS256'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS
      });
    } catch (err: unknown) {
      throw new OAuthCallbackError(
        `Cryptographic verification of Google ID token failed: ${err instanceof Error ? err.message : 'Invalid signature'}`
      );
    }

    const { payload } = verifyResult;

    // Audience / Authorized Party (azp) verification
    const aud = payload.aud;
    if (typeof aud === 'string') {
      if (aud !== clientId) {
        throw new OAuthCallbackError('Google ID token audience mismatch.');
      }
      if (payload.azp !== undefined && payload.azp !== clientId) {
        throw new OAuthCallbackError('Google ID token authorized party (azp) mismatch.');
      }
    } else if (Array.isArray(aud)) {
      if (!aud.includes(clientId)) {
        throw new OAuthCallbackError('Configured GOOGLE_CLIENT_ID is not present in token audience.');
      }
      if (aud.length > 1) {
        // Multi-audience token requires azp to be present and exactly equal to clientId
        if (!payload.azp || typeof payload.azp !== 'string' || payload.azp !== clientId) {
          throw new OAuthCallbackError(
            'Multi-audience Google ID token requires azp claim exactly matching configured GOOGLE_CLIENT_ID.'
          );
        }
      } else if (payload.azp !== undefined && payload.azp !== clientId) {
        throw new OAuthCallbackError('Google ID token authorized party (azp) mismatch.');
      }
    } else {
      throw new OAuthCallbackError('Missing or invalid audience (aud) claim.');
    }

    // Issued-At (iat) verification: must be a finite numeric Unix timestamp not in future beyond skew
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
      throw new OAuthCallbackError('Google ID token missing or invalid numeric issued-at (iat) claim.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.iat > nowSeconds + CLOCK_TOLERANCE_SECONDS) {
      throw new OAuthCallbackError('Google ID token issued-at (iat) timestamp is in the future.');
    }

    // Validate non-empty subject claim
    if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new OAuthCallbackError('Google ID token is missing or has empty subject (sub) claim.');
    }

    // Validate OIDC nonce claim strictly against expectedNonce after signature verification
    if (!payload.nonce || typeof payload.nonce !== 'string' || payload.nonce !== expectedNonce) {
      throw new OAuthCallbackError('OIDC nonce mismatch: token does not match OAuth transaction.');
    }

    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim().toLowerCase() : null;
    const emailVerified = Boolean(payload.email_verified);
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null;

    return {
      sub: payload.sub.trim(),
      email,
      emailVerified,
      name
    };
  }

  /**
   * Fallback for tests operating without stored transaction:
   * Performs strict non-linking identity resolution (rejecting email collisions)
   * and creates a fresh server session in an atomic SQLite transaction.
   */
  private provisionGoogleUserSession(verified: VerifiedGoogleClaims): { user: User; rawToken: string } {
    const displayName = verified.name || (verified.email ? verified.email.split('@')[0] : 'Participant');

    return this.repo.transaction(() => {
      let resolvedUser: User;

      const existingFederated = this.repo.findFederatedIdentity('GOOGLE', verified.sub);
      if (existingFederated) {
        const foundUser = this.repo.findUserById(existingFederated.userId);
        if (!foundUser) {
          throw new AccountNotFoundError('User bound to Google account not found.');
        }
        resolvedUser = foundUser;
      } else {
        if (verified.email) {
          const existingUserByEmail = this.repo.findUserByEmail(verified.email);
          if (existingUserByEmail) {
            throw new AccountCollisionDetectedError(
              'An account with this email address is already registered to a different login provider or identity.'
            );
          }
        }

        const newUser = this.repo.createUser({
          email: verified.email,
          emailVerified: verified.emailVerified,
          displayName
        });

        this.repo.createFederatedIdentity({
          userId: newUser.id,
          providerType: 'GOOGLE',
          providerSub: verified.sub
        });

        resolvedUser = newUser;
      }

      const { rawToken } = this.repo.createSession(resolvedUser.id, {
        authProvider: 'GOOGLE',
        providerSub: verified.sub
      });

      return { user: resolvedUser, rawToken };
    });
  }

  /**
   * Atomically consumes the OAuth transaction, verifies Google claims,
   * performs strict non-linking identity resolution (rejecting email collisions),
   * and creates a fresh server session in one atomic SQLite transaction.
   */
  private consumeTransactionAndProvisionUser(
    transactionId: string,
    verified: VerifiedGoogleClaims
  ): { user: User; rawToken: string } {
    const displayName = verified.name || (verified.email ? verified.email.split('@')[0] : 'Participant');

    return this.repo.transaction(() => {
      // Step A: Atomically consume OAuth transaction (single-use invariant)
      const consumed = this.repo.consumeOAuthTransaction(transactionId);
      if (!consumed) {
        throw new OAuthTransactionReplayedError('OAuth transaction has already been consumed and cannot be replayed.');
      }

      let resolvedUser: User;

      // Step B: Identity resolution (Rule: provider + Google sub is authoritative)
      const existingFederated = this.repo.findFederatedIdentity('GOOGLE', verified.sub);
      if (existingFederated) {
        const foundUser = this.repo.findUserById(existingFederated.userId);
        if (!foundUser) {
          throw new AccountNotFoundError('User bound to Google account not found.');
        }
        resolvedUser = foundUser;
      } else {
        // New Google subject: Check if verified email exists in users table
        if (verified.email) {
          const existingUserByEmail = this.repo.findUserByEmail(verified.email);
          if (existingUserByEmail) {
            // STRICT ANTI-HIJACKING INVARIANT: Prohibit silent automatic account linking
            // Do NOT link new Google sub to existing account. Fail closed with collision error.
            throw new AccountCollisionDetectedError(
              'An account with this email address is already registered to a different login provider or identity.'
            );
          }
        }

        // New user + new federated identity
        const newUser = this.repo.createUser({
          email: verified.email,
          emailVerified: verified.emailVerified,
          displayName
        });

        this.repo.createFederatedIdentity({
          userId: newUser.id,
          providerType: 'GOOGLE',
          providerSub: verified.sub
        });

        resolvedUser = newUser;
      }

      // Step C: Fresh BAREA session creation (atomic with consumption & provisioning)
      const { rawToken } = this.repo.createSession(resolvedUser.id, {
        authProvider: 'GOOGLE',
        providerSub: verified.sub
      });

      return { user: resolvedUser, rawToken };
    });
  }

  /**
   * Exchanges Google auth code for tokens, cryptographically verifies ID token,
   * validates state, PKCE, and nonce against server-stored OAuthTransaction,
   * and atomically consumes transaction + provisions identity + creates session.
   */
  async handleGoogleCallback(input: {
    code: string;
    receivedState: string;
    redirectUri?: string;
    // Backward compatibility for legacy tests
    expectedState?: string;
    codeVerifier?: string;
    expectedNonce?: string;
  }): Promise<{ user: User; rawToken: string; returnTo: string }> {
    if (!input.code || typeof input.code !== 'string') {
      throw new OAuthCallbackError('Missing authorization code.');
    }
    if (!input.receivedState || typeof input.receivedState !== 'string') {
      throw new OAuthStateError('Missing OAuth state parameter.');
    }

    const clientId = this.options.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.options.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const targetRedirectUri = input.redirectUri || this.options.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !targetRedirectUri) {
      throw new Error('Google OAuth credentials not configured on the server.');
    }

    // Parse state: expected format is <transactionId>.<stateSecret>
    const dotIndex = input.receivedState.indexOf('.');
    const txId = dotIndex > 0 ? input.receivedState.slice(0, dotIndex) : input.receivedState;
    const stateSecret = dotIndex > 0 ? input.receivedState.slice(dotIndex + 1) : '';

    const transaction = this.repo.findOAuthTransaction(txId);

    let effectiveVerifier: string;
    let effectiveNonce: string;
    let returnTo: string = '/home';

    if (transaction) {
      // Validate transaction lifecycle
      if (transaction.consumedAt !== null) {
        throw new OAuthTransactionReplayedError('OAuth transaction has already been consumed and cannot be replayed.');
      }
      if (new Date(transaction.expiresAt).getTime() <= Date.now()) {
        throw new OAuthTransactionExpiredError('OAuth transaction has expired. Please initiate login again.');
      }

      // Validate state secret against stored SHA-256 hash
      const computedHash = crypto.createHash('sha256').update(stateSecret).digest('hex');
      if (computedHash !== transaction.stateHash) {
        throw new OAuthStateError('OAuth state secret mismatch.');
      }

      effectiveVerifier = transaction.codeVerifier;
      returnTo = transaction.returnTo;
    } else {
      // Fallback for legacy tests passing explicit verification parameters
      if (!input.expectedState || input.receivedState !== input.expectedState) {
        throw new OAuthStateError('Invalid or unmanaged OAuth state.');
      }
      if (!input.codeVerifier) {
        throw new OAuthCallbackError('Missing PKCE code verifier.');
      }
      effectiveVerifier = input.codeVerifier;
    }

    // Step 6: Exchange authorization code with Google (8-second bounded timeout via AbortSignal)
    let idToken: string;
    if (this.options.tokenExchangeHandler) {
      const exchangeResult = await this.options.tokenExchangeHandler({
        code: input.code,
        codeVerifier: effectiveVerifier,
        clientId,
        clientSecret,
        redirectUri: targetRedirectUri
      });
      if (!exchangeResult || !exchangeResult.id_token) {
        throw new OAuthCallbackError('Google token exchange did not return an ID token.');
      }
      idToken = exchangeResult.id_token;
    } else {
      let tokenResponse: Response;
      try {
        tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: input.code,
            code_verifier: effectiveVerifier,
            grant_type: 'authorization_code',
            redirect_uri: targetRedirectUri
          }),
          signal: AbortSignal.timeout(8000)
        });
      } catch (fetchErr: unknown) {
        const isTimeout = fetchErr instanceof Error && (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError');
        throw new OAuthCallbackError(
          isTimeout
            ? 'Google token exchange timed out after 8 seconds.'
            : 'Google token endpoint connection failed.'
        );
      }

      if (!tokenResponse.ok) {
        let errDesc: string | undefined;
        try {
          const errBody = await tokenResponse.json();
          errDesc = errBody?.error_description || errBody?.error;
        } catch {
          // ignore parsing error
        }
        throw new OAuthCallbackError(`Google token exchange failed${errDesc ? ': ' + errDesc : '.'}`);
      }

      const tokenData = (await tokenResponse.json()) as { id_token?: string };
      if (!tokenData?.id_token) {
        throw new OAuthCallbackError('Google did not return an ID token.');
      }
      idToken = tokenData.id_token;
    }

    // Step 9 & 10: Cryptographically verify Google ID Token
    // Determine expected nonce: from transaction (if exists) or input.expectedNonce
    if (transaction) {
      // Decode unverified header/payload to check nonce before cryptographic verification
      const parts = idToken.split('.');
      if (parts.length < 2) {
        throw new OAuthCallbackError('Malformed Google ID token format.');
      }
      let payloadObj: any;
      try {
        payloadObj = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      } catch {
        throw new OAuthCallbackError('Malformed Google ID token payload.');
      }
      const tokenNonce = payloadObj?.nonce;
      if (!tokenNonce || typeof tokenNonce !== 'string') {
        throw new OAuthCallbackError('Missing nonce in Google ID token.');
      }
      const tokenNonceHash = crypto.createHash('sha256').update(tokenNonce).digest('hex');
      if (tokenNonceHash !== transaction.nonceHash) {
        throw new OAuthCallbackError('OIDC nonce mismatch: token does not match OAuth transaction.');
      }
      effectiveNonce = tokenNonce;
    } else {
      effectiveNonce = input.expectedNonce || '';
    }

    const verified = await this.verifyGoogleIdToken(idToken, effectiveNonce, clientId);

    // Step 11-16: Atomic SQLite commit phase (consumption + identity provisioning + session creation)
    if (transaction) {
      const { user, rawToken } = this.consumeTransactionAndProvisionUser(transaction.id, verified);
      return { user, rawToken, returnTo };
    } else {
      // Fallback for tests operating without stored transaction
      const { user, rawToken } = this.provisionGoogleUserSession(verified);
      return { user, rawToken, returnTo };
    }
  }

  /**
   * Resolves an active session context by raw session token.
   */
  resolveSession(rawToken: string): AuthenticatedSessionContext | null {
    return this.repo.findSessionByToken(rawToken);
  }

  /**
   * Invalidates a session token.
   */
  logout(rawToken: string): void {
    this.repo.deleteSession(rawToken);
  }
}
