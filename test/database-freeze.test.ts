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
  SessionStatus
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
  });

  await t.test('6. Clock Port: SystemClock nowMs and nowIso', () => {
    const clock: Clock = new SystemClock();
    const ms = clock.nowMs();
    const iso = clock.nowIso();

    assert.ok(typeof ms === 'number' && ms > 0);
    assert.ok(typeof iso === 'string' && iso.endsWith('Z'));
    assert.ok(Math.abs(new Date(iso).getTime() - ms) < 50);
  });
});
