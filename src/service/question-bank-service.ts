import {
  QuestionStatus,
  type Question,
  type CreateQuestionPayload,
  type UpdateQuestionPayload,
  type QuestionFilter
} from '../domain/question';
import type { QuestionRepository } from '../persistence/sqlite-question-repository';

export class QuestionBankService {
  private repo: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.repo = questionRepository;
  }

  createQuestion(data: CreateQuestionPayload): Question {
    return this.repo.create(data);
  }

  getQuestion(organizationId: string, id: string): Question | null {
    return this.repo.findById(organizationId, id);
  }

  updateQuestion(organizationId: string, id: string, updates: UpdateQuestionPayload): Question | null {
    return this.repo.update(organizationId, id, updates);
  }

  listQuestions(organizationId: string, filter: QuestionFilter = {}): Question[] {
    return this.repo.list(organizationId, filter);
  }

  listApprovedQuestions(organizationId: string, filter: QuestionFilter = {}): Question[] {
    return this.repo.list(organizationId, Object.assign({}, filter, { status: QuestionStatus.APPROVED }));
  }

  transitionStatus(organizationId: string, id: string, nextStatus: QuestionStatus): Question | null {
    return this.repo.transitionStatus(organizationId, id, nextStatus);
  }

  archiveQuestion(organizationId: string, id: string): Question | null {
    return this.repo.transitionStatus(organizationId, id, QuestionStatus.ARCHIVED);
  }
}