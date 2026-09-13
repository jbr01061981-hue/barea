'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../teacher/review/db';
import { InvalidCredentialsError } from '../../domain/domain-errors';

export interface AuthActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

import { sanitizeReturnTo } from './url-utils';

export { sanitizeReturnTo };


/**
 * Server Action: Authenticates via email/password, establishes a server session,
 * sets the secure HttpOnly session cookie, and returns safe user data.
 */
export async function loginWithPasswordAction(formData: FormData): Promise<AuthActionResult<{ userId: string; displayName: string; returnTo: string }>> {
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
    if (err instanceof InvalidCredentialsError) {
      return {
        success: false,
        error: 'Invalid email or password. Please check your credentials.'
      };
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
    return {
      success: false,
      error: message
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
