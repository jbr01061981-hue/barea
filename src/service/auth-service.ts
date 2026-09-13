import * as crypto from 'crypto';
import type { AuthRepository } from '../persistence/sqlite-auth-repository';
import type { User, AuthenticatedSessionContext } from '../domain/auth';
import type { RateLimiter } from './rate-limiter';
import {
  InvalidCredentialsError,
  AccountNotFoundError,
  OAuthStateError,
  OAuthCallbackError
} from '../domain/domain-errors';
import { hashPassword, verifyPassword } from './password-hasher';

export type JwksKeyResolver = (protectedHeader?: any, token?: any) => Promise<any> | any;

export interface AuthServiceOptions {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  rateLimiter?: RateLimiter;
  jwksResolver?: JwksKeyResolver;
}

// Pre-computed valid scrypt hash used for constant-time evaluation on missing accounts
const DUMMY_SCRYPT_HASH =
  'scrypt$16384$8$1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
   * Registers a user with email and password and creates an initial session atomically.
   */
  async registerWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: User; rawToken: string }> {
    const email = input.email ? input.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required.');
    }
    if (!input.password || input.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!input.displayName || !input.displayName.trim()) {
      throw new Error('Display name is required.');
    }

    const existing = this.repo.findUserByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const passwordHash = await hashPassword(input.password);

    // Atomically create user and initial session inside a transaction boundary
    const { user, rawToken } = this.repo.transaction(() => {
      const user = this.repo.createUser({
        email,
        emailVerified: false,
        passwordHash,
        displayName: input.displayName.trim()
      });

      const { rawToken } = this.repo.createSession(user.id, {
        authProvider: 'LOCAL_PASSWORD',
        providerSub: user.id
      });

      return { user, rawToken };
    });

    return { user, rawToken };
  }

  /**
   * Validates credentials, checks brute-force rate limits, and returns a session rawToken.
   * Responds generically to nonexistent accounts, missing passwords, or wrong passwords.
   */
  async loginWithPassword(input: {
    email: string;
    password: string;
    clientIp?: string | null;
  }): Promise<{ user: User; rawToken: string }> {
    const email = input.email ? input.email.trim().toLowerCase() : '';
    if (!email || !input.password) {
      throw new InvalidCredentialsError();
    }

    // Rate limiting: prevent rapid guessing against the account
    if (this.options.rateLimiter) {
      this.options.rateLimiter.checkLoginAttempt(email, input.clientIp);
    }

    const credentials = this.repo.findUserCredentialsByEmail(email);
    if (!credentials || !credentials.passwordHash) {
      // Execute dummy verification to preserve constant-time characteristics against user enumeration
      await verifyPassword(input.password, DUMMY_SCRYPT_HASH);
      if (this.options.rateLimiter) {
        this.options.rateLimiter.recordFailedLogin(email, input.clientIp);
      }
      throw new InvalidCredentialsError();
    }

    const isValid = await verifyPassword(input.password, credentials.passwordHash);
    if (!isValid) {
      if (this.options.rateLimiter) {
        this.options.rateLimiter.recordFailedLogin(email, input.clientIp);
      }
      throw new InvalidCredentialsError();
    }

    // Reset rate limiter on successful login
    if (this.options.rateLimiter) {
      this.options.rateLimiter.resetLoginAttempts(email);
    }

    const { rawToken } = this.repo.createSession(credentials.user.id, {
      authProvider: 'LOCAL_PASSWORD',
      providerSub: credentials.user.id
    });
    return { user: credentials.user, rawToken };
  }

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
   * Rejects unsigned or incorrectly signed tokens, verifies JWS kid against JWKS,
   * enforces RS256 algorithm restriction, validates issuer, audience, expiration,
   * non-empty subject, and nonce.
   */
  async verifyGoogleIdToken(
    idToken: string,
    expectedNonce: string,
    clientId: string
  ): Promise<{
    sub: string;
    email: string | null;
    emailVerified: boolean;
    name: string | null;
  }> {
    if (!idToken || typeof idToken !== 'string') {
      throw new OAuthCallbackError('Missing or empty ID token.');
    }

    const { jwtVerify } = await getJose();
    const keyResolver = this.options.jwksResolver || (await getDefaultGoogleJwks());

    let verifyResult;
    try {
      verifyResult = await jwtVerify(idToken, keyResolver, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
        algorithms: ['RS256'],
        clockTolerance: 5
      });
    } catch (err: unknown) {
      throw new OAuthCallbackError(
        `Cryptographic verification of Google ID token failed: ${err instanceof Error ? err.message : 'Invalid signature'}`
      );
    }

    const { payload } = verifyResult;

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
   * Exchanges Google auth code for tokens, cryptographically verifies ID token,
   * validates state, PKCE, and nonce, and resolves or links BAREA user atomically
   * together with session creation inside a single transaction.
   */
  async handleGoogleCallback(input: {
    code: string;
    expectedState: string;
    receivedState: string;
    codeVerifier: string;
    expectedNonce: string;
    redirectUri?: string;
    idTokenForTesting?: string;
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
    if (input.idTokenForTesting) {
      idToken = input.idTokenForTesting;
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
      if (!tokenData.id_token) {
        throw new OAuthCallbackError('Google did not return an ID token.');
      }
      idToken = tokenData.id_token;
    }

    // Cryptographically verify ID token
    const verified = await this.verifyGoogleIdToken(idToken, input.expectedNonce, clientId);

    // Presentation display name fallback
    const displayName = verified.name || (verified.email ? verified.email.split('@')[0] : 'Participant');

    // Atomic account linking / provisioning AND session creation within repository transaction
    const { user, rawToken } = this.repo.transaction(() => {
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

    return { user, rawToken };
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
