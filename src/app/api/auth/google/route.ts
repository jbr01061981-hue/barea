import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../teacher/review/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authService = getAuthService();
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/teacher/quizzes';
    
    // Construct absolute redirect URI matching current origin
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/callback/google`;

    const { url, state, codeVerifier } = authService.generateGoogleOAuthUrl(redirectUri);

    const response = NextResponse.redirect(url);

    // Store state, codeVerifier, and returnTo in HttpOnly, SameSite=Lax cookies for callback validation
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth/callback',
      maxAge: 60 * 10 // 10 minutes
    };

    response.cookies.set('barea_oauth_state', state, cookieOptions);
    response.cookies.set('barea_oauth_verifier', codeVerifier, cookieOptions);
    response.cookies.set('barea_oauth_return_to', returnTo, cookieOptions);

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initiate Google OAuth.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
