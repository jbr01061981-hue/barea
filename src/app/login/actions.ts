'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from '../teacher/review/db';

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

  // Delete matching the exact path used during cookie creation
  cookieStore.delete({
    name: 'barea_session',
    path: '/'
  });

  redirect('/');
}
