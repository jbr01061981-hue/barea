import { getUnifiedUserContext } from './teacher/review/db';
import { AuthenticatedNavMenu } from './home/authenticated-nav-menu';
import { logoutAction } from './login/actions';

export async function SiteNav() {
  const user = await getUnifiedUserContext();

  if (user) {
    return (
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Desktop / Tablet horizontal navigation */}
        <nav aria-label="Authenticated navigation" className="hidden sm:flex items-center gap-3 md:gap-5">
          <a
            href="/home?workspace=individual"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-white hover:text-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]"
          >
            Individual
          </a>
          {user.isTeacherAuthorized ? (
            <a
              href="/teacher/quizzes"
              className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-[var(--barea-gold-light)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]"
            >
              Create &amp; Host
            </a>
          ) : (
            <a
              href="/home?workspace=create-host"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-[var(--barea-ivory-muted)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)]"
            >
              <span>Create &amp; Host</span>
              <span aria-hidden="true" className="text-xs">🔒</span>
            </a>
          )}
          <form action={logoutAction} className="inline-flex">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-[var(--barea-ivory-muted)] hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] cursor-pointer"
            >
              Log out
            </button>
          </form>
        </nav>

        {/* Mobile three-dot menu dropdown */}
        <div className="sm:hidden">
          <AuthenticatedNavMenu
            displayName={user.displayName}
            email={user.email}
            isTeacherAuthorized={user.isTeacherAuthorized}
          />
        </div>
      </div>
    );
  }

  return (
    <nav aria-label="Primary navigation" className="flex items-center gap-2 sm:gap-4">
      <a
        href="/#how-it-works"
        className="hidden min-h-11 items-center rounded-sm px-2 text-sm font-medium text-[var(--barea-ivory-muted)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:inline-flex"
      >
        How it works
      </a>
      <a
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-sm font-semibold text-white hover:text-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] sm:px-2"
      >
        Log in
      </a>
      <a
        href="/#explore-barea"
        className="hidden min-h-11 items-center justify-center rounded-[var(--barea-radius-control)] bg-[var(--barea-gold)] px-4 text-sm font-bold text-[var(--barea-midnight)] transition-colors hover:bg-[var(--barea-gold-light)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--barea-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--barea-midnight)] sm:inline-flex"
      >
        Explore BAREA
      </a>
    </nav>
  );
}
