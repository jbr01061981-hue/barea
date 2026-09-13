import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../../teacher/review/db';
import { sanitizeReturnTo } from '../../../../login/url-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const receivedState = searchParams.get('state');
  const error = searchParams.get('error');

  const origin = request.nextUrl.origin;
  const returnToRaw = request.cookies.get('barea_oauth_return_to')?.value;
  const targetPath = sanitizeReturnTo(returnToRaw);

  if (error) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', `Google authentication was canceled: ${error}`);
    return NextResponse.redirect(loginRedirect);
  }

  const expectedState = request.cookies.get('barea_oauth_state')?.value;
  const codeVerifier = request.cookies.get('barea_oauth_verifier')?.value;

  if (!expectedState || !codeVerifier || !receivedState || !code) {
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', 'OAuth verification failed: missing state or code.');
    return NextResponse.redirect(loginRedirect);
  }

  try {
    const authService = getAuthService();
    const redirectUri = `${origin}/api/auth/callback/google`;

    const { rawToken } = await authService.handleGoogleCallback({
      code,
      expectedState,
      receivedState,
      codeVerifier,
      redirectUri
    });

    const destination = new URL(targetPath, origin);
    const response = NextResponse.redirect(destination);

    // Set authoritative session cookie
    response.cookies.set('barea_session', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Clear transient OAuth cookies
    response.cookies.delete('barea_oauth_state');
    response.cookies.delete('barea_oauth_verifier');
    response.cookies.delete('barea_oauth_return_to');

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication callback processing failed.';
    const loginRedirect = new URL('/login', origin);
    loginRedirect.searchParams.set('error', message);
    return NextResponse.redirect(loginRedirect);
  }
}
