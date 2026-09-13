import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../../teacher/review/db';
import { sanitizeReturnTo, resolveOAuthRedirectUri } from '../../../../login/url-utils';

export const dynamic = 'force-dynamic';

function clearTransientOAuthCookies(response: NextResponse): void {
  const cookiePath = '/api/auth/callback';
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
  const returnToRaw = request.cookies.get('barea_oauth_return_to')?.value;
  const targetPath = sanitizeReturnTo(returnToRaw);

  // If Google sent an error (e.g. user canceled), fail generically without reflecting provider internals
  if (providerError) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'Google sign-in could not be completed. Please try again.');
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }

  const expectedState = request.cookies.get('barea_oauth_state')?.value;
  const codeVerifier = request.cookies.get('barea_oauth_verifier')?.value;
  const expectedNonce = request.cookies.get('barea_oauth_nonce')?.value;

  if (!expectedState || !codeVerifier || !expectedNonce || !receivedState || !code) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'Sign-in failed. Please try again.');
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }

  try {
    const authService = getAuthService();
    const redirectUri = resolveOAuthRedirectUri(origin);

    const { rawToken } = await authService.handleGoogleCallback({
      code,
      expectedState,
      receivedState,
      codeVerifier,
      expectedNonce,
      redirectUri
    });

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

    // Clear transient OAuth cookies matching their creation path
    clearTransientOAuthCookies(response);

    return response;
  } catch (err: unknown) {
    // Log safe error category without leaking sensitive credentials or raw tokens
    console.error('[OAuth Callback Error]:', err instanceof Error ? err.name : 'UnknownError');

    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'Google sign-in could not be completed. Please try again.');
    const response = NextResponse.redirect(loginRedirect);
    clearTransientOAuthCookies(response);
    return response;
  }
}
