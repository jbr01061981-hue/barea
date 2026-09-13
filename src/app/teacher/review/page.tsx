import { getQuestionBankService } from './db';
import { ensureAuthorizedTeacherPage } from '../auth-guard';
import { QuestionStatus } from '../../../domain/question';
import { QueueClient } from './queue-client';

export const dynamic = 'force-dynamic';

export default async function TeacherReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const initialActiveId = params?.id;

  const returnTo = initialActiveId
    ? `/teacher/review?id=${encodeURIComponent(initialActiveId)}`
    : '/teacher/review';

  // Derive teacher context strictly on the server; browser input cannot influence tenant identity
  const teacherContext = await ensureAuthorizedTeacherPage(returnTo);
  const bankService = getQuestionBankService();

  // Fetch only PENDING_REVIEW questions for this authorized organization
  const pendingQuestions = bankService.listQuestions(teacherContext.organizationId, {
    status: QuestionStatus.PENDING_REVIEW,
  });

  return (
    <div className="py-2">
      <QueueClient
        initialQuestions={pendingQuestions}
        organizationName={teacherContext.displayName}
        organizationId={teacherContext.organizationId}
        initialActiveId={initialActiveId}
      />
    </div>
  );
}