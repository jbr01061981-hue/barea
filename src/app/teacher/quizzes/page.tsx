import { getQuizService } from '../review/db';
import { ensureAuthorizedTeacherPage } from '../auth-guard';
import { QuizzesClient } from './quizzes-client';
import { logoutAction } from '../../login/actions';

export const dynamic = 'force-dynamic';

export default async function TeacherQuizzesPage() {
  const teacherContext = await ensureAuthorizedTeacherPage('/teacher/quizzes');
  const quizService = getQuizService();

  const quizzes = quizService.listQuizzes(teacherContext.organizationId);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Quiz Management</h1>
          <p className="text-sm text-stone-600 mt-1">
            Build, configure, and publish church-approved scripture quizzes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-300">
            {teacherContext.displayName}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 bg-white transition"
            >
              Log out
            </button>
          </form>
        </div>
      </div>


      <QuizzesClient initialQuizzes={quizzes} organizationId={teacherContext.organizationId} />
    </main>
  );
}
