'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../teacher/review/db';
import { InvalidCredentialsError, RateLimitExceededError } from '../../domain/domain-errors';
import { sanitizeReturnTo } from './url-utils';

export interface AuthActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}


/**
 * Server Action: Authenticates via email/password, establishes a server session,
 * sets the secure HttpOnly session cookie, and returns safe user data.
 */
export async function loginWithPasswordAction(
  formData: FormData
): Promise<AuthActionResult<{ userId: string; displayName: string; returnTo: string }>> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const returnToParam = formData.get('returnTo') as string | null;
  const targetPath = sanitizeReturnTo(returnToParam);

  if (!email || !password) {
    return {
      success: false,
      error: 'Please provide both email and password.'
    };
  }

  try {
    const authService = getAuthService();
    const { user, rawToken } = await authService.loginWithPassword({
      email,
      password
    });

    // Set secure server-authoritative cookie
    const cookieStore = await cookies();
    cookieStore.set('barea_session', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return {
      success: true,
      data: {
        userId: user.id,
        displayName: user.displayName,
        returnTo: targetPath
      }
    };
  } catch (err: unknown) {
    if (err instanceof RateLimitExceededError) {
      return {
        success: false,
        error: `Too many failed login attempts. Please wait ${err.retryAfter} seconds before trying again.`
      };
    }
    if (err instanceof InvalidCredentialsError) {
      return {
        success: false,
        error: 'Invalid email or password. Please check your credentials.'
      };
    }
    // Generic error boundary: never leak database, SQLite, or stack trace internals
    console.error('[Login Error]:', err instanceof Error ? err.name : 'UnknownError');
    return {
      success: false,
      error: 'Sign-in failed. Please try again.'
    };
  }
}

/**
 * Server Action: Logs out the current user by revoking the session in the database
 * and clearing the barea_session cookie.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('barea_session');
  if (sessionCookie?.value) {
    const authService = getAuthService();
    authService.logout(sessionCookie.value);
  }

  cookieStore.delete('barea_session');
  redirect('/');
}
