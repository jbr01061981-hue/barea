import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../teacher/review/db';
import { sanitizeReturnTo, resolveOAuthRedirectUri } from '../../../login/url-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authService = getAuthService();
    const returnToParam = request.nextUrl.searchParams.get('returnTo');
    const returnTo = sanitizeReturnTo(returnToParam);

    // Canonical redirect URI
    const redirectUri = resolveOAuthRedirectUri(request.nextUrl.origin);

    const { url, state, codeVerifier, nonce } = authService.generateGoogleOAuthUrl(redirectUri);

    const response = NextResponse.redirect(url);

    // Store state, codeVerifier, nonce, and returnTo in HttpOnly, SameSite=Lax cookies restricted to callback path
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth/callback',
      maxAge: 60 * 10 // 10 minutes
    };

    response.cookies.set('barea_oauth_state', state, cookieOptions);
    response.cookies.set('barea_oauth_verifier', codeVerifier, cookieOptions);
    response.cookies.set('barea_oauth_nonce', nonce, cookieOptions);
    response.cookies.set('barea_oauth_return_to', returnTo, cookieOptions);

    return response;
  } catch (err: unknown) {
    console.error('[OAuth Initiation Error]:', err instanceof Error ? err.name : 'UnknownError');
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('error', 'Google sign-in could not be completed. Please try again.');
    return NextResponse.redirect(loginUrl);
  }
}
