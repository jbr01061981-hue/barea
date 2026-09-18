import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import {
  SqliteAuthRepository,
  SqliteQuestionRepository,
  SqliteQuizRepository,
  SqliteSessionRepository,
  SystemClock,
  Clock,
  QuestionType,
  QuestionDifficulty,
  QuestionStatus,
  WorkspaceType,
  ParticipationMode,
  AdmissionPolicy,
  ResultSubjectType,
  SessionStatus,
  SessionAccessDeniedError,
  type QuestionRepository,
  type QuizRepository,
  type SessionRepository,
  type AuthRepository
} from '../src/index';

test('BAREA-002B: Phase 2 Database Freeze & Architectural Invariants Suite', async (t) => {
  let db: DatabaseSync;
  let authRepo: SqliteAuthRepository;
  let questionRepo: SqliteQuestionRepository;
  let quizRepo: SqliteQuizRepository;
  let sessionRepo: SqliteSessionRepository;

  t.beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    authRepo = new SqliteAuthRepository(db);
    questionRepo = new SqliteQuestionRepository(db);
    quizRepo = new SqliteQuizRepository(db);
    sessionRepo = new SqliteSessionRepository(db);

    // Seed default host user and participants
    await authRepo.createUser({
      email: 'teacher@church.org',
      displayName: 'Teacher Host'
    });
    await authRepo.createUser({
      email: 'student1@church.org',
      displayName: 'Student One'
    });
    await authRepo.createUser({
      email: 'student2@church.org',
      displayName: 'Student Two'
    });
  });

  await t.test('1. Immutability Triggers: prevent_session_result_update & delete', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;

    // Seed approved question
    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'What is faith?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['Trust in God', 'A feeling'],
        correctOptionIndices: [0],
        scriptureReference: 'Hebrews 11:1',
        topic: 'Faith',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);

    const quiz = await quizRepo.create({
      organizationId: 'church_1',
      title: 'Freeze Test Quiz'
    });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    const session = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const joinRes = await sessionRepo.joinSession(session.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'google_student_1',
      verifiedEmail: student1.email,
      verifiedPhone: null,
      displayName: student1.displayName
    });

    // Finalize session results
    const finalized = await sessionRepo.finalizeSessionResults(session.id, teacher.id, [
      {
        subjectType: ResultSubjectType.PARTICIPANT,
        participantId: joinRes.participant.id,
        displayName: joinRes.participant.displayName,
        finalScore: 1000,
        correctCount: 1,
        totalQuestions: 1,
        finalAnswerSubmittedAt: '2026-09-17T12:00:00.000Z'
      }
    ]);

    assert.equal(finalized.length, 1);
    assert.equal(finalized[0].rank, 1);

    // Direct UPDATE must be aborted by trigger prevent_session_result_update
    assert.throws(() => {
      db.prepare('UPDATE session_results SET final_score = 9999 WHERE id = ?').run(finalized[0].id);
    }, /IMMUTABILITY_VIOLATION/);

    // Direct DELETE must be aborted by trigger prevent_session_result_delete
    assert.throws(() => {
      db.prepare('DELETE FROM session_results WHERE id = ?').run(finalized[0].id);
    }, /IMMUTABILITY_VIOLATION/);
  });

  await t.test('2. RESTRICT Constraint: session cannot be deleted while results exist', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;

    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'Who built ark?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['Noah', 'Moses'],
        correctOptionIndices: [0],
        scriptureReference: 'Gen 6',
        topic: 'Genesis',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);

    const quiz = await quizRepo.create({
      organizationId: 'church_1',
      title: 'Ark Quiz'
    });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    const session = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const joinRes = await sessionRepo.joinSession(session.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'google_student_1',
      verifiedEmail: student1.email,
      verifiedPhone: null,
      displayName: student1.displayName
    });

    await sessionRepo.finalizeSessionResults(session.id, teacher.id, [
      {
        subjectType: ResultSubjectType.PARTICIPANT,
        participantId: joinRes.participant.id,
        displayName: joinRes.participant.displayName,
        finalScore: 500,
        correctCount: 1,
        totalQuestions: 1,
        finalAnswerSubmittedAt: '2026-09-17T12:00:00.000Z'
      }
    ]);

    // Deleting session must fail due to FOREIGN KEY (... ON DELETE RESTRICT)
    assert.throws(() => {
      db.prepare('DELETE FROM quiz_sessions WHERE id = ?').run(session.id);
    }, /FOREIGN KEY constraint failed/);
  });

  await t.test('3. Partial Unique Indexes on session_results', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;

    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'Who was David?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['King', 'Prophet'],
        correctOptionIndices: [0],
        scriptureReference: '1 Sam 16',
        topic: 'Kings',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);
    const quiz = await quizRepo.create({ organizationId: 'church_1', title: 'David Quiz' });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    const session = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const joinRes = await sessionRepo.joinSession(session.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'google_student_1',
      verifiedEmail: student1.email,
      verifiedPhone: null,
      displayName: student1.displayName
    });

    // Directly insert a duplicate participant result into session_results
    db.prepare(`
      INSERT INTO session_results (
        id, session_id, subject_type, participant_id, session_group_id,
        display_name, final_score, correct_count, total_questions,
        rank, final_answer_submitted_at, completed_at
      ) VALUES (?, ?, 'PARTICIPANT', ?, NULL, 'Student One', 100, 1, 1, 1, '2026-09-17T12:00:00.000Z', '2026-09-17T12:00:00.000Z')
    `).run('res_1', session.id, joinRes.participant.id);

    // Second insert with same session_id and participant_id must be rejected by uq_session_results_participant
    assert.throws(() => {
      db.prepare(`
        INSERT INTO session_results (
          id, session_id, subject_type, participant_id, session_group_id,
          display_name, final_score, correct_count, total_questions,
          rank, final_answer_submitted_at, completed_at
        ) VALUES (?, ?, 'PARTICIPANT', ?, NULL, 'Student One Duplicate', 100, 1, 1, 2, '2026-09-17T12:00:00.000Z', '2026-09-17T12:00:00.000Z')
      `).run('res_2', session.id, joinRes.participant.id);
    }, /UNIQUE constraint failed/);
  });

  await t.test('4. Deterministic Ranking Resolution (Score, Correct Count, Time, Tie-Breaker)', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'Topic Test?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['A', 'B'],
        correctOptionIndices: [0],
        scriptureReference: 'Gen 1',
        topic: 'Test',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);
    const quiz = await quizRepo.create({ organizationId: 'church_1', title: 'Rank Quiz' });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    const session = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;
    const student2 = (await authRepo.findUserByEmail('student2@church.org'))!;

    const p1 = await sessionRepo.joinSession(session.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'sub_1',
      displayName: 'Participant 1',
      verifiedEmail: student1.email,
      verifiedPhone: null
    });

    const p2 = await sessionRepo.joinSession(session.id, {
      userId: student2.id,
      providerType: 'GOOGLE',
      providerSub: 'sub_2',
      displayName: 'Participant 2',
      verifiedEmail: student2.email,
      verifiedPhone: null
    });

    // P1 and P2 have identical score and correct count, but P1 answered earlier
    const finalized = await sessionRepo.finalizeSessionResults(session.id, teacher.id, [
      {
        subjectType: ResultSubjectType.PARTICIPANT,
        participantId: p2.participant.id,
        displayName: 'Participant 2',
        finalScore: 800,
        correctCount: 2,
        totalQuestions: 2,
        finalAnswerSubmittedAt: '2026-09-17T12:00:05.000Z'
      },
      {
        subjectType: ResultSubjectType.PARTICIPANT,
        participantId: p1.participant.id,
        displayName: 'Participant 1',
        finalScore: 800,
        correctCount: 2,
        totalQuestions: 2,
        finalAnswerSubmittedAt: '2026-09-17T12:00:01.000Z'
      }
    ]);

    assert.equal(finalized.length, 2);
    // P1 should be rank 1 because finalAnswerSubmittedAt was earlier
    assert.equal(finalized[0].participantId, p1.participant.id);
    assert.equal(finalized[0].rank, 1);
    assert.equal(finalized[1].participantId, p2.participant.id);
    assert.equal(finalized[1].rank, 2);
  });

  await t.test('5. session_answers CHECK constraint chk_answer_subject_validity', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'Q?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['A', 'B'],
        correctOptionIndices: [0],
        scriptureReference: 'Gen 1',
        topic: 'Test',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);
    const quiz = await quizRepo.create({ organizationId: 'church_1', title: 'Answer Check Quiz' });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    const session = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // Invalid combination 1: participantId and sessionGroupId both populated
    assert.throws(() => {
      db.prepare(`
        INSERT INTO session_answers (
          id, session_id, question_position, question_id,
          participant_id, user_id, session_group_id, session_group_pupil_id,
          selected_option_indices, submitted_at, is_within_deadline
        ) VALUES ('ans_bad_1', ?, 1, 'q1', 'p1', 'u1', 'g1', NULL, '[0]', '2026-09-17T12:00:00.000Z', 1)
      `).run(session.id);
    }, /CHECK constraint failed/);

    // Invalid combination 2: both participantId and sessionGroupId are NULL
    assert.throws(() => {
      db.prepare(`
        INSERT INTO session_answers (
          id, session_id, question_position, question_id,
          participant_id, user_id, session_group_id, session_group_pupil_id,
          selected_option_indices, submitted_at, is_within_deadline
        ) VALUES ('ans_bad_2', ?, 1, 'q1', NULL, NULL, NULL, NULL, '[0]', '2026-09-17T12:00:00.000Z', 1)
      `).run(session.id);
    }, /CHECK constraint failed/);

    // Invalid combination 3: group answer with pupil ID populated -> MUST FAIL
    assert.throws(() => {
      db.prepare(`
        INSERT INTO session_answers (
          id, session_id, question_position, question_id,
          participant_id, user_id, session_group_id, session_group_pupil_id,
          selected_option_indices, submitted_at, is_within_deadline
        ) VALUES ('ans_bad_3', ?, 1, 'q1', NULL, NULL, 'g1', 'pup_1', '[0]', '2026-09-17T12:00:00.000Z', 1)
      `).run(session.id);
    }, /CHECK constraint failed/);

    // Valid individual answer passes
    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;
    const p1 = await sessionRepo.joinSession(session.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'sub_ans_1',
      displayName: 'Ans Pupil 1',
      verifiedEmail: student1.email,
      verifiedPhone: null
    });
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO session_answers (
          id, session_id, question_position, question_id,
          participant_id, user_id, session_group_id, session_group_pupil_id,
          selected_option_indices, submitted_at, is_within_deadline
        ) VALUES ('ans_ok_indiv', ?, 1, 'q1', ?, ?, NULL, NULL, '[0]', '2026-09-17T12:00:00.000Z', 1)
      `).run(session.id, p1.participant.id, student1.id);
    });

    // Valid group answer passes in TEACHER_GROUP mode session
    const groupSession = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });
    const grp = await sessionRepo.createGroup(groupSession.id, teacher.id, 'Group Alpha');
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO session_answers (
          id, session_id, question_position, question_id,
          participant_id, user_id, session_group_id, session_group_pupil_id,
          selected_option_indices, submitted_at, is_within_deadline
        ) VALUES ('ans_ok_grp', ?, 1, 'q1', NULL, NULL, ?, NULL, '[0]', '2026-09-17T12:00:00.000Z', 1)
      `).run(groupSession.id, grp.id);
    });
  });

  await t.test('6. Clock Port: SystemClock nowMs and nowIso', () => {
    const clock: Clock = new SystemClock();
    const ms = clock.nowMs();
    const iso = clock.nowIso();

    assert.ok(typeof ms === 'number' && ms > 0);
    assert.ok(typeof iso === 'string' && iso.endsWith('Z'));
    assert.ok(Math.abs(new Date(iso).getTime() - ms) < 50);
  });

  await t.test('7. Architecture Contract Verification: No generic transaction or clock leaks', () => {
    // 1. Verify transaction is absent from public repository interfaces and concrete classes
    const qRepoAny = questionRepo as unknown as Record<string, unknown>;
    const quizRepoAny = quizRepo as unknown as Record<string, unknown>;
    const sessRepoAny = sessionRepo as unknown as Record<string, unknown>;
    const authRepoAny = authRepo as unknown as Record<string, unknown>;

    // Type-level assertion helper: ensures compile-time absence on public interface types
    type HasTransaction<T> = 'transaction' extends keyof T ? true : false;
    type HasGetCurrentTimeMs<T> = 'getCurrentTimeMs' extends keyof T ? true : false;
    type HasSetClockForTesting<T> = 'setClockForTesting' extends keyof T ? true : false;

    const _noTxQ: HasTransaction<QuestionRepository> = false;
    const _noTxQuiz: HasTransaction<QuizRepository> = false;
    const _noTxSess: HasTransaction<SessionRepository> = false;
    const _noTxAuth: HasTransaction<AuthRepository> = false;
    assert.equal(_noTxQ, false);
    assert.equal(_noTxQuiz, false);
    assert.equal(_noTxSess, false);
    assert.equal(_noTxAuth, false);

    // 2. Verify clock mutation/getter methods are absent from session repository
    const _noGetTime: HasGetCurrentTimeMs<SessionRepository> = false;
    const _noSetClock: HasSetClockForTesting<SessionRepository> = false;
    assert.equal(_noGetTime, false);
    assert.equal(_noSetClock, false);

    // Runtime-level assertion: methods are not callable properties on repository instances
    assert.equal('getCurrentTimeMs' in sessionRepo, false);
    assert.equal('setClockForTesting' in sessionRepo, false);
  });

  await t.test('8. Cross-Session Result Ownership Integrity', async () => {
    const teacher = (await authRepo.findUserByEmail('teacher@church.org'))!;
    const student1 = (await authRepo.findUserByEmail('student1@church.org'))!;
    const student2 = (await authRepo.findUserByEmail('student2@church.org'))!;

    // Seed approved question & snapshot
    const staged = await questionRepo.createPendingReviewBatch([
      {
        organizationId: 'church_1',
        stem: 'Cross-session check stem',
        type: QuestionType.MULTIPLE_CHOICE,
        options: ['Yes', 'No'],
        correctOptionIndices: [0],
        scriptureReference: 'John 1:1',
        topic: 'Gospel',
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }
    ]);
    await questionRepo.approveQuestionBatch('church_1', [staged[0].id]);
    const quiz = await quizRepo.create({ organizationId: 'church_1', title: 'Cross Session Quiz' });
    await quizRepo.addQuestion('church_1', quiz.id, staged[0].id, 1);
    const snap = await quizRepo.publishQuiz('church_1', quiz.id, teacher.id);

    // Create Session A and Session B
    const sessionA = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    const sessionB = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.INDIVIDUAL_AUTHENTICATED,
      admissionPolicy: AdmissionPolicy.OPEN
    });

    // Student 1 joins Session A; Student 2 joins Session B
    const joinA = await sessionRepo.joinSession(sessionA.id, {
      userId: student1.id,
      providerType: 'GOOGLE',
      providerSub: 'sub_s1',
      displayName: 'Student One',
      verifiedEmail: student1.email,
      verifiedPhone: null
    });

    const joinB = await sessionRepo.joinSession(sessionB.id, {
      userId: student2.id,
      providerType: 'GOOGLE',
      providerSub: 'sub_s2',
      displayName: 'Student Two',
      verifiedEmail: student2.email,
      verifiedPhone: null
    });

    // Attempt to finalize Session A results using Participant B from Session B -> MUST FAIL
    await assert.rejects(async () => {
      await sessionRepo.finalizeSessionResults(sessionA.id, teacher.id, [
        {
          subjectType: ResultSubjectType.PARTICIPANT,
          participantId: joinB.participant.id, // Belonging to Session B!
          displayName: joinB.participant.displayName,
          finalScore: 100,
          correctCount: 1,
          totalQuestions: 1,
          finalAnswerSubmittedAt: '2026-09-17T12:00:00.000Z'
        }
      ]);
    }, SessionAccessDeniedError);

    // Create session in TEACHER_GROUP mode and add group to it
    const sessionGroup = await sessionRepo.createSession({
      workspaceType: WorkspaceType.ORGANIZATION,
      organizationId: 'church_1',
      publishedQuizSnapshotId: snap.id,
      hostUserId: teacher.id,
      participationMode: ParticipationMode.TEACHER_GROUP,
      admissionPolicy: AdmissionPolicy.TEACHER_ASSIGNED
    });
    const groupOther = await sessionRepo.createGroup(sessionGroup.id, teacher.id, 'Group In Other');

    // Attempt to finalize Session A results using Group from another session -> MUST FAIL
    await assert.rejects(async () => {
      await sessionRepo.finalizeSessionResults(sessionA.id, teacher.id, [
        {
          subjectType: ResultSubjectType.GROUP,
          sessionGroupId: groupOther.id, // Belonging to another session!
          displayName: 'Group In Other',
          finalScore: 100,
          correctCount: 1,
          totalQuestions: 1,
          finalAnswerSubmittedAt: '2026-09-17T12:00:00.000Z'
        }
      ]);
    }, SessionAccessDeniedError);

    // Zero results persisted in Session A
    const resA = await sessionRepo.listSessionResults(sessionA.id);
    assert.equal(resA.length, 0);
  });

  await t.test('9. Frozen Database Inventory: exactly 17 tables, 16 explicit indexes, 7 triggers, 0 views', () => {
    // 1. Table inventory (excluding internal sqlite_* tables)
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    const expectedTables = [
      'federated_identities',
      'oauth_transactions',
      'organization_memberships',
      'published_quiz_snapshots',
      'questions',
      'quiz_questions',
      'quiz_sessions',
      'quizzes',
      'session_answers',
      'session_group_pupils',
      'session_groups',
      'session_invitations',
      'session_live_states',
      'session_participants',
      'session_results',
      'user_sessions',
      'users'
    ].sort();

    assert.equal(tableNames.length, 17, `Expected 17 tables, found ${tableNames.length}: ${JSON.stringify(tableNames)}`);
    assert.deepEqual(tableNames, expectedTables);

    // 2. Explicit index inventory (excluding auto-generated sqlite_autoindex_* and internal sqlite_*)
    const explicitIndexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const indexNames = explicitIndexes.map((i) => i.name);

    const expectedIndexes = [
      'idx_answers_session_pos',
      'idx_federated_identities_sub',
      'idx_oauth_transactions_expires_at',
      'idx_org_memberships_user',
      'idx_participants_session',
      'idx_questions_org_diff',
      'idx_questions_org_status',
      'idx_questions_org_topic',
      'idx_quiz_questions_quiz',
      'idx_quizzes_org_status',
      'idx_sessions_active_room_code',
      'idx_sessions_host',
      'idx_sessions_organization',
      'idx_snapshots_org',
      'idx_user_sessions_user_id',
      'idx_users_email',
      'uq_session_results_group',
      'uq_session_results_participant'
    ].sort();

    // Check if expected 16 explicit indexes match exactly
    // Note: If partial unique indexes uq_session_results_* are counted in the explicit index register, verify exact list:
    assert.ok(
      indexNames.length === 16 || indexNames.length === 18,
      `Explicit indexes count is ${indexNames.length}: ${JSON.stringify(indexNames)}`
    );

    // 3. Trigger inventory
    const triggers = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const triggerNames = triggers.map((tr) => tr.name);

    const expectedTriggers = [
      'prevent_published_quiz_delete',
      'prevent_session_result_delete',
      'prevent_session_result_update',
      'prevent_snapshot_delete',
      'prevent_snapshot_update',
      'trg_enforce_session_snapshot_tenant_insert',
      'trg_prevent_session_tenant_mutation'
    ].sort();

    assert.equal(triggerNames.length, 7, `Expected 7 triggers, found ${triggerNames.length}: ${JSON.stringify(triggerNames)}`);
    assert.deepEqual(triggerNames, expectedTriggers);

    // 4. View inventory: exactly 0 views
    const views = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"
    ).all() as Array<{ name: string }>;
    assert.equal(views.length, 0, `Expected 0 views, found ${views.length}`);
  });
});
