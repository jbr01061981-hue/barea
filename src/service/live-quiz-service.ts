import * as crypto from 'crypto';
import {
  SessionStatus,
  ParticipationMode,
  type QuizSession
} from '../domain/session';
import {
  ParticipantToken,
  validateParticipantToken
} from '../domain/value-objects';
import {
  LiveSessionState,
  QuestionLifecycleState,
  type ParticipantLiveView,
  type HostLiveView,
  type ParticipantSubmission,
  LiveQuizEventType,
  type LiveQuizEvent,
  InvalidLiveStateTransitionError,
  AnswerDeadlineExpiredError,
  NotSessionHostError,
  SessionNotActiveError,
  InvalidQuestionChoiceError
} from '../domain/live-quiz';
import {
  SessionNotFoundError,
  SessionAccessDeniedError,
  CrossTenantSnapshotError
} from '../domain/domain-errors';
import {
  projectQuestionForParticipant,
  type SnapshotQuestion,
  type PublishedQuizSnapshot
} from '../domain/quiz';
import type { SessionRepository } from '../persistence/sqlite-session-repository';
import type { RateLimiter } from './rate-limiter';
import type { RealtimeTransport } from '../transport/realtime-transport';

export interface SubmitParticipantAnswerInput {
  readonly sessionId: string;
  readonly token: ParticipantToken;
  readonly questionPosition: number;
  readonly selectedOptionIndices: readonly number[];
  readonly clientTimestamp?: string;
}

export interface SubmitGroupAnswerInput {
  readonly sessionId: string;
  readonly hostUserId: string;
  readonly groupId: string;
  readonly questionPosition: number;
  readonly selectedOptionIndices: readonly number[];
}

export class LiveQuizService {
  private repo: SessionRepository;
  private rateLimiter?: RateLimiter;
  private transport?: RealtimeTransport;

  constructor(
    repo: SessionRepository,
    rateLimiter?: RateLimiter,
    transport?: RealtimeTransport
  ) {
    this.repo = repo;
    this.rateLimiter = rateLimiter;
    this.transport = transport;
  }

  startLiveQuiz(sessionId: string, hostUserId: string): { session: QuizSession; liveState: LiveSessionState } {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(hostUserId);
    }

    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    if (!snapshot || !snapshot.questions || snapshot.questions.length === 0) {
      throw new InvalidLiveStateTransitionError('Cannot start quiz session: published quiz has no questions.');
    }

    const question1 = snapshot.questions[0];
    const result = this.repo.startLiveSession(sessionId, hostUserId, question1);

    if (this.transport) {
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.SESSION_STARTED,
        sessionId,
        stateVersion: result.liveState.stateVersion,
        timestamp: new Date().toISOString(),
        payload: {
          sessionStatus: result.session.status,
          currentQuestionPosition: 1,
          questionLifecycleState: result.liveState.questionLifecycleState,
          question: projectQuestionForParticipant(question1),
          questionOpenedAt: result.liveState.questionOpenedAt,
          answerDeadlineAt: result.liveState.answerDeadlineAt,
          timeLimitSeconds: result.liveState.timeLimitSeconds,
          serverTime: result.liveState.serverTime
        }
      });
    }

    return result;
  }

  lockQuestion(sessionId: string, hostUserId: string, expectedVersion?: number): { session: QuizSession; liveState: LiveSessionState } {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(hostUserId);
    }

    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();

    const result = this.repo.lockQuestion(sessionId, hostUserId, expectedVersion);

    if (this.transport) {
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.QUESTION_LOCKED,
        sessionId,
        stateVersion: result.liveState.stateVersion,
        timestamp: new Date().toISOString(),
        payload: {
          currentQuestionPosition: result.liveState.currentQuestionPosition,
          questionLifecycleState: result.liveState.questionLifecycleState,
          serverTime: result.liveState.serverTime
        }
      });
    }

    return result;
  }

  openQuestion(sessionId: string, hostUserId: string, expectedVersion?: number): { session: QuizSession; liveState: LiveSessionState } {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(hostUserId);
    }

    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
    const liveState = this.repo.getLiveSessionState(sessionId);
    if (!liveState) throw new SessionNotFoundError(sessionId);

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    if (!snapshot) throw new CrossTenantSnapshotError('Quiz snapshot not found.');

    const question = snapshot.questions.find(q => q.position === liveState.currentQuestionPosition);
    if (!question) throw new InvalidLiveStateTransitionError('Current question position not found in snapshot.');

    const result = this.repo.openQuestion(sessionId, hostUserId, question, expectedVersion);

    if (this.transport) {
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.QUESTION_OPENED,
        sessionId,
        stateVersion: result.liveState.stateVersion,
        timestamp: new Date().toISOString(),
        payload: {
          currentQuestionPosition: result.liveState.currentQuestionPosition,
          questionLifecycleState: result.liveState.questionLifecycleState,
          question: projectQuestionForParticipant(question),
          questionOpenedAt: result.liveState.questionOpenedAt,
          answerDeadlineAt: result.liveState.answerDeadlineAt,
          timeLimitSeconds: result.liveState.timeLimitSeconds,
          serverTime: result.liveState.serverTime
        }
      });
    }

    return result;
  }

  advanceQuestion(sessionId: string, hostUserId: string, expectedVersion?: number): { session: QuizSession; liveState: LiveSessionState } {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(hostUserId);
    }

    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
    const liveState = this.repo.getLiveSessionState(sessionId);
    if (!liveState) throw new SessionNotFoundError(sessionId);

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    if (!snapshot) throw new CrossTenantSnapshotError('Quiz snapshot not found.');

    const nextPosition = liveState.currentQuestionPosition + 1;
    const nextQuestion = snapshot.questions.find(q => q.position === nextPosition) ?? null;

    const result = this.repo.advanceQuestion(sessionId, hostUserId, nextQuestion, expectedVersion);

    if (this.transport) {
      if (nextQuestion) {
        this.transport.publish({
          eventId: 'evt_' + crypto.randomUUID(),
          eventType: LiveQuizEventType.QUESTION_ADVANCED,
          sessionId,
          stateVersion: result.liveState.stateVersion,
          timestamp: new Date().toISOString(),
          payload: {
            currentQuestionPosition: result.liveState.currentQuestionPosition,
            questionLifecycleState: result.liveState.questionLifecycleState,
            question: projectQuestionForParticipant(nextQuestion),
            questionOpenedAt: result.liveState.questionOpenedAt,
            answerDeadlineAt: result.liveState.answerDeadlineAt,
            timeLimitSeconds: result.liveState.timeLimitSeconds,
            serverTime: result.liveState.serverTime
          }
        });
      } else {
        this.transport.publish({
          eventId: 'evt_' + crypto.randomUUID(),
          eventType: LiveQuizEventType.QUIZ_COMPLETED,
          sessionId,
          stateVersion: result.liveState.stateVersion,
          timestamp: new Date().toISOString(),
          payload: {
            sessionStatus: result.session.status,
            questionLifecycleState: result.liveState.questionLifecycleState,
            serverTime: result.liveState.serverTime
          }
        });
      }
    }

    return result;
  }

  completeLiveQuiz(sessionId: string, hostUserId: string, expectedVersion?: number): { session: QuizSession; liveState: LiveSessionState } {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(hostUserId);
    }

    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();

    const result = this.repo.completeLiveSession(sessionId, hostUserId, expectedVersion);

    if (this.transport) {
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.QUIZ_COMPLETED,
        sessionId,
        stateVersion: result.liveState.stateVersion,
        timestamp: new Date().toISOString(),
        payload: {
          sessionStatus: result.session.status,
          questionLifecycleState: result.liveState.questionLifecycleState,
          serverTime: result.liveState.serverTime
        }
      });
    }

    return result;
  }

  submitParticipantAnswer(input: SubmitParticipantAnswerInput): ParticipantSubmission {
    validateParticipantToken(input.token);

    const { participant, session } = this.repo.resumeSession(input.sessionId, input.token);
    if (!session) throw new SessionNotFoundError(input.sessionId);
    if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();

    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(participant.userId);
    }

    // 1. Authoritative Live State check
    const liveState = this.repo.getLiveSessionState(input.sessionId);
    if (!liveState) throw new SessionNotFoundError(input.sessionId);

    // 2. Authoritative Question Lifecycle State check
    if (liveState.questionLifecycleState !== QuestionLifecycleState.ANSWERING) {
      throw new InvalidLiveStateTransitionError(
        `Cannot submit answer: question is in '${liveState.questionLifecycleState}' state, expected '${QuestionLifecycleState.ANSWERING}'.`
      );
    }

    // 3. Authoritative Question Position check
    if (input.questionPosition !== liveState.currentQuestionPosition) {
      throw new InvalidLiveStateTransitionError(
        `Cannot submit answer for question position ${input.questionPosition}: current active question is ${liveState.currentQuestionPosition}.`
      );
    }

    // 4. Server-Authoritative Deadline pre-check
    if (!liveState.answerDeadlineAt) {
      throw new InvalidLiveStateTransitionError('No active answer deadline configured for current question.');
    }
    const nowServerMs = typeof (this.repo as any).getCurrentTimeMs === 'function'
      ? (this.repo as any).getCurrentTimeMs()
      : Date.now();
    const deadlineMs = new Date(liveState.answerDeadlineAt).getTime();
    if (nowServerMs > deadlineMs) {
      throw new AnswerDeadlineExpiredError();
    }

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    if (!snapshot) throw new CrossTenantSnapshotError('Quiz snapshot not found.');

    const question = snapshot.questions.find(q => q.position === liveState.currentQuestionPosition);
    if (!question) {
      throw new InvalidLiveStateTransitionError(`Question position ${liveState.currentQuestionPosition} does not exist in quiz.`);
    }

    // Validate choices
    if (!Array.isArray(input.selectedOptionIndices) || input.selectedOptionIndices.length === 0) {
      throw new InvalidQuestionChoiceError('At least one option must be selected.');
    }
    for (const idx of input.selectedOptionIndices) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= question.choices.length) {
        throw new InvalidQuestionChoiceError(`Choice index ${idx} is invalid for question with ${question.choices.length} options.`);
      }
    }

    const submission = this.repo.recordAnswerSubmission({
      sessionId: input.sessionId,
      questionPosition: liveState.currentQuestionPosition,
      questionId: question.id,
      participantId: participant.id,
      userId: participant.userId,
      selectedOptionIndices: input.selectedOptionIndices,
      clientTimestamp: input.clientTimestamp
    });

    if (this.transport) {
      const submissionCount = this.repo.getSubmissionCountForQuestion(input.sessionId, liveState.currentQuestionPosition);
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.ANSWER_SUBMITTED,
        sessionId: input.sessionId,
        stateVersion: session.stateVersion,
        timestamp: submission.submittedAt,
        payload: {
          questionPosition: liveState.currentQuestionPosition,
          participantId: participant.id,
          submissionCount
        }
      });
    }

    return submission;
  }

  submitGroupAnswer(input: SubmitGroupAnswerInput): ParticipantSubmission {
    if (this.rateLimiter) {
      this.rateLimiter.checkLiveMutation(input.hostUserId);
    }

    const session = this.repo.findSessionById(input.sessionId);
    if (!session) throw new SessionNotFoundError(input.sessionId);
    if (session.hostUserId !== input.hostUserId) throw new NotSessionHostError();
    if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();

    // 1. Authoritative Live State check
    const liveState = this.repo.getLiveSessionState(input.sessionId);
    if (!liveState) throw new SessionNotFoundError(input.sessionId);

    // 2. Authoritative Question Lifecycle State check
    if (liveState.questionLifecycleState !== QuestionLifecycleState.ANSWERING) {
      throw new InvalidLiveStateTransitionError(
        `Cannot submit answer: question is in '${liveState.questionLifecycleState}' state, expected '${QuestionLifecycleState.ANSWERING}'.`
      );
    }

    // 3. Authoritative Question Position check
    if (input.questionPosition !== liveState.currentQuestionPosition) {
      throw new InvalidLiveStateTransitionError(
        `Cannot submit answer for question position ${input.questionPosition}: current active question is ${liveState.currentQuestionPosition}.`
      );
    }

    // 4. Server-Authoritative Deadline pre-check
    if (!liveState.answerDeadlineAt) {
      throw new InvalidLiveStateTransitionError('No active answer deadline configured for current question.');
    }
    const nowServerMs = typeof (this.repo as any).getCurrentTimeMs === 'function'
      ? (this.repo as any).getCurrentTimeMs()
      : Date.now();
    const deadlineMs = new Date(liveState.answerDeadlineAt).getTime();
    if (nowServerMs > deadlineMs) {
      throw new AnswerDeadlineExpiredError();
    }

    // Verify group belongs to session
    const groups = this.repo.listGroups(input.sessionId);
    const targetGroup = groups.find(g => g.id === input.groupId);
    if (!targetGroup) {
      throw new InvalidLiveStateTransitionError('Specified group does not exist in this session.');
    }

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    if (!snapshot) throw new CrossTenantSnapshotError('Quiz snapshot not found.');

    const question = snapshot.questions.find(q => q.position === liveState.currentQuestionPosition);
    if (!question) {
      throw new InvalidLiveStateTransitionError(`Question position ${liveState.currentQuestionPosition} does not exist in quiz.`);
    }

    // Validate choices
    if (!Array.isArray(input.selectedOptionIndices) || input.selectedOptionIndices.length === 0) {
      throw new InvalidQuestionChoiceError('At least one option must be selected.');
    }
    for (const idx of input.selectedOptionIndices) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= question.choices.length) {
        throw new InvalidQuestionChoiceError(`Choice index ${idx} is invalid for question with ${question.choices.length} options.`);
      }
    }

    const submission = this.repo.recordAnswerSubmission({
      sessionId: input.sessionId,
      questionPosition: liveState.currentQuestionPosition,
      questionId: question.id,
      sessionGroupId: input.groupId,
      selectedOptionIndices: input.selectedOptionIndices
    });

    if (this.transport) {
      const submissionCount = this.repo.getSubmissionCountForQuestion(input.sessionId, liveState.currentQuestionPosition);
      this.transport.publish({
        eventId: 'evt_' + crypto.randomUUID(),
        eventType: LiveQuizEventType.ANSWER_SUBMITTED,
        sessionId: input.sessionId,
        stateVersion: session.stateVersion,
        timestamp: submission.submittedAt,
        payload: {
          questionPosition: liveState.currentQuestionPosition,
          sessionGroupId: input.groupId,
          submissionCount
        }
      });
    }

    return submission;
  }

  getParticipantLiveView(sessionId: string, token: ParticipantToken): ParticipantLiveView {
    validateParticipantToken(token);
    const { participant, session } = this.repo.resumeSession(sessionId, token);
    const liveState = this.repo.getLiveSessionState(sessionId);
    if (!liveState) throw new SessionNotFoundError(sessionId);

    let projectedQuestion = null;
    let hasAnswered = false;
    let submittedIndices: readonly number[] | null = null;

    if (liveState.currentQuestionPosition > 0) {
      const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
      if (snapshot) {
        const rawQuestion = snapshot.questions.find(q => q.position === liveState.currentQuestionPosition);
        if (rawQuestion) {
          projectedQuestion = projectQuestionForParticipant(rawQuestion);
        }
      }

      const existingSubmission = this.repo.getParticipantSubmission(
        sessionId,
        liveState.currentQuestionPosition,
        participant.userId
      );
      if (existingSubmission) {
        hasAnswered = true;
        submittedIndices = existingSubmission.selectedOptionIndices;
      }
    }

    return {
      sessionId: liveState.sessionId,
      sessionStatus: liveState.sessionStatus,
      stateVersion: liveState.stateVersion,
      totalQuestions: liveState.totalQuestions,
      currentQuestionPosition: liveState.currentQuestionPosition,
      questionLifecycleState: liveState.questionLifecycleState,
      question: projectedQuestion,
      questionOpenedAt: liveState.questionOpenedAt,
      answerDeadlineAt: liveState.answerDeadlineAt,
      timeLimitSeconds: liveState.timeLimitSeconds,
      serverTime: new Date().toISOString(),
      hasAnswered,
      submittedOptionIndices: submittedIndices
    };
  }

  getHostLiveView(sessionId: string, hostUserId: string): HostLiveView {
    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) throw new NotSessionHostError();

    const liveState = this.repo.getLiveSessionState(sessionId);
    if (!liveState) throw new SessionNotFoundError(sessionId);

    const snapshot = this.repo.getPublishedQuizSnapshot(session.publishedQuizSnapshotId);
    const rawQuestion = snapshot?.questions.find(q => q.position === liveState.currentQuestionPosition) ?? null;

    const totalSubmissions = liveState.currentQuestionPosition > 0
      ? this.repo.getSubmissionCountForQuestion(sessionId, liveState.currentQuestionPosition)
      : 0;

    const participants = this.repo.listParticipants(sessionId);

    return {
      state: liveState,
      currentQuestion: rawQuestion,
      totalSubmissionsForCurrentQuestion: totalSubmissions,
      activeParticipantCount: participants.length
    };
  }

  reconnectParticipant(
    sessionId: string,
    token: ParticipantToken,
    lastSeenSequence: number = 0
  ): { view: ParticipantLiveView; missedEvents: readonly LiveQuizEvent[] } {
    const view = this.getParticipantLiveView(sessionId, token);
    const missedEvents = this.transport ? this.transport.getHistory(sessionId, lastSeenSequence, 'participant') : [];
    return { view, missedEvents };
  }
}
