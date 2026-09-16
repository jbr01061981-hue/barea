import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUnifiedUserContext } from '../teacher/review/db';
import { WorkspaceView } from './workspace-view';
import { HistoryBfcacheGuard } from '../history-bfcache-guard';

export const metadata: Metadata = {
  title: 'Workspace — BAREA',
  description: 'Your BAREA workspace for Scripture quizzes, fellowship, and learning.'
};

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ workspace?: string }>;
}) {
  const user = await getUnifiedUserContext();

  if (!user) {
    redirect('/login?returnTo=/home');
  }

  const params = await searchParams;
  const initialWorkspace = params?.workspace === 'create-host' ? 'create-host' : 'individual';

  return (
    <div data-barea-auth-shell="" className="min-h-[calc(100svh-4.5rem)] bg-[var(--barea-midnight)] text-[var(--barea-ivory)] px-4 py-6 sm:px-6 lg:px-8">
      <HistoryBfcacheGuard />

      <div className="mx-auto max-w-4xl">
        <WorkspaceView
          initialWorkspace={initialWorkspace}
          displayName={user.displayName}
          email={user.email}
          isTeacherAuthorized={user.isTeacherAuthorized}
        />
      </div>
    </div>
  );
}
