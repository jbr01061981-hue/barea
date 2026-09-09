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

  createQuiz(organizationId: string, payload: CreateQuizPayload): Quiz {
    return this.repo.create({
      ...payload,
      organizationId
    });
  }

  getQuiz(organizationId: string, quizId: string): Quiz | null {
    return this.repo.findById(organizationId, quizId);
  }

  listQuizzes(organizationId: string, filter?: QuizFilter): Quiz[] {
    return this.repo.list(organizationId, filter);
  }

  updateQuiz(organizationId: string, quizId: string, updates: UpdateQuizPayload): Quiz | null {
    return this.repo.update(organizationId, quizId, updates);
  }

  archiveQuiz(organizationId: string, quizId: string): Quiz | null {
    return this.repo.transitionStatus(organizationId, quizId, QuizStatus.ARCHIVED);
  }

  restoreDraftQuiz(organizationId: string, quizId: string): Quiz | null {
    return this.repo.transitionStatus(organizationId, quizId, QuizStatus.DRAFT);
  }

  addQuestion(
    organizationId: string,
    quizId: string,
    questionId: string,
    sortOrder?: number
  ): QuizQuestionItem {
    return this.repo.addQuestion(organizationId, quizId, questionId, sortOrder);
  }

  removeQuestion(organizationId: string, quizId: string, questionId: string): boolean {
    return this.repo.removeQuestion(organizationId, quizId, questionId);
  }

  reorderQuestions(
    organizationId: string,
    quizId: string,
    questionIdsInOrder: readonly string[]
  ): readonly QuizQuestionItem[] {
    return this.repo.reorderQuestions(organizationId, quizId, questionIdsInOrder);
  }

  getQuizQuestions(organizationId: string, quizId: string): readonly QuizQuestionItem[] {
    return this.repo.getQuizQuestions(organizationId, quizId);
  }

  publishQuiz(
    organizationId: string,
    quizId: string,
    publishedByUserId: string
  ): PublishedQuizSnapshot {
    return this.repo.publishQuiz(organizationId, quizId, publishedByUserId);
  }

  getPublishedSnapshot(organizationId: string, quizId: string): PublishedQuizSnapshot | null {
    return this.repo.getPublishedSnapshot(organizationId, quizId);
  }

  transaction<T>(action: () => T): T {
    return this.repo.transaction(action);
  }
}
