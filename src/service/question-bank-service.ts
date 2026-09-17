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

  async createQuestion(data: CreateQuestionPayload): Promise<Question> {
    return this.repo.create(data);
  }

  async getQuestion(organizationId: string, id: string): Promise<Question | null> {
    return this.repo.findById(organizationId, id);
  }

  async updateQuestion(organizationId: string, id: string, updates: UpdateQuestionPayload): Promise<Question | null> {
    return this.repo.update(organizationId, id, updates);
  }

  async listQuestions(organizationId: string, filter: QuestionFilter = {}): Promise<Question[]> {
    return this.repo.list(organizationId, filter);
  }

  async listApprovedQuestions(organizationId: string, filter: QuestionFilter = {}): Promise<Question[]> {
    return this.repo.list(organizationId, Object.assign({}, filter, { status: QuestionStatus.APPROVED }));
  }

  async transitionStatus(organizationId: string, id: string, nextStatus: QuestionStatus): Promise<Question | null> {
    return this.repo.transitionStatus(organizationId, id, nextStatus);
  }

  async archiveQuestion(organizationId: string, id: string): Promise<Question | null> {
    return this.repo.transitionStatus(organizationId, id, QuestionStatus.ARCHIVED);
  }

  createQuestionSync(data: CreateQuestionPayload): Question {
    const r = this.repo as any;
    if (typeof r.createSync === 'function') {
      return r.createSync(data);
    }
    throw new Error('createQuestionSync not supported by underlying repository');
  }

  transitionStatusSync(organizationId: string, id: string, nextStatus: QuestionStatus): Question | null {
    const r = this.repo as any;
    if (typeof r.transitionStatusSync === 'function') {
      return r.transitionStatusSync(organizationId, id, nextStatus);
    }
    throw new Error('transitionStatusSync not supported by underlying repository');
  }

  transaction<T>(action: () => T): T {
    return this.repo.transaction(action);
  }
}