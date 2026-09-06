import { getQuestionBankService } from './db';
import { QuestionStatus } from '../../../domain/question';
import { QueueClient } from './queue-client';

export const dynamic = 'force-dynamic';

export default async function TeacherReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string; id?: string }>;
}) {
  const params = await searchParams;
  const organizationId = params?.org || 'church-default';
  const initialActiveId = params?.id;
  const bankService = getQuestionBankService();

  // Fetch only PENDING_REVIEW questions for this organization
  const pendingQuestions = bankService.listQuestions(organizationId, {
    status: QuestionStatus.PENDING_REVIEW,
  });

  return (
    <div className="py-2">
      <QueueClient
        initialQuestions={pendingQuestions}
        organizationId={organizationId}
        initialActiveId={initialActiveId}
      />
    </div>
  );
}