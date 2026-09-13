import { redirect } from 'next/navigation';
import { getAuthorizedTeacherContext, type TeacherContext } from './review/db';
import { TeacherUnauthorizedError, TeacherForbiddenError } from '../../domain/domain-errors';

/**
 * Enforces teacher authorization for Next.js Server Component page navigation.
 *
 * Requirements:
 * 1. Unauthenticated users (TeacherUnauthorizedError) are redirected to /login
 *    with the appropriate safe returnTo param.
 * 2. Authenticated users without teacher capability (TeacherForbiddenError) are
 *    redirected to /login?error=Access+denied.+Teacher+capability+is+required.
 * 3. Next.js redirect and not-found signals propagate unchanged.
 * 4. Unexpected application, database, syntax, configuration, or runtime errors
 *    are NEVER suppressed or converted to login redirects; they propagate normally.
 * 5. Preserves the fail-closed security guarantees of getAuthorizedTeacherContext().
 */
export async function ensureAuthorizedTeacherPage(returnTo: string = '/teacher/quizzes'): Promise<TeacherContext> {
  try {
    return await getAuthorizedTeacherContext();
  } catch (err: unknown) {
    // 1. Next.js redirect/not-found signals must propagate directly
    if (typeof err === 'object' && err !== null && 'digest' in err) {
      const digest = String((err as { digest?: unknown }).digest || '');
      if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
        throw err;
      }
    }

    // 2. Forbidden: authenticated user lacks teacher capability
    if (err instanceof TeacherForbiddenError) {
      redirect('/login?error=Access+denied.+Teacher+capability+is+required.');
    }

    // 3. Unauthorized: unauthenticated / missing valid teacher session
    if (err instanceof TeacherUnauthorizedError) {
      const loginTarget = returnTo
        ? `/login?returnTo=${encodeURIComponent(returnTo)}`
        : '/login';
      redirect(loginTarget);
    }

    // 4. Any unexpected error (database errors, programming bugs, etc.) MUST propagate normally
    throw err;
  }
}
