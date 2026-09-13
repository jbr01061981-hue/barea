import * as crypto from 'crypto';
import type { AuthRepository } from '../persistence/sqlite-auth-repository';
import type { User, AuthenticatedSessionContext } from '../domain/auth';
import {
  InvalidCredentialsError,
  AccountNotFoundError,
  OAuthStateError,
  OAuthCallbackError
} from '../domain/domain-errors';
import { hashPassword, verifyPassword } from './password-hasher';

export interface AuthServiceOptions {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly options: AuthServiceOptions = {}
  ) {}

  /**
   * Registers or updates a user with email and password.
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
    const user = this.repo.createUser({
      email,
      emailVerified: false,
      passwordHash,
      displayName: input.displayName.trim()
    });

    const { rawToken } = this.repo.createSession(user.id);
    return { user, rawToken };
  }

  /**
   * Validates credentials and returns a session rawToken.
   */
  async loginWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ user: User; rawToken: string }> {
    const email = input.email ? input.email.trim().toLowerCase() : '';
    if (!email || !input.password) {
      throw new InvalidCredentialsError();
    }

    const user = this.repo.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const { rawToken } = this.repo.createSession(user.id);
    return { user, rawToken };
  }

  /**
   * Generates Google OAuth authorization URL with state and PKCE challenge.
   */
  generateGoogleOAuthUrl(redirectUri?: string): {
    url: string;
    state: string;
    codeVerifier: string;
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
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: targetRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
      codeVerifier
    };
  }

  /**
   * Exchanges Google auth code for tokens and resolves BAREA user.
   */
  async handleGoogleCallback(input: {
    code: string;
    expectedState: string;
    receivedState: string;
    codeVerifier: string;
    redirectUri?: string;
  }): Promise<{ user: User; rawToken: string }> {
    if (!input.receivedState || input.receivedState !== input.expectedState) {
      throw new OAuthStateError();
    }
    if (!input.code || !input.codeVerifier) {
      throw new OAuthCallbackError('Missing authorization code or PKCE code verifier.');
    }

    const clientId = this.options.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.options.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const targetRedirectUri = input.redirectUri || this.options.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !targetRedirectUri) {
      throw new Error('Google OAuth credentials not configured on the server.');
    }

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
      const errorText = await tokenResponse.text();
      throw new OAuthCallbackError(`Google token exchange failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as { id_token?: string; access_token?: string };
    if (!tokenData.id_token) {
      throw new OAuthCallbackError('Google did not return an ID token.');
    }

    // Decode & verify ID token payload
    // Note: in high-security production, verify signature against Google JWKS (https://www.googleapis.com/oauth2/v3/certs)
    const idTokenParts = tokenData.id_token.split('.');
    if (idTokenParts.length !== 3) {
      throw new OAuthCallbackError('Malformed Google ID token.');
    }

    const payloadJson = Buffer.from(idTokenParts[1], 'base64url').toString('utf-8');
    const claims = JSON.parse(payloadJson) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      iss?: string;
      aud?: string;
    };

    if (!claims.sub) {
      throw new OAuthCallbackError('Google ID token is missing subject (sub) claim.');
    }
    if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
      throw new OAuthCallbackError('Invalid Google ID token issuer.');
    }
    if (claims.aud !== clientId) {
      throw new OAuthCallbackError('Google ID token audience mismatch.');
    }

    const providerSub = claims.sub;
    const email = claims.email ? claims.email.trim().toLowerCase() : null;
    const emailVerified = Boolean(claims.email_verified);
    const displayName = claims.name || (email ? email.split('@')[0] : 'Participant');

    // Resolve or provision user
    let user: User;
    const existingFederated = this.repo.findFederatedIdentity('GOOGLE', providerSub);

    if (existingFederated) {
      const foundUser = this.repo.findUserById(existingFederated.userId);
      if (!foundUser) {
        throw new AccountNotFoundError('User bound to Google account not found.');
      }
      user = foundUser;
    } else {
      // Check if user exists by verified email for safe linking
      let targetUserId: string;
      const existingUserByEmail = email && emailVerified ? this.repo.findUserByEmail(email) : null;

      if (existingUserByEmail) {
        targetUserId = existingUserByEmail.id;
        user = existingUserByEmail;
      } else {
        user = this.repo.createUser({
          email,
          emailVerified,
          displayName
        });
        targetUserId = user.id;
      }

      this.repo.createFederatedIdentity({
        userId: targetUserId,
        providerType: 'GOOGLE',
        providerSub
      });
    }

    const { rawToken } = this.repo.createSession(user.id);
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
