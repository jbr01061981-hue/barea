/**
 * Validates internal return URL.
 * Strictly prevents open redirects to external protocols or domains.
 */
export function sanitizeReturnTo(returnTo?: string | null): string {
  if (!returnTo || typeof returnTo !== 'string') {
    return '/teacher/quizzes';
  }
  const trimmed = returnTo.trim();
  // Must start with a single '/' and not with '//' or '\' or protocols
  if (/^\/[a-zA-Z0-9_\-\/\?&=%#\.]*$/.test(trimmed) && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return '/teacher/quizzes';
}
