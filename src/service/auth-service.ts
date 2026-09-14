import * as crypto from 'crypto';
import type { AuthRepository } from '../persistence/sqlite-auth-repository';
import type { User, AuthenticatedSessionContext } from '../domain/auth';
import type { RateLimiter } from './rate-limiter';
import {
  AccountNotFoundError,
  OAuthStateError,
  OAuthCallbackError
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
   * Generates Google OAuth authorization URL with state, PKCE challenge, and OIDC nonce.
   */
  generateGoogleOAuthUrl(redirectUri?: string): {
    url: string;
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

    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

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
   * Atomically provisions or links a BAREA user from verified Google claims
   * and creates a server session bound to (GOOGLE, verified.sub).
   * Note: Private internal method. Only invoked following successful cryptographic verification
   * within handleGoogleCallback. Untrusted caller claims cannot bypass verification.
   */
  private provisionGoogleUserSession(verified: VerifiedGoogleClaims): { user: User; rawToken: string } {
    const displayName = verified.name || (verified.email ? verified.email.split('@')[0] : 'Participant');

    // Atomic account linking / provisioning AND session creation within repository transaction
    return this.repo.transaction(() => {
      let resolvedUser: User;

      // Rule A: Check if (GOOGLE, sub) already exists
      const existingFederated = this.repo.findFederatedIdentity('GOOGLE', verified.sub);
      if (existingFederated) {
        const foundUser = this.repo.findUserById(existingFederated.userId);
        if (!foundUser) {
          throw new AccountNotFoundError('User bound to Google account not found.');
        }
        resolvedUser = foundUser;
      } else if (verified.email && verified.emailVerified) {
        // Rule B: New Google identity + existing BAREA email
        const existingUserByEmail = this.repo.findUserByEmail(verified.email);
        if (existingUserByEmail) {
          // Safe linking: provider cryptographically verified email ownership
          this.repo.createFederatedIdentity({
            userId: existingUserByEmail.id,
            providerType: 'GOOGLE',
            providerSub: verified.sub
          });
          resolvedUser = existingUserByEmail;
        } else {
          // Create new BAREA user with verified email
          const newUser = this.repo.createUser({
            email: verified.email,
            emailVerified: true,
            displayName
          });
          this.repo.createFederatedIdentity({
            userId: newUser.id,
            providerType: 'GOOGLE',
            providerSub: verified.sub
          });
          resolvedUser = newUser;
        }
      } else {
        // Google email is unverified or missing
        if (verified.email) {
          const existingUserByEmail = this.repo.findUserByEmail(verified.email);
          if (existingUserByEmail) {
            // Strictly reject linking unverified provider email to an existing account
            throw new OAuthCallbackError('Cannot link unverified Google email to an existing account.');
          }
        }

        // Create separate account without email linking
        const newUser = this.repo.createUser({
          email: null,
          emailVerified: false,
          displayName
        });
        this.repo.createFederatedIdentity({
          userId: newUser.id,
          providerType: 'GOOGLE',
          providerSub: verified.sub
        });
        resolvedUser = newUser;
      }

      // Session creation is atomic with identity provisioning
      const { rawToken } = this.repo.createSession(resolvedUser.id, {
        authProvider: 'GOOGLE',
        providerSub: verified.sub
      });

      return { user: resolvedUser, rawToken };
    });
  }

  /**
   * Exchanges Google auth code for tokens, cryptographically verifies ID token,
   * validates state, PKCE, and nonce, and resolves or links BAREA user atomically
   * together with session creation inside a single transaction.
   *
   * SECURITY NOTICE:
   * The production authentication path obtains the ID token strictly from the
   * authorization code token exchange. No caller-controlled ID-token parameter exists.
   */
  async handleGoogleCallback(input: {
    code: string;
    expectedState: string;
    receivedState: string;
    codeVerifier: string;
    expectedNonce: string;
    redirectUri?: string;
  }): Promise<{ user: User; rawToken: string }> {
    if (!input.receivedState || input.receivedState !== input.expectedState) {
      throw new OAuthStateError();
    }
    if (!input.code || !input.codeVerifier) {
      throw new OAuthCallbackError('Missing authorization code or PKCE code verifier.');
    }
    if (!input.expectedNonce) {
      throw new OAuthCallbackError('Missing expected OIDC nonce.');
    }

    const clientId = this.options.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.options.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const targetRedirectUri = input.redirectUri || this.options.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !targetRedirectUri) {
      throw new Error('Google OAuth credentials not configured on the server.');
    }

    let idToken: string;
    if (this.options.tokenExchangeHandler) {
      const exchangeResult = await this.options.tokenExchangeHandler({
        code: input.code,
        codeVerifier: input.codeVerifier,
        clientId,
        clientSecret,
        redirectUri: targetRedirectUri
      });
      if (!exchangeResult || !exchangeResult.id_token) {
        throw new OAuthCallbackError('Google token exchange did not return an ID token.');
      }
      idToken = exchangeResult.id_token;
    } else {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: input.code,
          code_verifier: input.codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: targetRedirectUri
        })
      });

      if (!tokenResponse.ok) {
        throw new OAuthCallbackError('Google token exchange failed.');
      }

      const tokenData = (await tokenResponse.json()) as { id_token?: string };
      if (!tokenData?.id_token) {
        throw new OAuthCallbackError('Google did not return an ID token.');
      }
      idToken = tokenData.id_token;
    }

    // Cryptographically verify ID token
    const verified = await this.verifyGoogleIdToken(idToken, input.expectedNonce, clientId);

    // Atomically provision user and session from verified claims
    return this.provisionGoogleUserSession(verified);
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
