import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  SessionStatus,
  derivePersonalTenantId,
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  ScoringStyle,
  QuestionLifecycleState,
  SqliteQuestionRepository,
  SqliteQuizRepository,
  SqliteSessionRepository,
  QuestionBankService,
  QuizService,
  SessionService,
  InMemoryRateLimiter,
  LiveQuizService,
  InMemoryRealtimeTransport,
  LiveQuizEventType,
  LiveQuizEvent,
  InvalidLiveStateTransitionError,
  AnswerDeadlineExpiredError,
  DuplicateAnswerSubmissionError,
  NotSessionHostError,
  SessionNotActiveError,
  InvalidQuestionChoiceError,
  ConcurrencyConflictError,
  RateLimitExceededError,
  type Clock
} from '../src/index';

import { NextRequest } from 'next/server';
import { GET as liveSseRoute } from '../src/app/api/session/[id]/live/route';

import {
  setAuthorizedTeacherContext,
  setAuthenticatedUserContext,
  setSessionRepository,
  setSessionService,
  setRateLimiter,
  setQuizService,
  setQuestionBankService,
  setRealtimeTransport,
  setLiveQuizService
} from '../src/app/teacher/review/db';

import {
  startLiveQuizAction,
  openQuestionAction,
  lockQuestionAction,
  advanceQuestionAction,
  completeLiveQuizAction,
  getHostLiveViewAction,
  submitAnswerAction,
  getParticipantLiveViewAction,
  reconnectLiveSessionAction,
  submitGroupAnswerAction
} from '../src/app/session/live-actions';

function seedUser(sharedDb: DatabaseSync, id: string, name: string = id) {
  sharedDb.prepare(`
    INSERT OR IGNORE INTO users (id, email, display_name, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, `${id}@example.test`, name, new Date().toISOString());
}

function setupTestEnvironment(rateLimiterOptions?: { maxLiveMutationsPer5Seconds?: number }) {
  const sharedDb = new DatabaseSync(':memory:');
  let testClockFn: (() => number) | null = null;
  const testClock: Clock = {
    nowMs: () => (testClockFn ? testClockFn() : Date.now()),
    nowIso: () => new Date(testClockFn ? testClockFn() : Date.now()).toISOString()
  };

  const questionRepo = new SqliteQuestionRepository(sharedDb);
  const quizRepo = new SqliteQuizRepository(sharedDb);
  const sessionRepo = new SqliteSessionRepository(sharedDb, testClock);

  const bankService = new QuestionBankService(questionRepo);
  const quizService = new QuizService(quizRepo);
  const rateLimiter = new InMemoryRateLimiter(undefined, rateLimiterOptions);
  const sessionService = new SessionService(sessionRepo, rateLimiter);
  const realtimeTransport = new InMemoryRealtimeTransport();
  const liveQuizService = new LiveQuizService(sessionRepo, rateLimiter, realtimeTransport, testClock);

  setSessionRepository(sessionRepo);
  setQuestionBankService(bankService);
  setQuizService(quizService);
  setSessionService(sessionService);
  setRateLimiter(rateLimiter);
  setRealtimeTransport(realtimeTransport);
  setLiveQuizService(liveQuizService);

  // Pre-seed participants and test users for foreign key satisfaction
  seedUser(sharedDb, 'pupil_timer_1', 'Quick Pupil');
  seedUser(sharedDb, 'pupil_late_2', 'Late Pupil');
  seedUser(sharedDb, 'pupil_honest_1', 'Honest Pupil');
  seedUser(sharedDb, 'pupil_recon_1', 'Travelling Pupil');
  seedUser(sharedDb, 'user_action_pupil', 'Action Pupil');
  seedUser(sharedDb, 'user_participant_1', 'Participant 1');
  seedUser(sharedDb, 'user_intruder', 'Intruder');
  seedUser(sharedDb, 'pupil_timing_1', 'Timing Pupil 1');
  seedUser(sharedDb, 'user_replay_pupil', 'Replay Pupil');
  seedUser(sharedDb, 'pupil_boundary_1', 'Boundary Pupil 1');
  seedUser(sharedDb, 'pupil_act_1', 'Action Pupil');
  seedUser(sharedDb, 'pupil_sse_1', 'SSE Pupil');
  seedUser(sharedDb, 'teacher_intruder', 'Intruder Teacher');
  seedUser(sharedDb, 'pupil_auth_1', 'Authoritative Pupil');
  seedUser(sharedDb, 'pupil_replay_1', 'Replay Pupil');
  seedUser(sharedDb, 'pupil_race_1', 'Race Pupil');
  seedUser(sharedDb, 'pupil_race_2', 'Race Pupil 2');
  seedUser(sharedDb, 'pupil_race_3', 'Race Pupil 3');

  return {
    sharedDb,
    questionRepo,
    quizRepo,
    sessionRepo,
    bankService,
    quizService,
    sessionService,
    rateLimiter,
    realtimeTransport,
    liveQuizService,
    setTestClock: (fn: (() => number) | null) => {
      testClockFn = fn;
    }
  };
}

async function seedMultiQuestionQuiz(
  bankService: QuestionBankService,
  quizService: QuizService,
  orgId: string,
  userId: string,
  questionCount: number = 3
): Promise<string> {
  setAuthorizedTeacherContext({
    userId,
    organizationId: orgId,
    displayName: 'Teacher ' + userId,
    role: 'teacher'
  });

  const db = (quizService as any).repo?.getDatabase?.();
  if (db) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, `${userId}@example.test`, 'Teacher ' + userId, new Date().toISOString());
  }

  const questionIds: string[] = [];
  for (let i = 1; i <= questionCount; i++) {
    const q = await bankService.createQuestion({
      organizationId: orgId,
      stem: `Question ${i}: What happened in Scripture on day ${i}?`,
      type: QuestionType.MULTIPLE_CHOICE,
      options: [`Option A for Q${i}`, `Option B for Q${i}`, `Option C for Q${i}`, `Option D for Q${i}`],
      correctOptionIndices: [0],
      explanation: `Scriptural explanation for Q${i}`,
      scriptureReference: `Genesis 1:${i}`,
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    await bankService.transitionStatus(orgId, q.id, QuestionStatus.PENDING_REVIEW);
    await bankService.transitionStatus(orgId, q.id, QuestionStatus.APPROVED);
    questionIds.push(q.id);
  }

  const quiz = await quizService.createQuiz(orgId, {
    organizationId: orgId,
    title: 'Genesis Quiz',
    description: 'Study of early Genesis',
    defaultTimeLimitSeconds: 20,
    scoringStyle: ScoringStyle.STANDARD
  });

  for (const qid of questionIds) {
    await quizService.addQuestion(orgId, quiz.id, qid);
  }

  const snapshot = await quizService.publishQuiz(orgId, quiz.id, userId);
  return snapshot.id;
}

test('BAREA-007: Live Quiz Authoritative State Machine, Transport & Adversarial Boundary Tests', async (t) => {

  await t.test('1. Session State Machine Transitions (LOBBY -> ACTIVE -> COMPLETED)', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_host_1';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 3);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    let liveState = await env.sessionRepo.getLiveSessionState(session.id);
    assert.ok(liveState);
    assert.equal(liveState.sessionStatus, SessionStatus.LOBBY);
    assert.equal(liveState.questionLifecycleState, QuestionLifecycleState.NOT_STARTED);
    assert.equal(liveState.currentQuestionPosition, 0);
    assert.equal(liveState.stateVersion, 1);

    // Transition LOBBY -> ACTIVE
    const { liveState: activeState } = await env.liveQuizService.startLiveQuiz(session.id, hostId);
    assert.equal(activeState.sessionStatus, SessionStatus.ACTIVE);
    assert.equal(activeState.currentQuestionPosition, 1);
    assert.equal(activeState.questionLifecycleState, QuestionLifecycleState.ANSWERING);
    assert.equal(activeState.stateVersion, 2);

    // Invalid transition: cannot start an already active session
    await assert.rejects(async () => {
      await env.liveQuizService.startLiveQuiz(session.id, hostId);
    }, InvalidLiveStateTransitionError);

    // Lock question 1
    const { liveState: lockedQ1 } = await env.liveQuizService.lockQuestion(session.id, hostId);
    assert.equal(lockedQ1.currentQuestionPosition, 1);
    assert.equal(lockedQ1.questionLifecycleState, QuestionLifecycleState.LOCKED);
    assert.equal(lockedQ1.stateVersion, 3);

    // Advance to question 2
    const { liveState: advancedQ2 } = await env.liveQuizService.advanceQuestion(session.id, hostId);
    assert.equal(advancedQ2.currentQuestionPosition, 2);
    assert.equal(advancedQ2.questionLifecycleState, QuestionLifecycleState.ANSWERING);
    assert.equal(advancedQ2.stateVersion, 4);

    // Lock question 2
    const { liveState: lockedQ2 } = await env.liveQuizService.lockQuestion(session.id, hostId);
    assert.equal(lockedQ2.currentQuestionPosition, 2);
    assert.equal(lockedQ2.questionLifecycleState, QuestionLifecycleState.LOCKED);

    // Advance to question 3
    const { liveState: advancedQ3 } = await env.liveQuizService.advanceQuestion(session.id, hostId);
    assert.equal(advancedQ3.currentQuestionPosition, 3);
    assert.equal(advancedQ3.questionLifecycleState, QuestionLifecycleState.ANSWERING);

    // Complete session
    const { liveState: completedState } = await env.liveQuizService.completeLiveQuiz(session.id, hostId);
    assert.equal(completedState.sessionStatus, SessionStatus.COMPLETED);
    assert.equal(completedState.questionLifecycleState, QuestionLifecycleState.COMPLETED);

    // Completed session rejects any further mutations
    await assert.rejects(async () => {
      await env.liveQuizService.openQuestion(session.id, hostId);
    }, SessionNotActiveError);

    await assert.rejects(async () => {
      await env.liveQuizService.startLiveQuiz(session.id, hostId);
    }, InvalidLiveStateTransitionError);
  });

  await t.test('2. Host Authorization & IDOR Boundary Defense', async () => {
    const env = setupTestEnvironment();
    const legitHostId = 'teacher_legit';
    const attackerHostId = 'teacher_attacker';
    const orgId = derivePersonalTenantId(legitHostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, legitHostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: legitHostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // Attacker teacher attempts to start legit host's session -> NotSessionHostError
    await assert.rejects(async () => {
      await env.liveQuizService.startLiveQuiz(session.id, attackerHostId);
    }, NotSessionHostError);

    // Attacker attempts other mutations
    await assert.rejects(async () => {
      await env.liveQuizService.openQuestion(session.id, attackerHostId);
    }, NotSessionHostError);

    await assert.rejects(async () => {
      await env.liveQuizService.lockQuestion(session.id, attackerHostId);
    }, NotSessionHostError);

    await assert.rejects(async () => {
      await env.liveQuizService.advanceQuestion(session.id, attackerHostId);
    }, NotSessionHostError);

    await assert.rejects(async () => {
      await env.liveQuizService.completeLiveQuiz(session.id, attackerHostId);
    }, NotSessionHostError);

    await assert.rejects(async () => {
      await env.liveQuizService.getHostLiveView(session.id, attackerHostId);
    }, NotSessionHostError);

    // Server actions also enforce host context
    setAuthorizedTeacherContext({
      userId: attackerHostId,
      organizationId: derivePersonalTenantId(attackerHostId),
      displayName: 'Attacker Teacher',
      role: 'teacher'
    });

    const actionRes = await startLiveQuizAction(session.id);
    assert.equal(actionRes.success, false);
    if (!actionRes.success) {
      assert.equal(actionRes.error.code, 'NOT_SESSION_HOST');
      assert.equal(actionRes.error.httpStatus, 403);
    }
  });

  await t.test('3. Server-Authoritative Time & Deadline Enforcement', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_timer';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_timer_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_timer_1',
      verifiedEmail: 'pupil1@test.org',
      verifiedPhone: null,
      displayName: 'Quick Pupil'
    });

    const beforeOpen = Date.now();
    const { liveState } = await env.liveQuizService.startLiveQuiz(session.id, hostId);
    assert.ok(liveState.answerDeadlineAt);
    const actualDeadline = new Date(liveState.answerDeadlineAt).getTime();
    assert.ok(actualDeadline >= beforeOpen + 19_000);

    // Valid submission before deadline
    const sub = await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [0],
      clientTimestamp: new Date().toISOString()
    });
    assert.ok(sub);
    assert.equal(sub.userId, 'pupil_timer_1');
    assert.deepEqual(sub.selectedOptionIndices, [0]);
    assert.equal(sub.isWithinDeadline, true);

    // Late submission simulation: artifically expire deadline in DB
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    env.sharedDb.prepare(`
      UPDATE session_live_states
      SET answer_deadline_at = ?
      WHERE session_id = ?
    `).run(expiredTime, session.id);

    const latePupilToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_late_2',
      providerType: 'GOOGLE',
      providerSub: 'sub_late_2',
      verifiedEmail: 'pupil2@test.org',
      verifiedPhone: null,
      displayName: 'Late Pupil'
    });

    // Submitting after authoritative deadline must strictly throw AnswerDeadlineExpiredError
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: latePupilToken.token,
        questionPosition: 1,
        selectedOptionIndices: [0],
        clientTimestamp: new Date(Date.now() - 5000).toISOString() // Even if client lies about timestamp!
      });
    }, AnswerDeadlineExpiredError);
  });

  await t.test('4. Participant Duplicate Submission Policy & Choice Validation', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_sub';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_honest_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_honest_1',
      verifiedEmail: 'honest@test.org',
      verifiedPhone: null,
      displayName: 'Honest Pupil'
    });

    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // Invalid choice indices
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [99], // Out of bounds
        clientTimestamp: new Date().toISOString()
      });
    }, InvalidQuestionChoiceError);

    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [-1], // Negative
        clientTimestamp: new Date().toISOString()
      });
    }, InvalidQuestionChoiceError);

    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [], // Empty
        clientTimestamp: new Date().toISOString()
      });
    }, InvalidQuestionChoiceError);

    // First accepted answer wins
    const firstSub = await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [1],
      clientTimestamp: new Date().toISOString()
    });
    assert.deepEqual(firstSub.selectedOptionIndices, [1]);

    // Second submission must throw DuplicateAnswerSubmissionError
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [0], // Changed mind
        clientTimestamp: new Date().toISOString()
      });
    }, DuplicateAnswerSubmissionError);
  });

  await t.test('5. Optimistic Concurrency & Monotonic Versioning', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_conc';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const { liveState: startState } = await env.liveQuizService.startLiveQuiz(session.id, hostId);
    assert.equal(startState.stateVersion, 2);

    // Successful mutation with matching expectedVersion (2)
    const { liveState: lockState } = await env.liveQuizService.lockQuestion(session.id, hostId, 2);
    assert.equal(lockState.stateVersion, 3);

    // Mismatched expectedVersion throws ConcurrencyConflictError
    await assert.rejects(async () => {
      await env.liveQuizService.openQuestion(session.id, hostId, 2); // Expected 2, but actual is 3
    }, ConcurrencyConflictError);

    // Supplying current expectedVersion (3) succeeds
    const { liveState: openState } = await env.liveQuizService.openQuestion(session.id, hostId, 3);
    assert.equal(openState.stateVersion, 4);
  });

  await t.test('6. Group Answer Submissions in Teacher-Controlled Group Mode', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_group';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });

    // Create groups
    const group1 = await env.sessionService.createGroup(session.id, hostId, 'Lions');
    const group2 = await env.sessionService.createGroup(session.id, hostId, 'Eagles');

    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // Teacher submits on behalf of Lions
    const groupSub = await env.liveQuizService.submitGroupAnswer({
      sessionId: session.id,
      hostUserId: hostId,
      groupId: group1.id,
      questionPosition: 1,
      selectedOptionIndices: [0]
    });

    assert.equal(groupSub.sessionGroupId, group1.id);
    assert.deepEqual(groupSub.selectedOptionIndices, [0]);

    // Duplicate submission for group 1 rejected
    await assert.rejects(async () => {
      await env.liveQuizService.submitGroupAnswer({
        sessionId: session.id,
        hostUserId: hostId,
        groupId: group1.id,
        questionPosition: 1,
        selectedOptionIndices: [1]
      });
    }, DuplicateAnswerSubmissionError);

    // Group 2 can still submit
    const group2Sub = await env.liveQuizService.submitGroupAnswer({
      sessionId: session.id,
      hostUserId: hostId,
      groupId: group2.id,
      questionPosition: 1,
      selectedOptionIndices: [2]
    });
    assert.equal(group2Sub.sessionGroupId, group2.id);
  });

  await t.test('7. Realtime Transport: Session Isolation, Replay Buffer & Subscriber Projection', async () => {
    const env = setupTestEnvironment();
    const transport = env.realtimeTransport;

    const sessionA = 'session_alpha';
    const sessionB = 'session_beta';

    const eventsA: LiveQuizEvent[] = [];
    const eventsB: LiveQuizEvent[] = [];

    // Participant subscriber to Session A (role = 'participant')
    const unsubA = transport.subscribe({
      sessionId: sessionA,
      subscriberId: 'sub_participant_a',
      role: 'participant',
      onEvent: (e) => eventsA.push(e)
    });

    // Host subscriber to Session A (role = 'host')
    const hostEventsA: LiveQuizEvent[] = [];
    transport.subscribe({
      sessionId: sessionA,
      subscriberId: 'sub_host_a',
      role: 'host',
      onEvent: (e) => hostEventsA.push(e)
    });

    // Participant subscriber to Session B (role = 'participant')
    transport.subscribe({
      sessionId: sessionB,
      subscriberId: 'sub_participant_b',
      role: 'participant',
      onEvent: (e) => eventsB.push(e)
    });

    // Publish event on Session A with sensitive question payload
    transport.publish({
      eventId: 'evt_a1',
      eventType: LiveQuizEventType.QUESTION_OPENED,
      sessionId: sessionA,
      stateVersion: 3,
      timestamp: new Date().toISOString(),
      payload: {
        position: 1,
        stem: 'What is the first book of the Bible?',
        options: ['Genesis', 'Exodus'],
        correctOptionIndices: [0], // Sensitive!
        explanation: 'Genesis is the book of beginnings.' // Sensitive!
      }
    });

    // Publish event on Session B
    transport.publish({
      eventId: 'evt_b1',
      eventType: LiveQuizEventType.QUESTION_OPENED,
      sessionId: sessionB,
      stateVersion: 2,
      timestamp: new Date().toISOString(),
      payload: {
        position: 1,
        stem: 'Session B question'
      }
    });

    // Check session isolation
    assert.equal(eventsA.length, 1);
    assert.equal(eventsB.length, 1);
    assert.equal(eventsA[0].sessionId, sessionA);
    assert.equal(eventsB[0].sessionId, sessionB);

    // Check subscriber projection: participant must NOT see correctOptionIndices or explanation
    const participantPayload = eventsA[0].payload;
    assert.equal(participantPayload.stem, 'What is the first book of the Bible?');
    assert.equal((participantPayload as any).correctOptionIndices, undefined);
    assert.equal((participantPayload as any).explanation, undefined);

    // Host DOES see correctOptionIndices and explanation
    assert.equal(hostEventsA.length, 1);
    const hostPayload = hostEventsA[0].payload;
    assert.deepEqual((hostPayload as any).correctOptionIndices, [0]);
    assert.equal((hostPayload as any).explanation, 'Genesis is the book of beginnings.');

    // Check replay buffer / history
    const replayEvents = transport.getHistory(sessionA, 0);
    assert.equal(replayEvents.length, 1);
    assert.equal(replayEvents[0].sequenceNumber, 1);

    // Unsubscribe
    unsubA();
    assert.equal(transport.getSubscriberCount(sessionA), 1); // Host remains
  });

  await t.test('8. Participant Reconnection & State Catch-up', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_recon';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_recon_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_recon_1',
      verifiedEmail: 'recon@test.org',
      verifiedPhone: null,
      displayName: 'Travelling Pupil'
    });

    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // Participant submits answer
    await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [2],
      clientTimestamp: new Date().toISOString()
    });

    // Simulate page refresh / disconnect and reconnect
    const reconView = await env.liveQuizService.getParticipantLiveView(session.id, participantToken.token);
    assert.equal(reconView.sessionId, session.id);
    assert.equal(reconView.currentQuestionPosition, 1);
    assert.equal(reconView.questionLifecycleState, QuestionLifecycleState.ANSWERING);
    assert.equal(reconView.hasAnswered, true);
    assert.deepEqual(reconView.submittedOptionIndices, [2]);
    assert.ok(reconView.answerDeadlineAt);

    // Question projection to participant has NO secret answers
    assert.ok(reconView.question);
    assert.equal((reconView.question as any).correctOptionIndices, undefined);
    assert.equal((reconView.question as any).explanation, undefined);
  });

  await t.test('9. Rate Limiting of Live Mutations', async () => {
    const env = setupTestEnvironment({ maxLiveMutationsPer5Seconds: 4 });
    const hostId = 'teacher_ratelimit';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 10);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // Start session uses 1 mutation
    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // 3 more mutations (total 4)
    await env.liveQuizService.lockQuestion(session.id, hostId);
    await env.liveQuizService.advanceQuestion(session.id, hostId);
    await env.liveQuizService.lockQuestion(session.id, hostId);

    // 5th mutation exceeds maxLiveMutationsPer5Seconds (4) and throws RateLimitExceededError
    await assert.rejects(async () => {
      await env.liveQuizService.advanceQuestion(session.id, hostId);
    }, RateLimitExceededError);
  });

  await t.test('10. Server Actions & Sanitization Boundary', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_actions';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 3);

    setAuthorizedTeacherContext({
      userId: hostId,
      organizationId: orgId,
      displayName: 'Teacher Actions',
      role: 'teacher'
    });

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_act_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_act_1',
      verifiedEmail: 'act@test.org',
      verifiedPhone: null,
      displayName: 'Action Pupil'
    });

    // Start live quiz via server action
    const startRes = await startLiveQuizAction(session.id);
    assert.equal(startRes.success, true);
    if (startRes.success) {
      assert.equal(startRes.data.session.status, SessionStatus.ACTIVE);
      assert.equal(startRes.data.liveState.questionLifecycleState, QuestionLifecycleState.ANSWERING);
    }

    // Participant submit answer action
    const submitRes = await submitAnswerAction({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [0],
      clientTimestamp: new Date().toISOString()
    });
    assert.equal(submitRes.success, true);
    if (submitRes.success) {
      assert.ok(submitRes.data.submissionId);
    }

    // Duplicate answer submission returns DUPLICATE_ANSWER_SUBMISSION (409)
    const dupRes = await submitAnswerAction({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [1],
      clientTimestamp: new Date().toISOString()
    });
    assert.equal(dupRes.success, false);
    if (!dupRes.success) {
      assert.equal(dupRes.error.code, 'DUPLICATE_ANSWER_SUBMISSION');
      assert.equal(dupRes.error.httpStatus, 409);
    }

    // Lock question
    const lockRes = await lockQuestionAction(session.id);
    assert.equal(lockRes.success, true);
    if (lockRes.success) {
      assert.equal(lockRes.data.liveState.questionLifecycleState, QuestionLifecycleState.LOCKED);
    }

    // Get Host live view
    const hostViewRes = await getHostLiveViewAction(session.id);
    assert.equal(hostViewRes.success, true);
    if (hostViewRes.success) {
      assert.equal(hostViewRes.data.totalSubmissionsForCurrentQuestion, 1);
      assert.ok(hostViewRes.data.currentQuestion?.correctOptionIndices); // Host can see answers
    }

    // Get Participant live view
    const partViewRes = await getParticipantLiveViewAction(session.id, participantToken.token);
    assert.equal(partViewRes.success, true);
    if (partViewRes.success) {
      assert.equal(partViewRes.data.hasAnswered, true);
      assert.equal((partViewRes.data.question as any)?.correctOptionIndices, undefined); // Hidden
    }
  });

  await t.test('11. Adversarial SSE Authorization & Projection Isolation (PR #11 Blocker Remediation)', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_sse_host';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_sse_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_sse_1',
      verifiedEmail: 'sse1@test.org',
      verifiedPhone: null,
      displayName: 'SSE Pupil'
    });

    // 1. Unauthenticated caller cannot obtain host SSE projection by ?role=host
    setAuthorizedTeacherContext(null);
    const unauthHostReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?role=host`);
    const unauthHostRes = await liveSseRoute(unauthHostReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(unauthHostRes.status, 401);
    const unauthHostBody = await unauthHostRes.json();
    assert.equal(unauthHostBody.error, 'UNAUTHORIZED');
    assert.equal(unauthHostBody.message, 'Teacher authentication failed.');
    // Regression check: verify no internal runtime strings or error objects are leaked
    assert.strictEqual(unauthHostBody.message.includes('runtime'), false);
    assert.strictEqual(unauthHostBody.message.includes('test'), false);

    // 1b. Regression test: SSE host-authentication error leakage prevention
    // Raw exceptions (e.g. database corruption, filesystem paths, credentials) must NEVER leak to client
    const errorThrowingTeacher = new Proxy({} as import('../src/app/teacher/review/db').TeacherContext, {
      get(target, prop) {
        if (prop === 'userId') {
          throw new Error('CRITICAL SQLITE_CORRUPT: /var/secrets/teacher_key.sqlite disk image malformed');
        }
        return undefined;
      }
    });
    setAuthorizedTeacherContext(errorThrowingTeacher);
    const leakingHostReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?role=host`);
    const leakingHostRes = await liveSseRoute(leakingHostReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(leakingHostRes.status, 401);
    const leakingHostBody = await leakingHostRes.json();
    assert.equal(leakingHostBody.error, 'UNAUTHORIZED');
    assert.equal(leakingHostBody.message, 'Teacher authentication failed.');
    // Strictly verify raw internal error details are redacted
    assert.strictEqual(JSON.stringify(leakingHostBody).includes('SQLITE_CORRUPT'), false);
    assert.strictEqual(JSON.stringify(leakingHostBody).includes('/var/secrets/'), false);
    assert.strictEqual(JSON.stringify(leakingHostBody).includes('teacher_key.sqlite'), false);
    assert.strictEqual(JSON.stringify(leakingHostBody).includes('CRITICAL'), false);
    setAuthorizedTeacherContext(null);

    // 2. Participant caller supplying ?role=host receives 200 with PARTICIPANT projection, NEVER host projection
    const participantSpoofReq = new NextRequest(
      `http://localhost:3000/api/session/${session.id}/live?role=host&token=${participantToken.token}`
    );
    const participantSpoofRes = await liveSseRoute(participantSpoofReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(participantSpoofRes.status, 200); // Allowed to stream as participant
    assert.equal(participantSpoofRes.headers.get('content-type'), 'text/event-stream');

    const spoofReader = participantSpoofRes.body?.getReader();
    assert.ok(spoofReader);
    // Publish a sensitive live event while participant is subscribed with ?role=host
    env.realtimeTransport.publish({
      eventId: 'evt_spoof_check',
      eventType: LiveQuizEventType.QUESTION_OPENED,
      sessionId: session.id,
      stateVersion: 10,
      timestamp: new Date().toISOString(),
      payload: {
        position: 1,
        stem: 'Spoof Check Question',
        correctOptionIndices: [0],
        explanation: 'Sensitive Explanation for Spoof Check'
      }
    });

    let liveSpoofText = '';
    const textDecoder = new TextDecoder();
    for (let i = 0; i < 5; i++) {
      const { value, done } = await spoofReader.read();
      if (done) break;
      if (value) liveSpoofText += textDecoder.decode(value);
      if (liveSpoofText.includes('evt_spoof_check')) break;
    }
    await spoofReader.cancel();

    assert.ok(liveSpoofText.includes('evt_spoof_check'));
    assert.strictEqual(liveSpoofText.includes('correctOptionIndices'), false);
    assert.strictEqual(liveSpoofText.includes('Sensitive Explanation for Spoof Check'), false);

    // 3. Non-host authenticated teacher cannot obtain host SSE projection (IDOR rejection)
    setAuthorizedTeacherContext({
      userId: 'teacher_intruder',
      organizationId: 'org_intruder',
      displayName: 'Intruder Teacher',
      role: 'teacher'
    });
    const nonHostReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?role=host`);
    const nonHostRes = await liveSseRoute(nonHostReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(nonHostRes.status, 403);
    const nonHostBody = await nonHostRes.json();
    assert.equal(nonHostBody.error, 'NOT_SESSION_HOST');

    // 4. Authenticated session host receives host projection WITHOUT needing a client ?role=host claim
    setAuthorizedTeacherContext({
      userId: hostId,
      organizationId: orgId,
      displayName: 'Legit Host',
      role: 'teacher'
    });
    const hostNoRoleReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live`);
    const hostNoRoleRes = await liveSseRoute(hostNoRoleReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(hostNoRoleRes.status, 200);
    assert.equal(hostNoRoleRes.headers.get('content-type'), 'text/event-stream');

    // Host connecting with optional ?role=host also succeeds
    const hostReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?role=host`);
    const hostRes = await liveSseRoute(hostReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(hostRes.status, 200);
    assert.equal(hostRes.headers.get('content-type'), 'text/event-stream');

    // 5. Participant SSE requires valid token and receives ONLY participant projection
    setAuthorizedTeacherContext(null);

    // Missing token fails closed (401)
    const noTokenReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live`);
    const noTokenRes = await liveSseRoute(noTokenReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(noTokenRes.status, 401);

    // Invalid token format fails closed (400)
    const badTokenReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?token=bad-token!`);
    const badTokenRes = await liveSseRoute(badTokenReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(badTokenRes.status, 400);

    // Foreign token fails closed (403)
    const foreignToken = 'ptok_' + 'a'.repeat(43);
    const foreignTokenReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?token=${foreignToken}`);
    const foreignTokenRes = await liveSseRoute(foreignTokenReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(foreignTokenRes.status, 403);

    // Cross-session isolation: Session A credentials cannot subscribe to Session B
    const sessionB = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });
    const crossSessionReq = new NextRequest(`http://localhost:3000/api/session/${sessionB.id}/live?token=${participantToken.token}`);
    const crossSessionRes = await liveSseRoute(crossSessionReq, { params: Promise.resolve({ id: sessionB.id }) });
    assert.equal(crossSessionRes.status, 403);
    const crossSessionBody = await crossSessionRes.json();
    assert.equal(crossSessionBody.error, 'FORBIDDEN');

    // Valid participant token succeeds
    const validPartReq = new NextRequest(`http://localhost:3000/api/session/${session.id}/live?token=${participantToken.token}`);
    const validPartRes = await liveSseRoute(validPartReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(validPartRes.status, 200);
    assert.equal(validPartRes.headers.get('content-type'), 'text/event-stream');
  });

  await t.test('12. Authoritative Timing & Non-Current Question Boundary Enforcement (PR #11 Blocker Remediation)', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_authoritative';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 3);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_auth_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_auth_1',
      verifiedEmail: 'auth1@test.org',
      verifiedPhone: null,
      displayName: 'Authoritative Pupil'
    });

    // Start live quiz -> Question 1 active, answering
    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // Helper to count persisted submissions in database
    const getPersistedCount = (): number => {
      const row = env.sharedDb.prepare(
        'SELECT count(*) as count FROM session_answers WHERE session_id = ?'
      ).get(session.id) as { count: number };
      return row.count;
    };

    assert.equal(getPersistedCount(), 0);

    // 1. Answer for non-current question is rejected (current is 1, submitting for 2)
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 2, // Non-current!
        selectedOptionIndices: [0],
        clientTimestamp: new Date().toISOString()
      });
    }, (err: unknown) => err instanceof InvalidLiveStateTransitionError && err.message.includes('current active question is 1'));

    // Failed attempt created NO submission in DB
    assert.equal(getPersistedCount(), 0);

    // Attempt for question 0 or negative
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 0,
        selectedOptionIndices: [0]
      });
    }, InvalidLiveStateTransitionError);
    assert.equal(getPersistedCount(), 0);

    // 2. Answer after authoritative deadline is rejected
    // Artificially expire deadline in database to 2 seconds ago
    const pastDeadline = new Date(Date.now() - 2000).toISOString();
    env.sharedDb.prepare(
      'UPDATE session_live_states SET answer_deadline_at = ? WHERE session_id = ?'
    ).run(pastDeadline, session.id);

    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [0]
      });
    }, AnswerDeadlineExpiredError);

    // Failed deadline attempt created NO submission in DB
    assert.equal(getPersistedCount(), 0);

    // 3. ClientTimestamp cannot extend or bypass the deadline
    // Client claims submission was 10 minutes ago, before deadline
    const fakeClientTimestamp = new Date(Date.now() - 600_000).toISOString();
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [0],
        clientTimestamp: fakeClientTimestamp
      });
    }, AnswerDeadlineExpiredError);

    // Failed attempt created NO submission in DB
    assert.equal(getPersistedCount(), 0);

    // 4. Valid current-question answer before deadline is accepted
    // Restore deadline to future (+30s)
    const futureDeadline = new Date(Date.now() + 30_000).toISOString();
    env.sharedDb.prepare(
      'UPDATE session_live_states SET answer_deadline_at = ? WHERE session_id = ?'
    ).run(futureDeadline, session.id);

    const validSubmission = await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [0]
    });

    assert.ok(validSubmission);
    assert.equal(validSubmission.isWithinDeadline, true);
    assert.equal(validSubmission.questionPosition, 1);
    assert.deepEqual(validSubmission.selectedOptionIndices, [0]);

    // Valid attempt successfully created 1 submission in DB
    assert.equal(getPersistedCount(), 1);

    // 5. Subsequent duplicate attempt rejected, database count remains 1
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [1]
      });
    }, DuplicateAnswerSubmissionError);

    assert.equal(getPersistedCount(), 1);

    // 6. Group answer after deadline is rejected with zero persisted submissions
    const groupSession = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });
    const group1 = await env.sessionService.createGroup(groupSession.id, hostId, 'Team Lions');
    await env.liveQuizService.startLiveQuiz(groupSession.id, hostId);

    // Artificially expire group session deadline in database
    env.sharedDb.prepare(
      'UPDATE session_live_states SET answer_deadline_at = ? WHERE session_id = ?'
    ).run(pastDeadline, groupSession.id);

    await assert.rejects(async () => {
      await env.liveQuizService.submitGroupAnswer({
        sessionId: groupSession.id,
        hostUserId: hostId,
        groupId: group1.id,
        questionPosition: 1,
        selectedOptionIndices: [0]
      });
    }, AnswerDeadlineExpiredError);

    const getGroupPersistedCount = (): number => {
      const row = env.sharedDb.prepare(
        'SELECT count(*) as count FROM session_answers WHERE session_id = ?'
      ).get(groupSession.id) as { count: number };
      return row.count;
    };
    assert.equal(getGroupPersistedCount(), 0);

    // 7. Group answer before deadline is accepted
    env.sharedDb.prepare(
      'UPDATE session_live_states SET answer_deadline_at = ? WHERE session_id = ?'
    ).run(futureDeadline, groupSession.id);

    const validGroupSub = await env.liveQuizService.submitGroupAnswer({
      sessionId: groupSession.id,
      hostUserId: hostId,
      groupId: group1.id,
      questionPosition: 1,
      selectedOptionIndices: [0]
    });
    assert.ok(validGroupSub);
    assert.equal(validGroupSub.isWithinDeadline, true);
    assert.equal(validGroupSub.sessionGroupId, group1.id);
    assert.equal(getGroupPersistedCount(), 1);
  });

  await t.test('13. SSE & Service History Replay Canonical Projection Isolation (PR #11 Blocker Remediation)', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_replay_guard';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 2);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_replay_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_replay_1',
      verifiedEmail: 'replay1@test.org',
      verifiedPhone: null,
      displayName: 'Replay Pupil'
    });

    // Publish sensitive events directly to transport to build history log
    env.realtimeTransport.publish({
      eventId: 'evt_sensitive_1',
      eventType: LiveQuizEventType.QUESTION_OPENED,
      sessionId: session.id,
      stateVersion: 2,
      timestamp: new Date().toISOString(),
      payload: {
        position: 1,
        stem: 'What is the first book?',
        options: ['Genesis', 'Exodus'],
        correctOptionIndices: [0], // SENSITIVE
        explanation: 'Genesis is the book of beginnings.' // SENSITIVE
      }
    });

    env.realtimeTransport.publish({
      eventId: 'evt_sensitive_2',
      eventType: LiveQuizEventType.QUESTION_ADVANCED,
      sessionId: session.id,
      stateVersion: 3,
      timestamp: new Date().toISOString(),
      payload: {
        position: 2,
        question: {
          id: 'q_nested_2',
          stem: 'Second book?',
          options: ['Exodus', 'Leviticus'],
          correctOptionIndices: [0], // SENSITIVE
          explanation: 'Exodus is the second book.' // SENSITIVE
        }
      }
    });

    // 1. Participant reconnects via SSE with ?since=1
    // Clear teacher context so request runs as unauthenticated teacher / authenticated participant
    setAuthorizedTeacherContext(null);
    const sseReq = new NextRequest(
      `http://localhost:3000/api/session/${session.id}/live?token=${participantToken.token}&since=1`
    );
    const sseRes = await liveSseRoute(sseReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(sseRes.status, 200);

    const readUntilData = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> => {
      let text = '';
      const decoder = new TextDecoder();
      for (let i = 0; i < 5; i++) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) text += decoder.decode(value);
        if (text.includes('data:')) break;
      }
      return text;
    };

    const reader = sseRes.body?.getReader();
    assert.ok(reader);
    let sseText = '';
    try {
      sseText = await readUntilData(reader);
    } finally {
      await reader.cancel();
    }

    // Assert that replayed event 2 was sent
    assert.ok(sseText.includes('evt_sensitive_2'));
    // CRITICAL: Assert that NO sensitive field leaked in participant SSE replay stream
    assert.strictEqual(sseText.includes('correctOptionIndices'), false);
    assert.strictEqual(sseText.includes('Exodus is the second book.'), false);
    assert.strictEqual(sseText.includes('Genesis is the book of beginnings.'), false);

    // 2. Host reconnects via SSE without needing ?role=host query param (e.g. ?since=1)
    // Authenticated host authoritatively receives unredacted sensitive fields in replay
    setAuthorizedTeacherContext({
      userId: hostId,
      organizationId: orgId,
      displayName: 'Replay Host',
      role: 'teacher'
    });

    const hostSseReq = new NextRequest(
      `http://localhost:3000/api/session/${session.id}/live?since=1`
    );
    const hostSseRes = await liveSseRoute(hostSseReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(hostSseRes.status, 200);

    const hostReader = hostSseRes.body?.getReader();
    assert.ok(hostReader);
    let hostSseText = '';
    try {
      hostSseText = await readUntilData(hostReader);
    } finally {
      await hostReader.cancel();
    }
    setAuthorizedTeacherContext(null);

    assert.ok(hostSseText.includes('evt_sensitive_2'));
    assert.ok(hostSseText.includes('correctOptionIndices'));
    assert.ok(hostSseText.includes('Exodus is the second book.'));

    // 2b. Participant reconnects via SSE passing ?role=host&since=1
    // Effective role is derived as participant, replay must remain redacted
    const participantSpoofReplayReq = new NextRequest(
      `http://localhost:3000/api/session/${session.id}/live?role=host&token=${participantToken.token}&since=1`
    );
    const participantSpoofReplayRes = await liveSseRoute(participantSpoofReplayReq, { params: Promise.resolve({ id: session.id }) });
    assert.equal(participantSpoofReplayRes.status, 200);

    const participantSpoofReader = participantSpoofReplayRes.body?.getReader();
    assert.ok(participantSpoofReader);
    let participantSpoofSseText = '';
    try {
      participantSpoofSseText = await readUntilData(participantSpoofReader);
    } finally {
      await participantSpoofReader.cancel();
    }

    assert.ok(participantSpoofSseText.includes('evt_sensitive_2'));
    assert.strictEqual(participantSpoofSseText.includes('correctOptionIndices'), false);
    assert.strictEqual(participantSpoofSseText.includes('Exodus is the second book.'), false);

    // 3. Service reconnectParticipant / reconnectLiveSessionAction replay leak defense
    const reconnectResult = await reconnectLiveSessionAction(session.id, participantToken.token, 0);
    assert.equal(reconnectResult.success, true);
    if (reconnectResult.success) {
      assert.ok(reconnectResult.data.missedEvents.length >= 2);
      const missedJson = JSON.stringify(reconnectResult.data.missedEvents);
      // Canonical projection filter must have sanitized all replayed events
      assert.strictEqual(missedJson.includes('correctOptionIndices'), false);
      assert.strictEqual(missedJson.includes('Exodus is the second book.'), false);
      assert.strictEqual(missedJson.includes('Genesis is the book of beginnings.'), false);

      for (const evt of reconnectResult.data.missedEvents) {
        const payload = evt.payload as Record<string, unknown> | undefined;
        assert.strictEqual(payload?.correctOptionIndices, undefined);
        assert.strictEqual(payload?.explanation, undefined);
        const q = payload?.question as Record<string, unknown> | undefined;
        if (q) {
          assert.strictEqual(q.correctOptionIndices, undefined);
          assert.strictEqual(q.explanation, undefined);
        }
      }
    }

    // 4. Direct transport.getHistory with role projection
    const participantHistory = env.realtimeTransport.getHistory(session.id, 0, 'participant');
    const projectorHistory = env.realtimeTransport.getHistory(session.id, 0, 'projector');
    const hostHistory = env.realtimeTransport.getHistory(session.id, 0, 'host');

    assert.strictEqual(JSON.stringify(participantHistory).includes('correctOptionIndices'), false);
    assert.strictEqual(JSON.stringify(projectorHistory).includes('correctOptionIndices'), false);
    assert.ok(JSON.stringify(hostHistory).includes('correctOptionIndices'));
  });

  await t.test('14. Atomic Persistence-Boundary Deadline Enforcement & Concurrency Race Defense (PR #11 Blocker Remediation)', async () => {
    const env = setupTestEnvironment();
    const hostId = 'teacher_race_guard';
    const orgId = derivePersonalTenantId(hostId);
    const snapshotId = await seedMultiQuestionQuiz(env.bankService, env.quizService, orgId, hostId, 3);

    const session = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const participantToken = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_race_1',
      providerType: 'GOOGLE',
      providerSub: 'sub_race_1',
      verifiedEmail: 'race1@test.org',
      verifiedPhone: null,
      displayName: 'Race Pupil'
    });

    const participant2Token = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_race_2',
      providerType: 'GOOGLE',
      providerSub: 'sub_race_2',
      verifiedEmail: 'race2@test.org',
      verifiedPhone: null,
      displayName: 'Race Pupil 2'
    });

    // Start live quiz -> Question 1 active, answering
    await env.liveQuizService.startLiveQuiz(session.id, hostId);

    // Get deadline from live state
    const liveRow = env.sharedDb.prepare(
      'SELECT answer_deadline_at FROM session_live_states WHERE session_id = ?'
    ).get(session.id) as { answer_deadline_at: string };
    const deadlineMs = new Date(liveRow.answer_deadline_at).getTime();

    const getAnswerCount = (pos: number = 1): number => {
      const row = env.sharedDb.prepare(
        'SELECT count(*) as count FROM session_answers WHERE session_id = ? AND question_position = ?'
      ).get(session.id, pos) as { count: number };
      return row.count;
    };
    assert.equal(getAnswerCount(), 0);

    // 1. Mandatory Race-Boundary Regression Test:
    // Model: service/pre-check: deadline still open
    //        ↓ (logical delay / simulated passage of time)
    //        persistence decision: deadline expired
    //        ↓
    //        submission MUST NOT be inserted
    let serviceCheckOccurred = false;
    env.setTestClock(() => {
      if (!serviceCheckOccurred) {
        // First clock query: service pre-check (10 seconds before deadline)
        serviceCheckOccurred = true;
        return deadlineMs - 10_000;
      }
      // Subsequent clock query: inside persistence transaction (2 seconds after deadline)
      return deadlineMs + 2_000;
    });

    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [0]
      });
    }, AnswerDeadlineExpiredError);

    // CRITICAL: Verify zero rows inserted even though service pre-check passed!
    assert.equal(getAnswerCount(), 0);
    env.setTestClock(null);

    // 2. Teacher-Group Race-Boundary Regression Test:
    const groupSession = await env.sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: orgId,
      publishedQuizSnapshotId: snapshotId,
      hostUserId: hostId,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });
    const groupA = await env.sessionService.createGroup(groupSession.id, hostId, 'Team Alpha');
    await env.liveQuizService.startLiveQuiz(groupSession.id, hostId);

    const groupLiveRow = env.sharedDb.prepare(
      'SELECT answer_deadline_at FROM session_live_states WHERE session_id = ?'
    ).get(groupSession.id) as { answer_deadline_at: string };
    const groupDeadlineMs = new Date(groupLiveRow.answer_deadline_at).getTime();

    let groupServiceCheckOccurred = false;
    env.setTestClock(() => {
      if (!groupServiceCheckOccurred) {
        groupServiceCheckOccurred = true;
        return groupDeadlineMs - 5_000; // Open at service check
      }
      return groupDeadlineMs + 3_000; // Expired at persistence check
    });

    await assert.rejects(async () => {
      await env.liveQuizService.submitGroupAnswer({
        sessionId: groupSession.id,
        hostUserId: hostId,
        groupId: groupA.id,
        questionPosition: 1,
        selectedOptionIndices: [0]
      });
    }, AnswerDeadlineExpiredError);

    const getGroupAnswerCount = (): number => {
      const row = env.sharedDb.prepare(
        'SELECT count(*) as count FROM session_answers WHERE session_id = ?'
      ).get(groupSession.id) as { count: number };
      return row.count;
    };
    assert.equal(getGroupAnswerCount(), 0);
    env.setTestClock(null);

    // 3. Stale caller-supplied submittedAt or clientTimestamp cannot bypass deadline at persistence
    // Even if caller passes a fake past timestamp, the repository derives fresh server time
    env.setTestClock(() => deadlineMs + 5_000);
    await assert.rejects(async () => {
      await env.sessionRepo.recordAnswerSubmission({
        sessionId: session.id,
        questionPosition: 1,
        questionId: 'q_fake',
        userId: 'pupil_race_1',
        selectedOptionIndices: [0],
        submittedAt: new Date(deadlineMs - 60_000).toISOString(), // Stale claim before deadline
        clientTimestamp: new Date(deadlineMs - 60_000).toISOString()
      });
    }, AnswerDeadlineExpiredError);
    assert.equal(getAnswerCount(), 0);
    env.setTestClock(null);

    // 4. Concurrency / First-Write-Wins Verification:
    // Set clock before deadline so submissions are in valid window
    env.setTestClock(() => deadlineMs - 5_000);

    const firstSub = await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participantToken.token,
      questionPosition: 1,
      selectedOptionIndices: [0]
    });
    assert.ok(firstSub);
    assert.equal(firstSub.isWithinDeadline, true);
    assert.equal(getAnswerCount(), 1);

    // Competing/duplicate submission by same participant must be rejected
    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participantToken.token,
        questionPosition: 1,
        selectedOptionIndices: [1]
      });
    }, DuplicateAnswerSubmissionError);
    assert.equal(getAnswerCount(), 1);

    // Second participant CAN submit during open deadline
    const secondSub = await env.liveQuizService.submitParticipantAnswer({
      sessionId: session.id,
      token: participant2Token.token,
      questionPosition: 1,
      selectedOptionIndices: [2]
    });
    assert.ok(secondSub);
    assert.equal(secondSub.isWithinDeadline, true);
    assert.equal(getAnswerCount(), 2);

    // 5. No late submission can be persisted after authoritative deadline
    env.setTestClock(() => deadlineMs + 1_000);
    const participant3Token = await env.sessionService.joinSession(session.id, {
      userId: 'pupil_race_3',
      providerType: 'GOOGLE',
      providerSub: 'sub_race_3',
      verifiedEmail: 'race3@test.org',
      verifiedPhone: null,
      displayName: 'Race Pupil 3'
    });

    await assert.rejects(async () => {
      await env.liveQuizService.submitParticipantAnswer({
        sessionId: session.id,
        token: participant3Token.token,
        questionPosition: 1,
        selectedOptionIndices: [0]
      });
    }, AnswerDeadlineExpiredError);
    // Count remains 2
    assert.equal(getAnswerCount(), 2);
    env.setTestClock(null);
  });

});
