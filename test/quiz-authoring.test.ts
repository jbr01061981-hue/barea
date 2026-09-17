import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

import {
  QuizStatus,
  ScoringStyle,
  QUIZ_LIMITS,
  QuizValidationError,
  InvalidQuizLifecycleTransitionError,
  calculateSpeedWeightedScore,
  calculateStandardScore,
  projectQuestionForParticipant,
  assertValidQuizStatusTransition,
  SqliteQuizRepository,
  QuizService,
  QuestionStatus,
  QuestionDifficulty,
  QuestionType,
  SqliteQuestionRepository,
  QuestionBankService
} from '../src/index';

import {
  setAuthorizedTeacherContext,
  setQuestionBankService,
  setQuizService
} from '../src/app/teacher/review/db';

import {
  createQuizAction,
  getQuizByIdAction,
  listQuizzesAction,
  updateQuizAction,
  addQuestionToQuizAction,
  removeQuestionFromQuizAction,
  reorderQuizQuestionsAction,
  publishQuizAction,
  archiveQuizAction,
  getPublishedSnapshotAction
} from '../src/app/teacher/quizzes/actions';

interface DbAudit {
  quizCount: number;
  quizStatus: string | null;
  quizQuestionsCount: number;
  snapshotCount: number;
}

function captureDbAudit(db: DatabaseSync, quizId: string): DbAudit {
  const quizRow = db.prepare('SELECT status FROM quizzes WHERE id = ?').get(quizId) as { status: string } | undefined;
  const qqRow = db.prepare('SELECT count(*) as count FROM quiz_questions WHERE quiz_id = ?').get(quizId) as { count: number };
  const snapRow = db.prepare('SELECT count(*) as count FROM published_quiz_snapshots WHERE quiz_id = ?').get(quizId) as { count: number };

  return {
    quizCount: quizRow ? 1 : 0,
    quizStatus: quizRow ? quizRow.status : null,
    quizQuestionsCount: qqRow ? qqRow.count : 0,
    snapshotCount: snapRow ? snapRow.count : 0
  };
}

async function seedApprovedQuestion(
  bankService: QuestionBankService,
  orgId: string,
  stem: string = 'Who built the ark?'
): Promise<string> {
  const q = await bankService.createQuestion({
    organizationId: orgId,
    stem,
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['Noah', 'Moses', 'David', 'Abraham'],
    correctOptionIndices: [0],
    explanation: 'Genesis 6 records Noah building the ark.',
    scriptureReference: 'Genesis 6:14',
    topic: 'Genesis',
    difficulty: QuestionDifficulty.EASY,
    language: 'en'
  });
  await bankService.transitionStatus(orgId, q.id, QuestionStatus.PENDING_REVIEW);
  await bankService.transitionStatus(orgId, q.id, QuestionStatus.APPROVED);
  return q.id;
}

test('BAREA-005: Quiz Domain, Authoring, Snapshot Immutability & Adversarial Tests', async (t) => {
  let db: DatabaseSync;
  let qRepo: SqliteQuestionRepository;
  let bankService: QuestionBankService;
  let quizRepo: SqliteQuizRepository;
  let quizService: QuizService;

  t.beforeEach(() => {
    db = new DatabaseSync(':memory:');
    // Both repositories share the exact same DatabaseSync instance in memory
    qRepo = new SqliteQuestionRepository(db);
    quizRepo = new SqliteQuizRepository(db);

    bankService = new QuestionBankService(qRepo);
    quizService = new QuizService(quizRepo);

    setQuestionBankService(bankService);
    setQuizService(quizService);

    // Default test teacher context
    setAuthorizedTeacherContext({
      userId: 'teacher-primary-1',
      organizationId: 'church-berea-alpha',
      displayName: 'Teacher Alpha',
      role: 'teacher'
    });

    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run('teacher-primary-1', 'teacher-primary-1@example.test', 'Teacher Alpha', new Date().toISOString());

    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run('teacher-1', 'teacher-1@example.test', 'Teacher One', new Date().toISOString());
  });

  t.afterEach(() => {
    setAuthorizedTeacherContext(null);
    setQuestionBankService(null);
    setQuizService(null);
  });

  // ADV-QZ-01: Cross-tenant quiz read isolation
  await t.test('ADV-QZ-01: Cross-tenant quiz read isolation', async () => {
    const orgB = 'church-berea-beta';
    const qB = await seedApprovedQuestion(bankService, orgB, 'Question from Org B');
    const quizB = await quizService.createQuiz(orgB, {
      organizationId: orgB,
      title: 'Org B Secret Quiz'
    });
    await quizService.addQuestion(orgB, quizB.id, qB);

    // Teacher Alpha is active (Org A)
    const readRes = await getQuizByIdAction(quizB.id);
    assert.equal(readRes.success, false);
    assert.match(readRes.error!, /not found/i);
  });

  // ADV-QZ-02: Cross-tenant question attachment rejection
  await t.test('ADV-QZ-02: Cross-tenant question attachment rejection', async () => {
    const orgA = 'church-berea-alpha';
    const orgB = 'church-berea-beta';
    const qB = await seedApprovedQuestion(bankService, orgB, 'Question from Org B');
    const quizA = await quizService.createQuiz(orgA, {
      organizationId: orgA,
      title: 'Org A Quiz'
    });

    const attachRes = await addQuestionToQuizAction(quizA.id, qB);
    assert.equal(attachRes.success, false);
    assert.match(attachRes.error!, /not found or belongs to a different organization/i);

    const auditA = captureDbAudit(db, quizA.id);
    assert.equal(auditA.quizQuestionsCount, 0);
  });

  // ADV-QZ-03: Cross-tenant quiz mutation rejection
  await t.test('ADV-QZ-03: Cross-tenant quiz mutation rejection', async () => {
    const orgB = 'church-berea-beta';
    const quizB = await quizService.createQuiz(orgB, {
      organizationId: orgB,
      title: 'Org B Secret Quiz'
    });

    const updateRes = await updateQuizAction(quizB.id, { title: 'Hacked Title' });
    assert.equal(updateRes.success, false);
    assert.match(updateRes.error!, /not found/i);

    const rawQuizB = db.prepare('SELECT title FROM quizzes WHERE id = ?').get(quizB.id) as { title: string } | undefined;
    assert.equal(rawQuizB?.title, 'Org B Secret Quiz');
  });

  // ADV-QZ-04: Cross-tenant publish attempt rejection
  await t.test('ADV-QZ-04: Cross-tenant publish attempt rejection', async () => {
    const orgB = 'church-berea-beta';
    const qB = await seedApprovedQuestion(bankService, orgB, 'Question from Org B');
    const quizB = await quizService.createQuiz(orgB, {
      organizationId: orgB,
      title: 'Org B Secret Quiz'
    });
    await quizService.addQuestion(orgB, quizB.id, qB);

    const pubRes = await publishQuizAction(quizB.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /not found/i);

    const auditB = captureDbAudit(db, quizB.id);
    assert.equal(auditB.quizStatus, 'DRAFT');
    assert.equal(auditB.snapshotCount, 0);
  });

  // ADV-QZ-05: Runtime parameter allowlisting
  await t.test('ADV-QZ-05: Rejects or strips unauthorized fields (id, organizationId, status, publishedSnapshot)', async () => {
    const org = 'church-berea-alpha';
    const quiz = await quizService.createQuiz(org, {
      organizationId: org,
      title: 'Protected Fields Test'
    });

    // Attempt to inject protected fields via updateQuizAction
    const maliciousPayload = {
      title: 'Legitimate Updated Title',
      status: 'PUBLISHED',
      organizationId: 'church-victim',
      id: 'tampered-id',
      publishedSnapshot: { evil: true },
      unknownExploitKey: 'injected'
    };

    const res = await updateQuizAction(quiz.id, maliciousPayload);
    assert.equal(res.success, true);
    assert.equal(res.data?.title, 'Legitimate Updated Title');
    assert.equal(res.data?.status, QuizStatus.DRAFT);
    assert.equal(res.data?.organizationId, org);
    assert.equal(res.data?.id, quiz.id);

    // Verify raw SQLite row
    const raw = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quiz.id) as {
      title: string;
      status: string;
      organization_id: string;
      id: string;
    } | undefined;
    assert.equal(raw?.title, 'Legitimate Updated Title');
    assert.equal(raw?.status, 'DRAFT');
    assert.equal(raw?.organization_id, org);
  });

  // ADV-QZ-06: Unapproved question rejection
  await t.test('ADV-QZ-06: Adding DRAFT or PENDING_REVIEW question to quiz is strictly rejected', async () => {
    const org = 'church-berea-alpha';
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Draft Question Test' });

    // Seed a DRAFT question
    const qDraft = await bankService.createQuestion({
      organizationId: org,
      stem: 'Draft question stem',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Gen 1:1',
      topic: 'Topic',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });

    await assert.rejects(
      async () => await quizService.addQuestion(org,
      quiz.id, qDraft.id),
      /Only APPROVED questions can be added/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 0);
  });

  // ADV-QZ-07: Archived question rejection
  await t.test('ADV-QZ-07: Adding ARCHIVED question to quiz is strictly rejected', async () => {
    const org = 'church-berea-alpha';
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Archived Question Test' });

    const qArchived = await bankService.createQuestion({
      organizationId: org,
      stem: 'Archived question stem',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Gen 1:1',
      topic: 'Topic',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    await bankService.transitionStatus(org, qArchived.id, QuestionStatus.ARCHIVED);

    await assert.rejects(
      async () => await quizService.addQuestion(org,
      quiz.id, qArchived.id),
      /Only APPROVED questions can be added/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 0);
  });

  // ADV-QZ-08: TOCTOU question demotion during active publish
  await t.test('ADV-QZ-08: TOCTOU - Question demoted right before publish causes transaction rollback', async () => {
    const org = 'church-berea-alpha';
    const qId = await seedApprovedQuestion(bankService, org, 'TOCTOU Question');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'TOCTOU Quiz' });
    await quizService.addQuestion(org, quiz.id, qId);

    // Pre-condition audit
    const preAudit = captureDbAudit(db, quiz.id);
    assert.equal(preAudit.quizQuestionsCount, 1);
    assert.equal(preAudit.snapshotCount, 0);

    // Demote question in Question Bank to PENDING_REVIEW right before publish
    db.prepare("UPDATE questions SET status = 'PENDING_REVIEW' WHERE id = ?").run(qId);

    // Attempt publish
    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /TOCTOU Precondition Failed.*Only APPROVED questions/i);

    // Post-condition audit: complete rollback verified
    const postAudit = captureDbAudit(db, quiz.id);
    assert.equal(postAudit.quizStatus, 'DRAFT');
    assert.equal(postAudit.snapshotCount, 0);
  });

  // ADV-QZ-25: TOCTOU question demoted back to DRAFT before publish
  await t.test('ADV-QZ-25: TOCTOU - Question demoted to DRAFT before publish causes transaction rollback', async () => {
    const org = 'church-berea-alpha';
    const qId = await seedApprovedQuestion(bankService, org, 'TOCTOU Draft Question');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'TOCTOU Draft Quiz' });
    await quizService.addQuestion(org, quiz.id, qId);

    // Demote to DRAFT in Question Bank
    db.prepare("UPDATE questions SET status = 'DRAFT' WHERE id = ?").run(qId);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /TOCTOU Precondition Failed.*Only APPROVED questions/i);

    const postAudit = captureDbAudit(db, quiz.id);
    assert.equal(postAudit.quizStatus, 'DRAFT');
    assert.equal(postAudit.snapshotCount, 0);
  });

  // ADV-QZ-09: TOCTOU question archived before publish
  await t.test('ADV-QZ-09: TOCTOU - Question archived before publish causes atomic rollback', async () => {
    const org = 'church-berea-alpha';
    const qId = await seedApprovedQuestion(bankService, org, 'TOCTOU Archived Question');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'TOCTOU Archived Quiz' });
    await quizService.addQuestion(org, quiz.id, qId);

    // Archive question right before publish
    db.prepare("UPDATE questions SET status = 'ARCHIVED' WHERE id = ?").run(qId);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /TOCTOU Precondition Failed.*Only APPROVED questions/i);

    const postAudit = captureDbAudit(db, quiz.id);
    assert.equal(postAudit.quizStatus, 'DRAFT');
    assert.equal(postAudit.snapshotCount, 0);
  });

  // ADV-QZ-10: Empty quiz publication
  await t.test('ADV-QZ-10: Publishing quiz with zero questions fails closed', async () => {
    const org = 'church-berea-alpha';
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Empty Quiz' });

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /at least 1 approved question/i);

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizStatus, 'DRAFT');
    assert.equal(audit.snapshotCount, 0);
  });

  // ADV-QZ-11: Duplicate question attachment
  await t.test('ADV-QZ-11: Attaching duplicate question to quiz is rejected', async () => {
    const org = 'church-berea-alpha';
    const qId = await seedApprovedQuestion(bankService, org, 'Duplicate Check Question');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Duplicate Quiz' });

    await quizService.addQuestion(org, quiz.id, qId);

    await assert.rejects(
      async () => await quizService.addQuestion(org,
      quiz.id, qId),
      /already in quiz/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 1);
  });

  // ADV-QZ-12: Duplicate positions rejected / normalized
  await t.test('ADV-QZ-12: Question positions remain strictly sequential [1..N]', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = await seedApprovedQuestion(bankService, org, 'Q2');
    const q3 = await seedApprovedQuestion(bankService, org, 'Q3');

    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Order Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.addQuestion(org, quiz.id, q2);
    await quizService.addQuestion(org, quiz.id, q3);

    // Remove middle question (Q2)
    await quizService.removeQuestion(org, quiz.id, q2);

    const questions = await quizService.getQuizQuestions(org, quiz.id);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].questionId, q1);
    assert.equal(questions[0].sortOrder, 1);
    assert.equal(questions[1].questionId, q3);
    assert.equal(questions[1].sortOrder, 2); // Normalized to 2 (no gaps)
  });

  // ADV-QZ-13: Question reordering preserves all items
  await t.test('ADV-QZ-13: Question reordering preserves all items', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = await seedApprovedQuestion(bankService, org, 'Q2');
    const q3 = await seedApprovedQuestion(bankService, org, 'Q3');

    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Reorder Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.addQuestion(org, quiz.id, q2);
    await quizService.addQuestion(org, quiz.id, q3);

    // Reverse order: [q3, q2, q1]
    const reorderRes = await reorderQuizQuestionsAction(quiz.id, [q3, q2, q1]);
    assert.equal(reorderRes.success, true);
    assert.equal(reorderRes.data?.length, 3);
  });

  // ADV-QZ-14: Question reordering updates sort order sequence deterministically
  await t.test('ADV-QZ-14: Question reordering updates sequence deterministically', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = await seedApprovedQuestion(bankService, org, 'Q2');
    const q3 = await seedApprovedQuestion(bankService, org, 'Q3');

    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Reorder Determinism Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.addQuestion(org, quiz.id, q2);
    await quizService.addQuestion(org, quiz.id, q3);

    const reorderRes = await reorderQuizQuestionsAction(quiz.id, [q3, q2, q1]);
    assert.equal(reorderRes.success, true);
    assert.equal(reorderRes.data?.[0].questionId, q3);
    assert.equal(reorderRes.data?.[0].sortOrder, 1);
    assert.equal(reorderRes.data?.[1].questionId, q2);
    assert.equal(reorderRes.data?.[1].sortOrder, 2);
    assert.equal(reorderRes.data?.[2].questionId, q1);
    assert.equal(reorderRes.data?.[2].sortOrder, 3);
  });

  // ADV-QZ-15: Incomplete / invalid question IDs in reorder payload
  await t.test('ADV-QZ-15: Reordering with missing or foreign question IDs is rejected', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = await seedApprovedQuestion(bankService, org, 'Q2');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Bad Reorder Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.addQuestion(org, quiz.id, q2);

    // Missing q2
    const res1 = await reorderQuizQuestionsAction(quiz.id, [q1]);
    assert.equal(res1.success, false);
    assert.match(res1.error!, /does not match existing question count/i);

    // Foreign question
    const res2 = await reorderQuizQuestionsAction(quiz.id, [q1, 'foreign-q-id']);
    assert.equal(res2.success, false);
    assert.match(res2.error!, /does not belong to quiz/i);
  });

  // ADV-QZ-16: Modification of published quiz rejected
  await t.test('ADV-QZ-16: Mutations on PUBLISHED quiz are strictly rejected', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = await seedApprovedQuestion(bankService, org, 'Q2');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Published Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);

    // Publish
    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, true);

    // 1. Attempt edit
    const editRes = await updateQuizAction(quiz.id, { title: 'New Title' });
    assert.equal(editRes.success, false);
    assert.match(editRes.error!, /Cannot modify quiz in PUBLISHED status/i);

    // 2. Attempt adding question
    const addRes = await addQuestionToQuizAction(quiz.id, q2);
    assert.equal(addRes.success, false);
    assert.match(addRes.error!, /Cannot add questions to quiz in PUBLISHED status/i);

    // 3. Attempt removing question
    const remRes = await removeQuestionFromQuizAction(quiz.id, q1);
    assert.equal(remRes.success, false);
    assert.match(remRes.error!, /Cannot remove questions from quiz in PUBLISHED status/i);

    // 4. Attempt reorder
    const reorderRes = await reorderQuizQuestionsAction(quiz.id, [q1]);
    assert.equal(reorderRes.success, false);
    assert.match(reorderRes.error!, /Cannot reorder questions for quiz in PUBLISHED status/i);
  });

  // ADV-QZ-17: Timer bounds - minimum bound (10s)
  await t.test('ADV-QZ-17: Timer bounds strictly enforced below minimum (9 seconds)', async () => {
    const org = 'church-berea-alpha';
    await assert.rejects(
      async () => await quizService.createQuiz(org,
      { organizationId: org, title: 'T', defaultTimeLimitSeconds: 9 }),
      /between 10 and 120/i
    );
  });

  // ADV-QZ-18: Timer bounds - maximum bound (120s) and non-integer
  await t.test('ADV-QZ-18: Timer bounds strictly enforced above maximum (121s) and non-integer', async () => {
    const org = 'church-berea-alpha';
    await assert.rejects(
      async () => await quizService.createQuiz(org,
      { organizationId: org, title: 'T', defaultTimeLimitSeconds: 121 }),
      /between 10 and 120/i
    );
    await assert.rejects(
      async () => await quizService.createQuiz(org,
      { organizationId: org, title: 'T', defaultTimeLimitSeconds: 30.5 }),
      /between 10 and 120/i
    );
    await quizService.createQuiz(org, { organizationId: org, title: 'T10', defaultTimeLimitSeconds: 10 });
    await quizService.createQuiz(org, { organizationId: org, title: 'T120', defaultTimeLimitSeconds: 120 });
  });

  // ADV-QZ-19: Invalid scoring style
  await t.test('ADV-QZ-19: Invalid scoring style string rejected', async () => {
    const org = 'church-berea-alpha';
    await assert.rejects(
      async () => await quizService.createQuiz(org,
      { organizationId: org, title: 'T', scoringStyle: 'EXPONENTIAL' as unknown as ScoringStyle }),
      /Invalid scoring style/i
    );
  });

  // ADV-QZ-20: Snapshot immutability against Question Bank mutations
  await t.test('ADV-QZ-20: Published snapshot is 100% immune to subsequent Question Bank edits', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Original Genesis Stem');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Immutable Snapshot Test' });
    await quizService.addQuestion(org, quiz.id, q1);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, true);

    // Mutate question in the Question Bank
    db.prepare("UPDATE questions SET stem = 'TAMPERED STEM IN BANK' WHERE id = ?").run(q1);

    // Read published snapshot via action
    const snapRes = await getPublishedSnapshotAction(quiz.id);
    assert.equal(snapRes.success, true);
    assert.equal(snapRes.data?.questions[0].stem, 'Original Genesis Stem');
    assert.notEqual(snapRes.data?.questions[0].stem, 'TAMPERED STEM IN BANK');

    // Read directly from SQLite snapshot table
    const rawSnap = db.prepare('SELECT snapshot_json FROM published_quiz_snapshots WHERE quiz_id = ?').get(quiz.id) as { snapshot_json: string } | undefined;
    const parsed = JSON.parse(rawSnap!.snapshot_json);
    assert.equal(parsed.questions[0].stem, 'Original Genesis Stem');
  });

  // ADV-QZ-21: Snapshot immutability against Question Bank archive
  await t.test('ADV-QZ-21: Published snapshot is 100% immune to subsequent Question Bank archival', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Original Exodus Stem');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Archive Snapshot Test' });
    await quizService.addQuestion(org, quiz.id, q1);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, true);

    // Archive question in the Question Bank
    db.prepare("UPDATE questions SET status = 'ARCHIVED' WHERE id = ?").run(q1);

    const snapRes = await getPublishedSnapshotAction(quiz.id);
    assert.equal(snapRes.success, true);
    assert.equal(snapRes.data?.questions[0].stem, 'Original Exodus Stem');
  });

  // ADV-QZ-22: Direct SQL UPDATE against published_quiz_snapshots
  await t.test('ADV-QZ-22: SQLite trigger prevent_snapshot_update aborts direct SQL UPDATE', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Stem 1');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Trigger Update Test' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare("UPDATE published_quiz_snapshots SET title = 'Hacked' WHERE quiz_id = ?").run(quiz.id);
      },
      (err: unknown) => err instanceof Error && /IMMUTABILITY_VIOLATION.*cannot be updated/i.test(err.message)
    );

    // Verify row in DB is unchanged
    const rawSnap = db.prepare('SELECT title FROM published_quiz_snapshots WHERE quiz_id = ?').get(quiz.id) as { title: string } | undefined;
    assert.equal(rawSnap?.title, 'Trigger Update Test');
  });

  // ADV-QZ-23: Direct SQL DELETE against published_quiz_snapshots
  await t.test('ADV-QZ-23: SQLite trigger prevent_snapshot_delete aborts direct SQL DELETE', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Stem 1');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Trigger Delete Test' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare('DELETE FROM published_quiz_snapshots WHERE quiz_id = ?').run(quiz.id);
      },
      (err: unknown) => err instanceof Error && /IMMUTABILITY_VIOLATION.*cannot be deleted/i.test(err.message)
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.snapshotCount, 1);
  });

  // ADV-QZ-24: Participant answer secrecy projection boundary
  await t.test('ADV-QZ-24: Participant question projection strips correctOptionIndices and explanation', async () => {
    const snapshotQuestion = {
      id: 'q-100',
      position: 1,
      stem: 'Who was swallowed by a great fish?',
      type: QuestionType.MULTIPLE_CHOICE,
      choices: [
        { choiceIndex: 0, text: 'Jonah' },
        { choiceIndex: 1, text: 'Peter' }
      ],
      correctOptionIndices: [0],
      explanation: 'Jonah fled from the Lord and was swallowed by a great fish.',
      scriptureReference: 'Jonah 1:17',
      topic: 'Prophets',
      difficulty: QuestionDifficulty.EASY,
      timeLimitSeconds: 30
    };

    const projected = projectQuestionForParticipant(snapshotQuestion);

    assert.equal(projected.id, 'q-100');
    assert.equal(projected.position, 1);
    assert.equal(projected.stem, 'Who was swallowed by a great fish?');
    assert.equal(projected.choices.length, 2);
    // @ts-expect-error - assert correctOptionIndices is not on projected type
    assert.equal(projected.correctOptionIndices, undefined);
    // @ts-expect-error - assert explanation is not on projected type
    assert.equal(projected.explanation, undefined);

    // Verify JSON wire representation
    const wireJson = JSON.stringify(projected);
    assert.equal(wireJson.includes('correctOptionIndices'), false);
    assert.equal(wireJson.includes('Jonah fled from the Lord'), false);
  });

  // ADV-QZ-26: Deterministic atomic rollback via simulateSnapshotFailure seam
  await t.test('ADV-QZ-26: Deterministic atomic rollback via simulateSnapshotFailure seam', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Rollback Test Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);

    const preAudit = captureDbAudit(db, quiz.id);
    assert.equal(preAudit.quizStatus, 'DRAFT');
    assert.equal(preAudit.snapshotCount, 0);

    // Arm the test seam
    quizRepo.simulateSnapshotFailure = true;

    await assert.rejects(
      async () => await quizService.publishQuiz(org,
      quiz.id, 'teacher-1'),
      /TEST_SIMULATED_SNAPSHOT_PERSISTENCE_FAILURE/
    );

    // Direct SQLite table audit: proves 100% rollback
    const postAudit = captureDbAudit(db, quiz.id);
    assert.equal(postAudit.quizStatus, 'DRAFT', 'Quiz status must remain DRAFT after failure');
    assert.equal(postAudit.snapshotCount, 0, 'Zero snapshot rows must exist after rollback');

    // Disarm seam and verify publish now succeeds cleanly
    quizRepo.simulateSnapshotFailure = false;
    await quizService.publishQuiz(org, quiz.id, 'teacher-1');

    const finalAudit = captureDbAudit(db, quiz.id);
    assert.equal(finalAudit.quizStatus, 'PUBLISHED');
    assert.equal(finalAudit.snapshotCount, 1);
  });

  // ADV-QZ-27 (QA Gap 1): Question Options Invalidated TOCTOU
  await t.test('ADV-QZ-27: Question options invalidated TOCTOU before publish causes rollback', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Stem with options');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Invalidated Options Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);

    // Corrupt options in question table (less than 2 options)
    db.prepare("UPDATE questions SET options_json = '[\"OnlyOneOption\"]' WHERE id = ?").run(q1);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /invalid options/i);

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizStatus, 'DRAFT');
    assert.equal(audit.snapshotCount, 0);
  });

  // ADV-QZ-28 (QA Gap 2): Physical deletion of published quiz is prevented by SQLite trigger
  await t.test('ADV-QZ-28: SQLite trigger prevent_published_quiz_delete prevents deleting published quiz', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Cannot Delete Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);
    await quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare('DELETE FROM quizzes WHERE id = ?').run(quiz.id);
      },
      (err: unknown) => err instanceof Error && /ILLEGAL_OPERATION.*cannot be physically deleted/i.test(err.message)
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizCount, 1);
  });

  // ADV-QZ-29 (QA Gap 3): Archived quiz cannot be modified or published
  await t.test('ADV-QZ-29: ARCHIVED quiz is locked out from mutation and publishing', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = await quizService.createQuiz(org, { organizationId: org, title: 'Archived Quiz' });
    await quizService.addQuestion(org, quiz.id, q1);

    // Archive quiz
    const archRes = await archiveQuizAction(quiz.id);
    assert.equal(archRes.success, true);
    assert.equal(archRes.data?.status, QuizStatus.ARCHIVED);

    // Attempt edit
    const updateRes = await updateQuizAction(quiz.id, { title: 'Edited' });
    assert.equal(updateRes.success, false);
    assert.match(updateRes.error!, /Cannot modify quiz in ARCHIVED status/i);

    // Attempt publish
    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /Only DRAFT quizzes can be published/i);

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizStatus, 'ARCHIVED');
    assert.equal(audit.snapshotCount, 0);
  });

  // ADV-QZ-30: Lifecycle transitions: restore draft archive vs published archive
  await t.test('ADV-QZ-30: Draft archive can be restored to DRAFT; Published archive cannot', async () => {
    const org = 'church-berea-alpha';
    const q1 = await seedApprovedQuestion(bankService, org, 'Q1');

    // 1. Draft -> Archived -> Draft
    const draftQuiz = await quizService.createQuiz(org, { organizationId: org, title: 'Draft Archivable' });
    await quizService.archiveQuiz(org, draftQuiz.id);
    const restored = await quizService.restoreDraftQuiz(org, draftQuiz.id);
    assert.equal(restored?.status, QuizStatus.DRAFT);

    // 2. Published -> Archived -> Draft (FORBIDDEN)
    const pubQuiz = await quizService.createQuiz(org, { organizationId: org, title: 'Pub Archivable' });
    await quizService.addQuestion(org, pubQuiz.id, q1);
    await quizService.publishQuiz(org, pubQuiz.id, 'teacher-1');
    await quizService.archiveQuiz(org, pubQuiz.id);

    await assert.rejects(async () => await quizService.restoreDraftQuiz(org, pubQuiz.id), /Cannot restore a published archived quiz back to DRAFT/i
    );
  });

  // Scoring math tests: exact boundary conditions
  await t.test('Scoring Math: Speed-Weighted formula boundary matrix', async (st) => {
    const cases = [
      { remainingMs: 30000, limitMs: 30000, isCorrect: true, expected: 100, desc: 'Instantaneous response (100% time remaining) = 100 pts' },
      { remainingMs: 29999, limitMs: 30000, isCorrect: true, expected: 100, desc: '1ms elapsed = 100 pts' },
      { remainingMs: 15000, limitMs: 30000, isCorrect: true, expected: 75, desc: '50% elapsed = 75 pts' },
      { remainingMs: 1, limitMs: 30000, isCorrect: true, expected: 50, desc: '1ms before timeout = 50 pts' },
      { remainingMs: 0, limitMs: 30000, isCorrect: true, expected: 0, desc: '0ms remaining (timeout) = 0 pts' },
      { remainingMs: -500, limitMs: 30000, isCorrect: true, expected: 0, desc: 'Negative remaining time = 0 pts' },
      { remainingMs: 30000, limitMs: 30000, isCorrect: false, expected: 0, desc: 'Incorrect instantaneous = 0 pts' },
      { remainingMs: 15000, limitMs: 30000, isCorrect: false, expected: 0, desc: 'Incorrect 50% = 0 pts' }
    ];

    for (const c of cases) {
      await st.test(c.desc, () => {
        const score = calculateSpeedWeightedScore({
          isCorrect: c.isCorrect,
          remainingTimeMs: c.remainingMs,
          timeLimitMs: c.limitMs
        });
        assert.equal(score, c.expected);
      });
    }

    // Standard scoring
    assert.equal(calculateStandardScore(true), 100);
    assert.equal(calculateStandardScore(false), 0);
  });
});
