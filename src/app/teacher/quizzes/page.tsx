import { getQuizService, getAuthorizedTeacherContext } from '../review/db';
import { QuizzesClient } from './quizzes-client';

export const dynamic = 'force-dynamic';

export default async function TeacherQuizzesPage() {
  const teacherContext = await getAuthorizedTeacherContext();
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
        </div>
      </div>

      <QuizzesClient initialQuizzes={quizzes} organizationId={teacherContext.organizationId} />
    </main>
  );
}
