import { notFound } from 'next/navigation';
import { getQuizService, getQuestionBankService } from '../../review/db';
import { ensureAuthorizedTeacherPage } from '../../auth-guard';
import { QuizStatus } from '../../../../domain/quiz';
import { QuestionStatus } from '../../../../domain/question';
import { QuizEditorClient } from './editor-client';
import { QuizInspectorClient } from './inspector-client';

export const dynamic = 'force-dynamic';

export default async function TeacherQuizDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: quizId } = await params;
  const teacherContext = await ensureAuthorizedTeacherPage(`/teacher/quizzes/${quizId}`);
  const quizService = getQuizService();

  const quiz = await quizService.getQuiz(teacherContext.organizationId, quizId);
  if (!quiz) {
    notFound();
  }

  // Branch based on lifecycle state
  if (quiz.status === QuizStatus.PUBLISHED || quiz.status === QuizStatus.ARCHIVED) {
    const snapshot = await quizService.getPublishedSnapshot(teacherContext.organizationId, quizId);
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <QuizInspectorClient quiz={quiz} snapshot={snapshot} />
      </main>
    );
  }

  // For DRAFT quizzes, fetch approved bank questions for selection modal
  const bankService = getQuestionBankService();
  const approvedQuestions = await bankService.listQuestions(teacherContext.organizationId, {
    status: QuestionStatus.APPROVED
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <QuizEditorClient
        quiz={quiz}
        approvedBankQuestions={approvedQuestions}
        organizationId={teacherContext.organizationId}
      />
    </main>
  );
}
