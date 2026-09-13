import { redirect } from 'next/navigation';
import { getAuthorizedTeacherContext, type TeacherContext } from './review/db';

/**
 * Enforces teacher authorization for Next.js Server Component page navigation.
 *
 * Requirements:
 * 1. Unauthenticated users (or dev users without an explicit teacher context/org)
 *    are redirected to /login with the appropriate returnTo param.
 * 2. Authenticated users without teacher capability (Forbidden) are redirected to
 *    /login?error=Access+denied.+Teacher+capability+is+required.
 * 3. Does NOT catch or suppress unrelated errors (e.g. NEXT_REDIRECT or syntax/runtime errors).
 * 4. Preserves the fail-closed security guarantees of getAuthorizedTeacherContext().
 */
export async function ensureAuthorizedTeacherPage(returnTo: string = '/teacher/quizzes'): Promise<TeacherContext> {
  try {
    return await getAuthorizedTeacherContext();
  } catch (err: unknown) {
    // If it's already a Next.js redirect/not-found signal, let it propagate directly
    if (typeof err === 'object' && err !== null && 'digest' in err) {
      const digest = String((err as { digest?: unknown }).digest || '');
      if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
        throw err;
      }
    }

    const message = err instanceof Error ? err.message : String(err);

    // Differentiate between lack of teacher capability (Forbidden) vs unauthenticated (Unauthorized)
    if (message.startsWith('Forbidden:')) {
      redirect('/login?error=Access+denied.+Teacher+capability+is+required.');
    }

    // Default unauthenticated / unauthorized redirect to login with safe returnTo
    const loginTarget = returnTo
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/login';
    redirect(loginTarget);
  }
}
