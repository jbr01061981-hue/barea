import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '../../../teacher/review/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session
 *
 * Lightweight, server-authoritative session probe.
 * Used by HistoryBfcacheGuard to verify whether the current browser cookie
 * represents an active, valid session without leaking user PII or sensitive claims.
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('barea_session');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers }
    );
  }

  const authService = getAuthService();
  const sessionContext = authService.resolveSession(sessionCookie.value);

  if (!sessionContext) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers }
    );
  }

  return NextResponse.json(
    { authenticated: true },
    { status: 200, headers }
  );
}

