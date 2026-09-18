import Link from 'next/link';
import { getQuestionBankService, getQuizService } from './review/db';
import { ensureAuthorizedTeacherPage } from './auth-guard';
import { QuestionStatus } from '../../domain/question';
import { QuizStatus } from '../../domain/quiz';

export const dynamic = 'force-dynamic';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default async function TeacherWorkspacePage() {
  const teacherContext = await ensureAuthorizedTeacherPage('/teacher');

  const quizService = getQuizService();
  const questionBankService = getQuestionBankService();

  const [quizzes, pendingQuestions] = await Promise.all([
    quizService.listQuizzes(teacherContext.organizationId),
    questionBankService.listQuestions(teacherContext.organizationId, {
      status: QuestionStatus.PENDING_REVIEW,
    }),
  ]);

  const draftCount = quizzes.filter((quiz) => quiz.status === QuizStatus.DRAFT).length;
  const publishedCount = quizzes.filter((quiz) => quiz.status === QuizStatus.PUBLISHED).length;
  const recentQuizzes = [...quizzes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <main>
      <section className="border-b border-stone-200 pb-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
          Teacher workspace
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl tracking-tight">Good to see you, {teacherContext.displayName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Prepare Scripture quizzes, review questions, and get a live quiz ready for your church.
            </p>
          </div>
          <Link
            href="/teacher/quizzes"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Open Quiz Library
          </Link>
        </div>
      </section>

      <section aria-label="Workspace summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/teacher/quizzes?status=DRAFT" className="border border-stone-200 bg-white p-5 hover:border-stone-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Draft quizzes</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">{draftCount}</p>
          <p className="mt-1 text-xs text-stone-500">Continue preparing</p>
        </Link>

        <Link href="/teacher/quizzes?status=PUBLISHED" className="border border-stone-200 bg-white p-5 hover:border-stone-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Published</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">{publishedCount}</p>
          <p className="mt-1 text-xs text-stone-500">Ready to host</p>
        </Link>

        <Link href="/teacher/review" className="border border-stone-200 bg-white p-5 hover:border-stone-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Needs review</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">{pendingQuestions.length}</p>
          <p className="mt-1 text-xs text-stone-500">Questions awaiting approval</p>
        </Link>

        <div className="border border-stone-200 bg-[#fbfaf7] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Organization</p>
          <p className="mt-2 truncate font-mono text-sm font-semibold text-stone-800">{teacherContext.organizationId}</p>
          <p className="mt-1 text-xs text-stone-500">Server-authorized workspace</p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Recent work</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-stone-900">Quiz library</h2>
            </div>
            <Link href="/teacher/quizzes" className="text-xs font-semibold text-stone-600 hover:text-stone-900">
              View all
            </Link>
          </div>

          {recentQuizzes.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-serif text-lg text-stone-800">Your quiz library is empty.</p>
              <p className="mt-2 text-sm text-stone-500">Create a draft and start assembling approved questions.</p>
              <Link
                href="/teacher/quizzes"
                className="mt-5 inline-flex min-h-10 items-center border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Create your first quiz
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {recentQuizzes.map((quiz) => (
                <Link
                  key={quiz.id}
                  href={`/teacher/quizzes/${quiz.id}`}
                  className="flex min-h-20 items-center justify-between gap-4 px-5 py-4 hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base font-semibold text-stone-900">{quiz.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {quiz.questions?.length ?? 0} questions · Updated {formatDate(quiz.updatedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-600">
                    {quiz.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="border border-stone-200 bg-[#fbfaf7] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">Quick actions</p>
          <div className="mt-4 grid gap-2">
            <Link
              href="/teacher/quizzes"
              className="flex min-h-11 items-center justify-between border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              <span>Create a quiz</span><span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/teacher/review"
              className="flex min-h-11 items-center justify-between border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              <span>Review questions</span><span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-7 border-t border-stone-200 pt-5">
            <p className="text-xs font-semibold text-stone-800">MVP workflow</p>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-stone-600">
              <li><span className="font-semibold text-stone-800">1.</span> Review and approve questions.</li>
              <li><span className="font-semibold text-stone-800">2.</span> Assemble a quiz from approved questions.</li>
              <li><span className="font-semibold text-stone-800">3.</span> Publish the quiz when ready.</li>
              <li><span className="font-semibold text-stone-800">4.</span> Share and host the live session.</li>
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}
