import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  SessionStatus,
  RoomCode,
  ParticipantToken,
  normalizeAndValidateRoomCode,
  validateParticipantToken,
  normalizeAllowlistEmail,
  normalizeAllowlistPhone,
  validateScheduledStartTime,
  derivePersonalTenantId,
  isPersonalTenantId,
  BareaDomainError,
  SessionNotFoundError,
  SessionClosedError,
  SessionLockedError,
  SessionFullError,
  SessionAccessDeniedError,
  CrossTenantSnapshotError,
  InvalidScheduledTimeError,
  InvalidRoomCodeError,
  InvalidParticipantTokenError,
  RateLimitExceededError,
  SqliteSessionRepository,
  SessionService,
  InMemoryRateLimiter,
  SqliteQuestionRepository,
  SqliteQuizRepository,
  QuestionBankService,
  QuizService,
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  QuizStatus,
  ScoringStyle
} from '../src/index';

import {
  setAuthorizedTeacherContext,
  setAuthenticatedUserContext,
  setTrustedClientIpForTesting,
  setMockRequestHeadersForTesting,
  resolveServerClientIp,
  setSessionService,
  setRateLimiter,
  setQuizService,
  setQuestionBankService
} from '../src/app/teacher/review/db';

import {
  createSessionAction,
  closeSessionAction,
  lockSessionAction,
  createSessionGroupAction,
  assignPupilAction,
  removePupilAction,
  deleteSessionGroupAction,
  getHostSessionRosterAction,
  lookupRoomAction,
  joinSessionAction,
  resumeSessionAction
} from '../src/app/session/actions';

function setupTestEnvironment() {
  const sharedDb = new DatabaseSync(':memory:');
  const questionRepo = new SqliteQuestionRepository(sharedDb);
  const quizRepo = new SqliteQuizRepository(sharedDb);
  const sessionRepo = new SqliteSessionRepository(sharedDb);

  const bankService = new QuestionBankService(questionRepo);
  const quizService = new QuizService(quizRepo);
  const rateLimiter = new InMemoryRateLimiter();
  const sessionService = new SessionService(sessionRepo, rateLimiter);

  setQuestionBankService(bankService);
  setQuizService(quizService);
  setSessionService(sessionService);
  setRateLimiter(rateLimiter);

  return { sharedDb, questionRepo, quizRepo, sessionRepo, bankService, quizService, sessionService, rateLimiter };
}

async function seedPublishedSnapshot(
  sharedDb: DatabaseSync,
  bankService: QuestionBankService,
  quizService: QuizService,
  orgId: string,
  userId: string,
  title: string = 'Faith Quiz'
): Promise<string> {
  setAuthorizedTeacherContext({
    userId,
    organizationId: orgId,
    displayName: 'Teacher ' + userId,
    role: 'teacher'
  });

  const q = await bankService.createQuestion({
    organizationId: orgId,
    stem: 'What is faith according to Hebrews 11:1?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['Confidence in what we hope for', 'Blind trust', 'Wishful thinking', 'A feeling'],
    correctOptionIndices: [0],
    explanation: 'Now faith is confidence in what we hope for and assurance about what we do not see.',
    scriptureReference: 'Hebrews 11:1',
    topic: 'Faith',
    difficulty: QuestionDifficulty.EASY,
    language: 'en'
  });

  await bankService.transitionStatus(orgId, q.id, QuestionStatus.PENDING_REVIEW);
  await bankService.transitionStatus(orgId, q.id, QuestionStatus.APPROVED);

  const quiz = await quizService.createQuiz(orgId, {
    organizationId: orgId,
    title,
    description: 'A study on faith',
    defaultTimeLimitSeconds: 30,
    scoringStyle: ScoringStyle.STANDARD
  });

  await quizService.addQuestion(orgId, quiz.id, q.id);
  const snapshot = await quizService.publishQuiz(orgId, quiz.id, userId);

  return snapshot.id;
}

test('BAREA-006 Share/Join: Adversarial, Multi-Tenant & Security Test Suite', async (t) => {

  await t.test('Option A: Personal Tenant Isolation & Cross-Tenant Rejection (ADV-TNT-01..05)', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const personalTenantA = derivePersonalTenantId('user_A');
    const personalTenantB = derivePersonalTenantId('user_B');
    const orgTenant1 = 'org_berea_central';
    const orgTenant2 = 'org_grace_fellowship';

    const snapPersonalA = await seedPublishedSnapshot(sharedDb, bankService, quizService, personalTenantA, 'user_A', 'Personal A Quiz');
    const snapPersonalB = await seedPublishedSnapshot(sharedDb, bankService, quizService, personalTenantB, 'user_B', 'Personal B Quiz');
    const snapOrg1 = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant1, 'teacher_org1', 'Org 1 Quiz');
    const snapOrg2 = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant2, 'teacher_org2', 'Org 2 Quiz');

    // ADV-TNT-01: Personal Creator A vs Personal Creator B Cross-Tenant Rejection
    await assert.rejects(async () => {
      await sessionService.createSession({
        workspaceType: WorkspaceType.PERSONAL,
        organizationId: personalTenantA,
        publishedQuizSnapshotId: snapPersonalB,
        hostUserId: 'user_A',
        participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
        admissionPolicy: AdmissionPolicy.OPEN
      });
    }, (err: unknown) => err instanceof CrossTenantSnapshotError || (err instanceof Error && err.message.includes('Tenant mismatch')));

    // Direct SQLite trigger verification for ADV-TNT-01
    assert.throws(() => {
      sharedDb.prepare(`
        INSERT INTO quiz_sessions (
          id, tenant_type, organization_id, published_quiz_snapshot_id, host_user_id,
          room_code, participation_mode, admission_policy, status, is_locked, state_version,
          max_participants, created_at, expires_at
        ) VALUES ('ses_evil_1', 'PERSONAL', ?, ?, 'user_A', '8K4M9Z', 'INDIVIDUAL_AUTHENTICATED', 'OPEN', 'LOBBY', 0, 1, 50, '2026-09-10T15:00:00Z', '2026-09-10T19:00:00Z')
      `).run(personalTenantA, snapPersonalB);
    }, /Tenant mismatch/);

    // ADV-TNT-02: Personal Creator referencing Organization Snapshot Rejection
    await assert.rejects(async () => {
      await sessionService.createSession({
        workspaceType: WorkspaceType.PERSONAL,
        organizationId: personalTenantA,
        publishedQuizSnapshotId: snapOrg1,
        hostUserId: 'user_A',
        participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
        admissionPolicy: AdmissionPolicy.OPEN
      });
    }, (err: unknown) => err instanceof CrossTenantSnapshotError || (err instanceof Error && err.message.includes('Tenant mismatch')));

    // ADV-TNT-03: Organization referencing Personal Creator Snapshot Rejection
    await assert.rejects(async () => {
      await sessionService.createSession({
        workspaceType: WorkspaceType.ORGANIZATION,
        organizationId: orgTenant1,
        publishedQuizSnapshotId: snapPersonalA,
        hostUserId: 'teacher_org1',
        participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
        admissionPolicy: AdmissionPolicy.OPEN
      });
    }, (err: unknown) => err instanceof CrossTenantSnapshotError || (err instanceof Error && err.message.includes('Tenant mismatch')));

    // ADV-TNT-04: Organization A referencing Organization B Snapshot Rejection
    await assert.rejects(async () => {
      await sessionService.createSession({
        workspaceType: WorkspaceType.ORGANIZATION,
        organizationId: orgTenant1,
        publishedQuizSnapshotId: snapOrg2,
        hostUserId: 'teacher_org1',
        participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
        admissionPolicy: AdmissionPolicy.OPEN
      });
    }, (err: unknown) => err instanceof CrossTenantSnapshotError || (err instanceof Error && err.message.includes('Tenant mismatch')));

    // Legitimate creation in Personal Workspace succeeds
    const legitPersonalSession = await sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: personalTenantA,
      publishedQuizSnapshotId: snapPersonalA,
      hostUserId: 'user_A',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });
    assert.equal(legitPersonalSession.organizationId, personalTenantA);

    // Legitimate creation in Organization Workspace succeeds
    const legitOrgSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant1,
      publishedQuizSnapshotId: snapOrg1,
      hostUserId: 'teacher_org1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });
    assert.equal(legitOrgSession.organizationId, orgTenant1);

    // ADV-TNT-05: Session Tenant & Snapshot Immutability Defense (trg_prevent_session_tenant_mutation)
    assert.throws(() => {
      sharedDb.prepare(`
        UPDATE quiz_sessions 
        SET organization_id = ? 
        WHERE id = ?
      `).run(orgTenant2, legitOrgSession.id);
    }, /IMMUTABILITY_VIOLATION/);

    assert.throws(() => {
      sharedDb.prepare(`
        UPDATE quiz_sessions 
        SET published_quiz_snapshot_id = ? 
        WHERE id = ?
      `).run(snapOrg2, legitOrgSession.id);
    }, /IMMUTABILITY_VIOLATION/);
  });

  await t.test('Management Authorization & IDOR Boundaries (ADV-TNT-06..08)', async () => {
    const { sharedDb, bankService, quizService } = setupTestEnvironment();

    const personalTenantA = derivePersonalTenantId('user_A');
    const personalTenantB = derivePersonalTenantId('user_B');
    const orgTenant = 'org_berea_central';

    const snapA = await seedPublishedSnapshot(sharedDb, bankService, quizService, personalTenantA, 'user_A', 'Personal A');
    const snapOrg = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'org_teacher_1', 'Org Quiz');

    // Create Personal A session via action
    setAuthorizedTeacherContext({
      userId: 'user_A',
      organizationId: personalTenantA,
      displayName: 'User A',
      role: 'teacher'
    });

    const createResA = await createSessionAction({
      workspaceType: WorkspaceType.PERSONAL,
      publishedQuizSnapshotId: snapA,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });
    assert.equal(createResA.success, true);
    if (!createResA.success) return;
    const sessionAId = createResA.data.id;

    // ADV-TNT-06: Cross-Personal Session Management IDOR Defense
    setAuthorizedTeacherContext({
      userId: 'user_B',
      organizationId: personalTenantB,
      displayName: 'User B',
      role: 'teacher'
    });

    const closeRes = await closeSessionAction(sessionAId);
    assert.equal(closeRes.success, false);
    assert.equal(closeRes.error?.code, 'SESSION_ACCESS_DENIED');

    const lockRes = await lockSessionAction(sessionAId, true);
    assert.equal(lockRes.success, false);
    assert.equal(lockRes.error?.code, 'SESSION_ACCESS_DENIED');

    const rosterRes = await getHostSessionRosterAction(sessionAId);
    assert.equal(rosterRes.success, false);
    assert.equal(rosterRes.error?.code, 'SESSION_ACCESS_DENIED');

    // ADV-TNT-07: Organization Member Tampering on Personal Session
    setAuthorizedTeacherContext({
      userId: 'org_admin_1',
      organizationId: orgTenant,
      displayName: 'Org Admin',
      role: 'admin'
    });

    const groupRes = await createSessionGroupAction(sessionAId, 'Subversive Group');
    assert.equal(groupRes.success, false);
    assert.equal(groupRes.error?.code, 'SESSION_ACCESS_DENIED');

    // Create Org Session
    const createOrgRes = await createSessionAction({
      workspaceType: WorkspaceType.ORGANIZATION,
      publishedQuizSnapshotId: snapOrg,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });
    assert.equal(createOrgRes.success, true);
    if (!createOrgRes.success) return;
    const orgSessionId = createOrgRes.data.id;

    // ADV-TNT-08: Personal Creator Tampering on Organization Session
    setAuthorizedTeacherContext({
      userId: 'user_A',
      organizationId: personalTenantA,
      displayName: 'User A',
      role: 'teacher'
    });

    const orgRosterRes = await getHostSessionRosterAction(orgSessionId);
    assert.equal(orgRosterRes.success, false);
    assert.equal(orgRosterRes.error?.code, 'SESSION_ACCESS_DENIED');
  });

  await t.test('Privacy, Namespace & Generic Lookup Defense (ADV-TNT-10..11, ADV-ENTRY-01..03)', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const personalTenant = derivePersonalTenantId('pastor_john');
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, personalTenant, 'pastor_john', 'Romans 8 Study');

    const session = await sessionService.createSession({
      workspaceType: WorkspaceType.PERSONAL,
      organizationId: personalTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'pastor_john',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.RESTRICTED,
      invitations: [
        { type: 'EMAIL', identifier: 'elder@church.org' },
        { type: 'PHONE', identifier: '+12125550199' }
      ]
    });

    // ADV-TNT-11: Public Lookup never exposes organization_id, host_user_id, or allowlists
    const publicInfo = await lookupRoomAction(session.roomCode);
    assert.equal(publicInfo.success, true);
    if (!publicInfo.success) return;

    assert.equal(publicInfo.data.quizTitle, 'Romans 8 Study');
    assert.equal(publicInfo.data.workspaceName, 'Personal Study');
    assert((publicInfo.data as unknown as Record<string, unknown>).organizationId === undefined);
    assert((publicInfo.data as unknown as Record<string, unknown>).hostUserId === undefined);
    assert((publicInfo.data as unknown as Record<string, unknown>).invitations === undefined);

    // ADV-ENTRY-03: Room code case-normalization
    const lowerCode = session.roomCode.toLowerCase();
    const caseRes = await lookupRoomAction(lowerCode);
    assert.equal(caseRes.success, true);
    if (caseRes.success) {
      assert.equal(caseRes.data.sessionId, session.id);
    }
  });

  await t.test('Authentication & Identity Security (ADV-AUTH-01..09)', async () => {
    const { sharedDb, bankService, quizService, sessionService, rateLimiter } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    const openSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // ADV-AUTH-06 & ADV-AUTH-07: Duplicate display names allowed; duplicate seats rehydrated
    setAuthenticatedUserContext({
      userId: 'user_david_1',
      providerType: 'GOOGLE',
      providerSub: 'google_sub_david_1',
      email: 'david1@gmail.com',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'David'
    });

    const join1 = await joinSessionAction(openSession.roomCode);
    assert.equal(join1.success, true);

    setAuthenticatedUserContext({
      userId: 'user_david_2',
      providerType: 'GOOGLE',
      providerSub: 'google_sub_david_2',
      email: 'david2@gmail.com',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'David'
    });

    const join2 = await joinSessionAction(openSession.roomCode);
    assert.equal(join2.success, true);
    if (join1.success && join2.success) {
      // Different participant IDs despite duplicate display name "David"
      assert.notEqual(join1.data.participantId, join2.data.participantId);
    }

    // ADV-AUTH-06: Same user joining again rehydrates seat with new token
    rateLimiter.resetUserJoin('user_david_1');
    setAuthenticatedUserContext({
      userId: 'user_david_1',
      providerType: 'GOOGLE',
      providerSub: 'google_sub_david_1',
      email: 'david1@gmail.com',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'David'
    });

    const reJoin = await joinSessionAction(openSession.roomCode);
    assert.equal(reJoin.success, true);
    if (join1.success && reJoin.success) {
      assert.equal(reJoin.data.participantId, join1.data.participantId);
    }

    // ADV-AUTH-08: Token replay across different sessions fails
    const otherSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    if (join1.success) {
      const resumeOther = await resumeSessionAction(otherSession.id, join1.data.token);
      assert.equal(resumeOther.success, false);
      assert.equal(resumeOther.error?.code, 'INVALID_PARTICIPANT_TOKEN');
    }

    // ADV-AUTH-09: Host cannot join their own live quiz session as a participant (incompatible role separation)
    setAuthenticatedUserContext({
      userId: 'teacher_1', // same as openSession.hostUserId
      providerType: 'GOOGLE',
      providerSub: 'google_sub_teacher_1',
      email: 'teacher1@church.org',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Teacher Host'
    });

    const hostJoinAttempt = await joinSessionAction(openSession.roomCode);
    assert.equal(hostJoinAttempt.success, false);
    assert.equal(hostJoinAttempt.error?.code, 'HOST_CANNOT_PARTICIPATE_IN_OWN_SESSION');
  });

  await t.test('Admission Policies & Generic Enumeration Defense (ADV-ADM-01..06)', async () => {
    const { sharedDb, bankService, quizService, sessionService, rateLimiter } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    const restrictedSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.RESTRICTED,
      invitations: [
        { type: 'EMAIL', identifier: 'alice@church.org' },
        { type: 'PHONE', identifier: '+12125550111' }
      ]
    });

    // ADV-ADM-02 & ADV-ADM-04: Uninvited user gets generic 404 (preventing allowlist enumeration)
    setAuthenticatedUserContext({
      userId: 'user_mallory',
      providerType: 'GOOGLE',
      providerSub: 'mallory_sub',
      email: 'mallory@attacker.com',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Mallory'
    });

    const uninvitedJoin = await joinSessionAction(restrictedSession.roomCode);
    assert.equal(uninvitedJoin.success, false);
    assert.equal(uninvitedJoin.error?.httpStatus, 404);

    // ADV-ADM-03: Invited user with case-insensitive email matches and joins
    setAuthenticatedUserContext({
      userId: 'user_alice',
      providerType: 'GOOGLE',
      providerSub: 'alice_sub',
      email: 'Alice@Church.ORG',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Alice'
    });

    const invitedJoin = await joinSessionAction(restrictedSession.roomCode);
    assert.equal(invitedJoin.success, true);

    // ADV-ADM-06: Teacher group lockout on direct join
    const groupSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });

    rateLimiter.resetUserJoin('user_alice');
    const groupJoin = await joinSessionAction(groupSession.roomCode);
    assert.equal(groupJoin.success, false);
    assert.equal(groupJoin.error?.httpStatus, 403);
  });

  await t.test('Teacher-Controlled Group Mode: Zero Devices for Pupils (ADV-TGRP-01..05)', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    setAuthorizedTeacherContext({
      userId: 'teacher_1',
      organizationId: orgTenant,
      displayName: 'Sunday School Teacher',
      role: 'teacher'
    });

    const session = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });

    // ADV-TGRP-01: Authorized teacher creates groups
    const g1 = await createSessionGroupAction(session.id, 'Red Team');
    const g2 = await createSessionGroupAction(session.id, 'Blue Team');
    assert.equal(g1.success, true);
    assert.equal(g2.success, true);
    if (!g1.success || !g2.success) return;

    // ADV-TGRP-03: Pupil Assignment - No child accounts or devices
    const p1 = await assignPupilAction(session.id, g1.data.id, 'Timothy');
    const p2 = await assignPupilAction(session.id, g1.data.id, 'Hannah');
    const p3 = await assignPupilAction(session.id, g2.data.id, 'Samuel');
    assert.equal(p1.success, true);
    assert.equal(p2.success, true);
    assert.equal(p3.success, true);

    // Verify roster retrieval
    const roster = await getHostSessionRosterAction(session.id);
    assert.equal(roster.success, true);
    if (roster.success && roster.data.groups) {
      assert.equal(roster.data.groups.length, 2);
      const red = roster.data.groups.find(g => g.groupName === 'Red Team');
      assert.equal(red?.pupils.length, 2);
      assert.deepEqual(red?.pupils.map(p => p.pupilName).sort(), ['Hannah', 'Timothy']);
    }

    // ADV-TGRP-02: Unauthorized user cannot create groups
    setAuthorizedTeacherContext({
      userId: 'intruder',
      organizationId: orgTenant,
      displayName: 'Intruder',
      role: 'teacher'
    });
    const badGroup = await createSessionGroupAction(session.id, 'Evil Team');
    assert.equal(badGroup.success, false);
    assert.equal(badGroup.error?.code, 'SESSION_ACCESS_DENIED');
  });

  await t.test('Church Wi-Fi / NAT Anti-Abuse: Zero Per-IP Quota (ADV-NAT-01..04)', async () => {
    const { sharedDb, bankService, quizService, sessionService, rateLimiter } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    const session = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN,
      maxParticipants: 100
    });

    const churchNatIp = '203.0.113.50';

    // ADV-NAT-01: 50 participants join behind the exact same church Wi-Fi NAT IP
    for (let i = 1; i <= 50; i++) {
      const res = await sessionService.joinSession(
        session.id,
        {
          userId: `student_${i}`,
          providerType: 'GOOGLE',
          providerSub: `sub_${i}`,
          verifiedEmail: `student${i}@church.org`,
          verifiedPhone: null,
          displayName: `Student ${i}`
        },
        churchNatIp
      );
      assert.ok(res.token);
    }

    const info = await sessionService.getPublicInfo(session.roomCode);
    assert.equal(info.participantCount, 50);

    // ADV-NAT-02: Rapid failed probes from an attacker IP are throttled
    const attackerIp = '198.51.100.77';
    for (let i = 0; i < 15; i++) {
      rateLimiter.recordFailedLookup(attackerIp);
    }

    await assert.rejects(async () => {
      await sessionService.getPublicInfo('ZZZZZZ' as RoomCode, attackerIp);
    }, (err: unknown) => err instanceof RateLimitExceededError);

    // ADV-NAT-03: Legitimate user on church NAT IP is completely unaffected (no global kill-switch)
    const legitCheck = await sessionService.getPublicInfo(session.roomCode, churchNatIp);
    assert.equal(legitCheck.quizTitle, 'Faith Quiz');
  });

  await t.test('Scheduled Start & Milestone Boundary (ADV-SCH-01..03)', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    // ADV-SCH-01: Past or non-UTC scheduled start time rejected
    await assert.rejects(async () => {
      await sessionService.createSession({
        workspaceType: WorkspaceType.ORGANIZATION,
        organizationId: orgTenant,
        publishedQuizSnapshotId: snap,
        hostUserId: 'teacher_1',
        participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
        admissionPolicy: AdmissionPolicy.OPEN,
        scheduledStartAt: '2020-01-01T00:00:00Z' // in the past
      });
    }, (err: unknown) => err instanceof InvalidScheduledTimeError);

    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const scheduledSession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN,
      scheduledStartAt: futureTime
    });

    // ADV-SCH-02: Status remains strictly LOBBY
    assert.equal(scheduledSession.status, SessionStatus.LOBBY);
    assert.equal(scheduledSession.scheduledStartAt, futureTime);

    // ADV-SCH-03: Active live state progression does not exist in BAREA-006
    const publicInfo = await sessionService.getPublicInfo(scheduledSession.roomCode);
    assert.equal(publicInfo.sessionStatus, SessionStatus.LOBBY);
    assert((publicInfo as unknown as Record<string, unknown>).questions === undefined);
  });

  await t.test('Concurrency & Capacity Enforcement (ADV-CONC-01..04)', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const orgTenant = 'org_berea';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_1');

    // ADV-CONC-01: Capacity Limit
    const tinySession = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN,
      maxParticipants: 3
    });

    for (let i = 1; i <= 3; i++) {
      await sessionService.joinSession(tinySession.id, {
        userId: `tiny_${i}`,
        providerType: 'GOOGLE',
        providerSub: `sub_tiny_${i}`,
        verifiedEmail: `tiny${i}@church.org`,
        verifiedPhone: null,
        displayName: `Tiny ${i}`
      });
    }

    await assert.rejects(async () => {
      await sessionService.joinSession(tinySession.id, {
        userId: 'tiny_4',
        providerType: 'GOOGLE',
        providerSub: 'sub_tiny_4',
        verifiedEmail: 'tiny4@church.org',
        verifiedPhone: null,
        displayName: 'Tiny 4'
      });
    }, (err: unknown) => err instanceof SessionFullError);
  });

  await t.test('Finding 1 Remediation: Server-Side IP Extraction & Anti-Spoofing', async () => {
    const { sharedDb, bankService, quizService, sessionService, rateLimiter } = setupTestEnvironment();

    const orgTenant = 'org_berea_security';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_sec');

    const session = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_sec',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN,
      maxParticipants: 100
    });

    setAuthenticatedUserContext({
      userId: 'user_probe',
      providerType: 'GOOGLE',
      providerSub: 'sub_probe_1',
      email: 'probe@church.org',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Probe User'
    });

    // 1. Verify that lookupRoomAction and joinSessionAction derive IP server-side via trusted resolver hook
    setTrustedClientIpForTesting('198.51.100.22');
    const lookup1 = await lookupRoomAction(session.roomCode);
    assert.equal(lookup1.success, true);
    if (lookup1.success) {
      assert.equal(lookup1.data.quizTitle, 'Faith Quiz');
    }

    // 2. Adversarial IP Spoofing Prevention: A client calling lookupRoomAction has no parameter to forge an IP.
    // Probing with an invalid room code records against the server-derived IP:
    for (let i = 0; i < 15; i++) {
      await lookupRoomAction('222222');
    }

    // The attacker's server-derived IP is now throttled:
    const throttledLookup = await lookupRoomAction(session.roomCode);
    assert.equal(throttledLookup.success, false);
    if (!throttledLookup.success) {
      assert.equal(throttledLookup.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(throttledLookup.error.httpStatus, 429);
    }

    // 3. Different trusted IP (e.g. church member behind church NAT) is NOT affected by attacker's throttling
    setTrustedClientIpForTesting('203.0.113.88');
    const legitLookup = await lookupRoomAction(session.roomCode);
    assert.equal(legitLookup.success, true);

    // 4. Church NAT: 50 participants can join through joinSessionAction from same NAT IP without IP seat quota
    setTrustedClientIpForTesting('203.0.113.88');
    for (let i = 1; i <= 50; i++) {
      setAuthenticatedUserContext({
        userId: `church_nat_member_${i}`,
        providerType: 'GOOGLE',
        providerSub: `sub_nat_${i}`,
        email: `nat${i}@church.org`,
        emailVerified: true,
        phone: null,
        phoneVerified: false,
        displayName: `Nat Member ${i}`
      });
      const joinRes = await joinSessionAction(session.roomCode);
      assert.equal(joinRes.success, true);
      assert.ok(joinRes.data?.participantId);
      assert.ok(joinRes.data?.token);
    }

    // Reset test client IP hook (return to unconfigured pre-deployment state where clientIp is null)
    setTrustedClientIpForTesting(null);

    // 5. PROVENANCE & DIRECT ATTACKER HEADER SPOOFING:
    // When direct (no proxy), attacker sending arbitrary forwarding headers cannot select IP
    delete process.env.BAREA_TRUSTED_PROXY;

    setMockRequestHeadersForTesting({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '203.0.113.11, 10.0.0.1',
      'x-real-ip': '203.0.113.12'
    });

    const directResolvedIp = await resolveServerClientIp();
    // Must resolve to null (unavailable/unknown), completely ignoring caller-controlled headers and NOT inventing 127.0.0.1
    assert.equal(directResolvedIp, null);

    // 6. CONFIGURED-BUT-DIRECT DEPLOYMENT ATTACK TEST:
    // Even if operator configured BAREA_TRUSTED_PROXY=cloudflare or reverse-proxy,
    // an attacker connecting directly cannot establish network provenance.
    // The application MUST NOT trust the forwarding header without verifiable network provenance,
    // marking forwarding headers NOT USED and remaining locked to null.
    process.env.BAREA_TRUSTED_PROXY = 'cloudflare';
    setMockRequestHeadersForTesting({
      'cf-connecting-ip': '203.0.113.100',
      'x-forwarded-for': '203.0.113.101',
      'x-real-ip': '203.0.113.102'
    });
    const cfDirectResolved = await resolveServerClientIp();
    assert.equal(cfDirectResolved, null);

    process.env.BAREA_TRUSTED_PROXY = 'reverse-proxy';
    setMockRequestHeadersForTesting({
      'cf-connecting-ip': '203.0.113.200',
      'x-forwarded-for': '203.0.113.201, 198.51.100.1',
      'x-real-ip': '203.0.113.202'
    });
    const proxyDirectResolved = await resolveServerClientIp();
    assert.equal(proxyDirectResolved, null);

    // 7. HEADER ATTACKS & MALFORMED PAYLOADS:
    // Conflicting headers, multiple XFF values, whitespace/SQL injection payloads return null
    setMockRequestHeadersForTesting({
      'cf-connecting-ip': 'invalid-ip-string; drop table',
      'x-forwarded-for': '198.51.100.1, 203.0.113.50, malformed-payload',
      'x-real-ip': '   203.0.113.99  \r\n'
    });
    const malformedResolved = await resolveServerClientIp();
    assert.equal(malformedResolved, null);

    // 8. EXACT-ROOM DoS ADVERSARIAL TEST:
    // An attacker knows the exact legitimate room code (`session.roomCode`).
    // In pre-deployment (clientIp === null), there is NO shared per-room failure bucket
    // and NO fabricated shared client IP.
    // An attacker repeatedly generating failed or rapid lookups targeting that exact room code
    // CANNOT exhaust a shared budget that blocks legitimate participants from accessing that session.
    rateLimiter.reset();

    // Attacker sends rapid repeated lookups / probes with attacker headers:
    for (let i = 0; i < 30; i++) {
      setMockRequestHeadersForTesting({
        'cf-connecting-ip': `198.51.100.${i + 1}`,
        'x-forwarded-for': `198.51.100.${i + 1}`,
        'x-real-ip': `198.51.100.${i + 1}`
      });
      await lookupRoomAction(session.roomCode);
    }

    // Attacker also attempts 20 non-existent room probes:
    for (let i = 0; i < 20; i++) {
      await lookupRoomAction('NONEXT');
    }

    // CRITICAL EXACT-ROOM INVARIANT:
    // Legitimate participant looking up the exact room code is NEVER blocked by RATE_LIMIT_EXCEEDED!
    setMockRequestHeadersForTesting(null);
    const legitimateLookup = await lookupRoomAction(session.roomCode);
    assert.equal(legitimateLookup.success, true);
    if (legitimateLookup.success) {
      assert.equal(legitimateLookup.data.quizTitle, 'Faith Quiz');
      assert.equal(legitimateLookup.data.roomCode, session.roomCode);
    }

    // Exact-room join by legitimate participants also succeeds without hindrance:
    setAuthenticatedUserContext({
      userId: 'exact_room_legit_participant',
      providerType: 'GOOGLE',
      providerSub: 'sub_exact_legit',
      email: 'exact.legit@church.org',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Exact Legit User'
    });
    const exactRoomJoin = await joinSessionAction(session.roomCode);
    assert.equal(exactRoomJoin.success, true);
    assert.ok(exactRoomJoin.data?.participantId);

    // 8B. CROSS-ROOM ISOLATION:
    // Attacking room A cannot block access to unrelated room B
    const roomB = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_f1',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    for (let i = 0; i < 20; i++) {
      await lookupRoomAction(session.roomCode);
      await lookupRoomAction('999999');
    }

    const roomBLookup = await lookupRoomAction(roomB.roomCode);
    assert.equal(roomBLookup.success, true);
    if (roomBLookup.success) {
      assert.equal(roomBLookup.data.quizTitle, 'Faith Quiz');
    }

    // 8C. BUCKET / KEY ROTATION RESISTANCE:
    // When a trusted client IP IS provided (e.g. from edge or test fixture):
    // An attacker on IP 198.51.100.99 rotating forwarding headers on every attempt
    // CANNOT evade the rate limiter by switching headers.
    setTrustedClientIpForTesting('198.51.100.99');
    for (let i = 0; i < 15; i++) {
      setMockRequestHeadersForTesting({
        'cf-connecting-ip': `203.0.113.${i + 1}`,
        'x-forwarded-for': `203.0.113.${i + 1}`,
        'x-real-ip': `203.0.113.${i + 1}`
      });
      await lookupRoomAction('NONEXT');
    }
    // 16th attempt from the attacker's IP is throttled even with yet another header:
    setMockRequestHeadersForTesting({
      'cf-connecting-ip': '10.0.0.1',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '10.0.0.1'
    });
    const throttledAttacker = await lookupRoomAction(session.roomCode);
    assert.equal(throttledAttacker.success, false);
    if (!throttledAttacker.success) {
      assert.equal(throttledAttacker.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(throttledAttacker.error.httpStatus, 429);
    }
    // Meanwhile, legitimate user on a different IP (or without IP override) can access the exact room:
    setTrustedClientIpForTesting('203.0.113.88');
    const legitUserOnDiffIp = await lookupRoomAction(session.roomCode);
    assert.equal(legitUserOnDiffIp.success, true);

    setTrustedClientIpForTesting(null);
    setMockRequestHeadersForTesting(null);

    // 9. Authenticated join throttling: 1 / 5s per userId
    setAuthenticatedUserContext({
      userId: 'user_throttle_test',
      providerType: 'GOOGLE',
      providerSub: 'sub_throttle',
      email: 'throttle@church.org',
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      displayName: 'Throttle Test User'
    });
    const firstJoin = await joinSessionAction(session.roomCode);
    assert.equal(firstJoin.success, true);
    const rapidSecondJoin = await joinSessionAction(session.roomCode);
    assert.equal(rapidSecondJoin.success, false);
    if (!rapidSecondJoin.success) {
      assert.equal(rapidSecondJoin.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(rapidSecondJoin.error.httpStatus, 429);
    }

    // 10. Test hook isolation: client IP overrides are strictly blocked in production
    const origNodeEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert.throws(() => {
        setTrustedClientIpForTesting('1.2.3.4');
      }, /Forbidden/);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    }

    // Clean up test environment
    delete process.env.BAREA_TRUSTED_PROXY;
    setMockRequestHeadersForTesting(null);
    setTrustedClientIpForTesting(null);
  });

  await t.test('Finding 2 Remediation: Error Sanitization & Raw Message Redaction', async () => {
    const { sharedDb, bankService, quizService, sessionService } = setupTestEnvironment();

    const orgTenant = 'org_berea_error_sanitization';
    const snap = await seedPublishedSnapshot(sharedDb, bankService, quizService, orgTenant, 'teacher_err');

    const session = await sessionService.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: orgTenant,
      publishedQuizSnapshotId: snap,
      hostUserId: 'teacher_err',
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // 1. Domain error preservation: domain-defined errors preserve their public client-safe message & code
    setAuthorizedTeacherContext({
      userId: 'stranger',
      organizationId: 'org_foreign',
      displayName: 'Foreign Stranger',
      role: 'teacher'
    });

    const closeRes = await closeSessionAction(session.id);
    assert.equal(closeRes.success, false);
    if (!closeRes.success) {
      assert.equal(closeRes.error.code, 'SESSION_ACCESS_DENIED');
      assert.equal(closeRes.error.httpStatus, 403);
      assert.equal(closeRes.error.message, 'Unauthorized to manage this session.');
    }

    // 2. Unexpected raw exceptions must NEVER leak their message, stack, or internal details
    // Mock getSessionService to throw an unexpected database/filesystem/secret error
    const rawSecretMessage = 'CRITICAL SQLITE_CORRUPT: /var/secrets/database.sqlite disk image malformed';
    const brokenService = {
      ...sessionService,
      getPublicInfo: () => {
        throw new Error(rawSecretMessage);
      }
    } as unknown as SessionService;

    setSessionService(brokenService);

    // Call lookupRoomAction and verify internal error is completely masked
    const lookupErrorRes = await lookupRoomAction(session.roomCode);
    assert.equal(lookupErrorRes.success, false);
    if (!lookupErrorRes.success) {
      assert.equal(lookupErrorRes.error.code, 'INTERNAL_ERROR');
      assert.equal(lookupErrorRes.error.httpStatus, 500);
      assert.equal(lookupErrorRes.error.message, 'An unexpected internal error occurred. Please try again later.');
      // Strictly verify raw secret information is redacted
      assert.ok(!lookupErrorRes.error.message.includes('SQLITE_CORRUPT'));
      assert.ok(!lookupErrorRes.error.message.includes('/var/secrets/'));
      assert.ok(!lookupErrorRes.error.message.includes('database.sqlite'));
      assert.ok(!lookupErrorRes.error.message.includes('CRITICAL'));
    }

    // Restore real session service
    setSessionService(sessionService);
  });
});
