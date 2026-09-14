import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../../teacher/review/db';
import { sanitizeReturnTo, resolveOAuthRedirectUri } from '../../../../login/url-utils';

export const dynamic = 'force-dynamic';

function clearTransientOAuthCookies(response: NextResponse): void {
  const cookiePath = '/api/auth/callback';
  response.cookies.delete({ name: 'barea_oauth_tx', path: cookiePath });
  // Also delete legacy transient cookies if present
  response.cookies.delete({ name: 'barea_oauth_state', path: cookiePath });
  response.cookies.delete({ name: 'barea_oauth_verifier', path: cookiePath });
  response.cookies.delete({ name: 'barea_oauth_nonce', path: cookiePath });
  response.cookies.delete({ name: 'barea_oauth_return_to', path: cookiePath });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const receivedState = searchParams.get('state');
  const providerError = searchParams.get('error');

  const origin = request.nextUrl.origin;

  // If Google sent an error (e.g. user canceled), fail generically without reflecting provider internals
  if (providerError) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'Google sign-in could not be completed. Please try again.');
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }

  if (!receivedState || !code) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'Sign-in failed. Please try again.');
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }

  try {
    const authService = getAuthService();
    const redirectUri = resolveOAuthRedirectUri(origin);

    const { rawToken, returnTo } = await authService.handleGoogleCallback({
      code,
      receivedState,
      redirectUri
    });

    const targetPath = sanitizeReturnTo(returnTo);
    const destination = new URL(targetPath, origin);
    const response = NextResponse.redirect(destination);

    // Set server-authoritative session cookie
    response.cookies.set('barea_session', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Clear transient OAuth transaction cookie
    clearTransientOAuthCookies(response);

    return response;
  } catch (err: unknown) {
    // Log safe error category without leaking sensitive credentials or raw tokens
    console.error('[OAuth Callback Error]:', err instanceof Error ? err.name : 'UnknownError');

    const loginRedirect = new URL('/login', origin);
    const userMessage =
      err instanceof Error && err.name === 'AccountCollisionDetectedError'
        ? 'An account with this email is already registered. Please sign in with your original account.'
        : 'Google sign-in could not be completed. Please try again.';

    loginRedirect.searchParams.set('error', userMessage);
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }
}
