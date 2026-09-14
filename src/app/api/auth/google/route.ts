import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../teacher/review/db';
import { sanitizeReturnTo, resolveOAuthRedirectUri, resolveEffectiveAppOrigin } from '../../../login/url-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authService = getAuthService();
    const returnToParam = request.nextUrl.searchParams.get('returnTo');
    const returnTo = sanitizeReturnTo(returnToParam);

    const origin = resolveEffectiveAppOrigin(request.nextUrl.origin);

    // Canonical redirect URI
    const redirectUri = resolveOAuthRedirectUri(origin);

    const { url, transactionId } = authService.generateGoogleOAuthUrl(redirectUri, returnTo);

    const response = NextResponse.redirect(url);

    // Store only the transaction identifier in HttpOnly, SameSite=Lax cookie restricted to callback path
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth/callback',
      maxAge: 60 * 10 // 10 minutes
    };

    response.cookies.set('barea_oauth_tx', transactionId, cookieOptions);

    return response;
  } catch (err: unknown) {
    console.error('[OAuth Initiation Error]:', err instanceof Error ? err.name : 'UnknownError');
    const fallbackOrigin = resolveEffectiveAppOrigin(request.nextUrl.origin);
    const loginUrl = new URL('/login', fallbackOrigin);
    loginUrl.searchParams.set('error', 'Google sign-in could not be completed. Please try again.');
    return NextResponse.redirect(loginUrl);
  }
}
