import {
  QuizStatus,
  type Quiz,
  type CreateQuizPayload,
  type UpdateQuizPayload,
  type QuizQuestionItem,
  type PublishedQuizSnapshot
} from '../domain/quiz';
import type { QuizRepository, QuizFilter } from '../persistence/sqlite-quiz-repository';

export class QuizService {
  private repo: QuizRepository;

  constructor(repo: QuizRepository) {
    this.repo = repo;
  }

  async createQuiz(organizationId: string, payload: CreateQuizPayload): Promise<Quiz> {
    return this.repo.create({
      ...payload,
      organizationId
    });
  }

  async getQuiz(organizationId: string, quizId: string): Promise<Quiz | null> {
    return this.repo.findById(organizationId, quizId);
  }

  async listQuizzes(organizationId: string, filter?: QuizFilter): Promise<Quiz[]> {
    return this.repo.list(organizationId, filter);
  }

  async updateQuiz(organizationId: string, quizId: string, updates: UpdateQuizPayload): Promise<Quiz | null> {
    return this.repo.update(organizationId, quizId, updates);
  }

  async archiveQuiz(organizationId: string, quizId: string): Promise<Quiz | null> {
    return this.repo.transitionStatus(organizationId, quizId, QuizStatus.ARCHIVED);
  }

  async restoreDraftQuiz(organizationId: string, quizId: string): Promise<Quiz | null> {
    return this.repo.transitionStatus(organizationId, quizId, QuizStatus.DRAFT);
  }

  async addQuestion(
    organizationId: string,
    quizId: string,
    questionId: string,
    sortOrder?: number
  ): Promise<QuizQuestionItem> {
    return this.repo.addQuestion(organizationId, quizId, questionId, sortOrder);
  }

  async removeQuestion(organizationId: string, quizId: string, questionId: string): Promise<boolean> {
    return this.repo.removeQuestion(organizationId, quizId, questionId);
  }

  async reorderQuestions(
    organizationId: string,
    quizId: string,
    questionIdsInOrder: readonly string[]
  ): Promise<readonly QuizQuestionItem[]> {
    return this.repo.reorderQuestions(organizationId, quizId, questionIdsInOrder);
  }

  async getQuizQuestions(organizationId: string, quizId: string): Promise<readonly QuizQuestionItem[]> {
    return this.repo.getQuizQuestions(organizationId, quizId);
  }

  async publishQuiz(
    organizationId: string,
    quizId: string,
    publishedByUserId: string
  ): Promise<PublishedQuizSnapshot> {
    return this.repo.publishQuiz(organizationId, quizId, publishedByUserId);
  }

  async getPublishedSnapshot(organizationId: string, quizId: string): Promise<PublishedQuizSnapshot | null> {
    return this.repo.getPublishedSnapshot(organizationId, quizId);
  }

  transaction<T>(action: () => T): T {
    return this.repo.transaction(action);
  }
}
