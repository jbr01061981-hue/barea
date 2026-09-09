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

function seedApprovedQuestion(
  bankService: QuestionBankService,
  orgId: string,
  stem: string = 'Who built the ark?'
): string {
  const q = bankService.createQuestion({
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
  bankService.transitionStatus(orgId, q.id, QuestionStatus.PENDING_REVIEW);
  bankService.transitionStatus(orgId, q.id, QuestionStatus.APPROVED);
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
    qRepo = new SqliteQuestionRepository(':memory:');
    // We attach the same underlying database or separate as appropriate
    // In our architecture, SqliteQuizRepository can wrap the same DatabaseSync
    // Let's create both repos sharing the same DatabaseSync
    quizRepo = new SqliteQuizRepository(db);
    // Initialize questions schema in this db
    db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        stem TEXT NOT NULL,
        type TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_option_indices_json TEXT NOT NULL,
        explanation TEXT,
        scripture_reference TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        language TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_questions_org ON questions (organization_id);
    `);

    // Wrap in question repo using the same db
    const customQRepo: any = {
      create: (d: any) => {
        const id = d.id || 'q-' + Math.random().toString(36).substring(2, 9);
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO questions (
            id, organization_id, stem, type, options_json, correct_option_indices_json,
            explanation, scripture_reference, topic, difficulty, language, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, d.organizationId, d.stem, d.type, JSON.stringify(d.options),
          JSON.stringify(d.correctOptionIndices), d.explanation || '', d.scriptureReference,
          d.topic, d.difficulty, d.language, d.status || QuestionStatus.DRAFT, now, now
        );
        return { ...d, id, status: d.status || QuestionStatus.DRAFT, createdAt: now, updatedAt: now };
      },
      findById: (org: string, id: string) => {
        const r = db.prepare('SELECT * FROM questions WHERE id = ? AND organization_id = ?').get(id, org) as any;
        if (!r) return null;
        return {
          id: r.id, organizationId: r.organization_id, stem: r.stem, type: r.type,
          options: JSON.parse(r.options_json), correctOptionIndices: JSON.parse(r.correct_option_indices_json),
          explanation: r.explanation || '', scriptureReference: r.scripture_reference,
          topic: r.topic, difficulty: r.difficulty, language: r.language, status: r.status,
          createdAt: r.created_at, updatedAt: r.updated_at
        };
      },
      transitionStatus: (org: string, id: string, st: string) => {
        db.prepare('UPDATE questions SET status = ? WHERE id = ? AND organization_id = ?').run(st, id, org);
        const r = db.prepare('SELECT * FROM questions WHERE id = ? AND organization_id = ?').get(id, org) as any;
        if (!r) return null;
        return {
          id: r.id, organizationId: r.organization_id, stem: r.stem, type: r.type,
          options: JSON.parse(r.options_json), correctOptionIndices: JSON.parse(r.correct_option_indices_json),
          explanation: r.explanation || '', scriptureReference: r.scripture_reference,
          topic: r.topic, difficulty: r.difficulty, language: r.language, status: r.status,
          createdAt: r.created_at, updatedAt: r.updated_at
        };
      },
      list: (org: string, filter: any = {}) => {
        let sql = 'SELECT * FROM questions WHERE organization_id = ?';
        const params = [org];
        if (filter.status) {
          sql += ' AND status = ?';
          params.push(filter.status);
        }
        const rows = db.prepare(sql).all(...params) as any[];
        return rows.map((r) => ({
          id: r.id, organizationId: r.organization_id, stem: r.stem, type: r.type,
          options: JSON.parse(r.options_json), correctOptionIndices: JSON.parse(r.correct_option_indices_json),
          explanation: r.explanation || '', scriptureReference: r.scripture_reference,
          topic: r.topic, difficulty: r.difficulty, language: r.language, status: r.status,
          createdAt: r.created_at, updatedAt: r.updated_at
        }));
      },
      transaction: (fn: any) => fn(),
      close: () => {}
    };

    bankService = new QuestionBankService(customQRepo);
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
  });

  t.afterEach(() => {
    setAuthorizedTeacherContext(null);
    setQuestionBankService(null);
    setQuizService(null);
  });

  // ADV-QZ-01 to 04: Cross-tenant isolation
  await t.test('ADV-QZ-01 to ADV-QZ-04: Strict multi-tenant isolation across all actions', async () => {
    const orgA = 'church-berea-alpha';
    const orgB = 'church-berea-beta';

    const qB = seedApprovedQuestion(bankService, orgB, 'Question from Org B');
    const quizB = quizService.createQuiz(orgB, {
      organizationId: orgB,
      title: 'Org B Secret Quiz'
    });
    quizService.addQuestion(orgB, quizB.id, qB);

    // Teacher Alpha is active (Org A)
    // 1. ADV-QZ-01: Cross-tenant quiz read
    const readRes = await getQuizByIdAction(quizB.id);
    assert.equal(readRes.success, false);
    assert.match(readRes.error!, /not found/i);

    // 2. ADV-QZ-02: Cross-tenant question attachment
    const quizA = quizService.createQuiz(orgA, {
      organizationId: orgA,
      title: 'Org A Quiz'
    });
    const attachRes = await addQuestionToQuizAction(quizA.id, qB);
    assert.equal(attachRes.success, false);
    assert.match(attachRes.error!, /not found or belongs to a different organization/i);

    // Assert zero questions attached to quizA in DB
    const auditA = captureDbAudit(db, quizA.id);
    assert.equal(auditA.quizQuestionsCount, 0);

    // 3. ADV-QZ-03: Cross-tenant mutation
    const updateRes = await updateQuizAction(quizB.id, { title: 'Hacked Title' });
    assert.equal(updateRes.success, false);
    assert.match(updateRes.error!, /not found/i);

    // Assert Org B quiz title in DB remains untouched
    const rawQuizB = db.prepare('SELECT title FROM quizzes WHERE id = ?').get(quizB.id) as any;
    assert.equal(rawQuizB.title, 'Org B Secret Quiz');

    // 4. ADV-QZ-04: Cross-tenant publish attempt
    const pubRes = await publishQuizAction(quizB.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /not found/i);

    // Assert Org B quiz remains DRAFT and 0 snapshots created
    const auditB = captureDbAudit(db, quizB.id);
    assert.equal(auditB.quizStatus, 'DRAFT');
    assert.equal(auditB.snapshotCount, 0);
  });

  // ADV-QZ-05: Runtime parameter allowlisting
  await t.test('ADV-QZ-05: Rejects or strips unauthorized fields (id, organizationId, status, publishedSnapshot)', async () => {
    const org = 'church-berea-alpha';
    const quiz = quizService.createQuiz(org, {
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
    const raw = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quiz.id) as any;
    assert.equal(raw.title, 'Legitimate Updated Title');
    assert.equal(raw.status, 'DRAFT');
    assert.equal(raw.organization_id, org);
  });

  // ADV-QZ-06: Unapproved question rejection
  await t.test('ADV-QZ-06: Adding DRAFT or PENDING_REVIEW question to quiz is strictly rejected', () => {
    const org = 'church-berea-alpha';
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Draft Question Test' });

    // Seed a DRAFT question
    const qDraft = bankService.createQuestion({
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

    assert.throws(
      () => quizService.addQuestion(org, quiz.id, qDraft.id),
      /Only APPROVED questions can be added/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 0);
  });

  // ADV-QZ-07: Archived question rejection
  await t.test('ADV-QZ-07: Adding ARCHIVED question to quiz is strictly rejected', () => {
    const org = 'church-berea-alpha';
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Archived Question Test' });

    const qArchived = bankService.createQuestion({
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
    bankService.transitionStatus(org, qArchived.id, QuestionStatus.ARCHIVED);

    assert.throws(
      () => quizService.addQuestion(org, quiz.id, qArchived.id),
      /Only APPROVED questions can be added/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 0);
  });

  // ADV-QZ-08 & ADV-QZ-25: TOCTOU question demotion during active publish
  await t.test('ADV-QZ-08 & ADV-QZ-25: TOCTOU - Question demoted right before publish causes transaction rollback', async () => {
    const org = 'church-berea-alpha';
    const qId = seedApprovedQuestion(bankService, org, 'TOCTOU Question');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'TOCTOU Quiz' });
    quizService.addQuestion(org, quiz.id, qId);

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

  // ADV-QZ-09: TOCTOU question archived before publish
  await t.test('ADV-QZ-09: TOCTOU - Question archived before publish causes atomic rollback', async () => {
    const org = 'church-berea-alpha';
    const qId = seedApprovedQuestion(bankService, org, 'TOCTOU Archived Question');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'TOCTOU Archived Quiz' });
    quizService.addQuestion(org, quiz.id, qId);

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
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Empty Quiz' });

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, false);
    assert.match(pubRes.error!, /at least 1 approved question/i);

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizStatus, 'DRAFT');
    assert.equal(audit.snapshotCount, 0);
  });

  // ADV-QZ-11: Duplicate question attachment
  await t.test('ADV-QZ-11: Attaching duplicate question to quiz is rejected', () => {
    const org = 'church-berea-alpha';
    const qId = seedApprovedQuestion(bankService, org, 'Duplicate Check Question');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Duplicate Quiz' });

    quizService.addQuestion(org, quiz.id, qId);

    assert.throws(
      () => quizService.addQuestion(org, quiz.id, qId),
      /already in quiz/i
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizQuestionsCount, 1);
  });

  // ADV-QZ-12: Duplicate positions rejected / normalized
  await t.test('ADV-QZ-12: Question positions remain strictly sequential [1..N]', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = seedApprovedQuestion(bankService, org, 'Q2');
    const q3 = seedApprovedQuestion(bankService, org, 'Q3');

    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Order Quiz' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.addQuestion(org, quiz.id, q2);
    quizService.addQuestion(org, quiz.id, q3);

    // Remove middle question (Q2)
    quizService.removeQuestion(org, quiz.id, q2);

    const questions = quizService.getQuizQuestions(org, quiz.id);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].questionId, q1);
    assert.equal(questions[0].sortOrder, 1);
    assert.equal(questions[1].questionId, q3);
    assert.equal(questions[1].sortOrder, 2); // Normalized to 2 (no gaps)
  });

  // ADV-QZ-13: Question reordering preserves all items
  await t.test('ADV-QZ-13 & ADV-QZ-14: Question reordering updates sequence deterministically', async () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = seedApprovedQuestion(bankService, org, 'Q2');
    const q3 = seedApprovedQuestion(bankService, org, 'Q3');

    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Reorder Quiz' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.addQuestion(org, quiz.id, q2);
    quizService.addQuestion(org, quiz.id, q3);

    // Reverse order: [q3, q2, q1]
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
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = seedApprovedQuestion(bankService, org, 'Q2');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Bad Reorder Quiz' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.addQuestion(org, quiz.id, q2);

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
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const q2 = seedApprovedQuestion(bankService, org, 'Q2');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Published Quiz' });
    quizService.addQuestion(org, quiz.id, q1);

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

  // ADV-QZ-17 & 18: Timer bounds
  await t.test('ADV-QZ-17 & ADV-QZ-18: Timer bounds strictly enforced (10 to 120 seconds integer)', () => {
    const org = 'church-berea-alpha';

    // Below min
    assert.throws(
      () => quizService.createQuiz(org, { organizationId: org, title: 'T', defaultTimeLimitSeconds: 9 }),
      /between 10 and 120/i
    );

    // Above max
    assert.throws(
      () => quizService.createQuiz(org, { organizationId: org, title: 'T', defaultTimeLimitSeconds: 121 }),
      /between 10 and 120/i
    );

    // Non-integer
    assert.throws(
      () => quizService.createQuiz(org, { organizationId: org, title: 'T', defaultTimeLimitSeconds: 30.5 }),
      /between 10 and 120/i
    );

    // Valid boundaries
    assert.doesNotThrow(() => quizService.createQuiz(org, { organizationId: org, title: 'T10', defaultTimeLimitSeconds: 10 }));
    assert.doesNotThrow(() => quizService.createQuiz(org, { organizationId: org, title: 'T120', defaultTimeLimitSeconds: 120 }));
  });

  // ADV-QZ-19: Invalid scoring style
  await t.test('ADV-QZ-19: Invalid scoring style string rejected', () => {
    const org = 'church-berea-alpha';
    assert.throws(
      () => quizService.createQuiz(org, { organizationId: org, title: 'T', scoringStyle: 'EXPONENTIAL' as any }),
      /Invalid scoring style/i
    );
  });

  // ADV-QZ-20 & 21: Snapshot immutability against Question Bank mutations & archive
  await t.test('ADV-QZ-20 & ADV-QZ-21: Published snapshot is 100% immune to subsequent Question Bank edits or archive', async () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Original Genesis Stem');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Immutable Snapshot Test' });
    quizService.addQuestion(org, quiz.id, q1);

    const pubRes = await publishQuizAction(quiz.id);
    assert.equal(pubRes.success, true);
    const originalSnapshot = pubRes.data!;

    // Mutate and archive question in the Question Bank
    db.prepare("UPDATE questions SET stem = 'TAMPERED STEM IN BANK', status = 'ARCHIVED' WHERE id = ?").run(q1);

    // Read published snapshot via action
    const snapRes = await getPublishedSnapshotAction(quiz.id);
    assert.equal(snapRes.success, true);
    assert.equal(snapRes.data?.questions[0].stem, 'Original Genesis Stem');
    assert.notEqual(snapRes.data?.questions[0].stem, 'TAMPERED STEM IN BANK');

    // Read directly from SQLite snapshot table
    const rawSnap = db.prepare('SELECT snapshot_json FROM published_quiz_snapshots WHERE quiz_id = ?').get(quiz.id) as any;
    const parsed = JSON.parse(rawSnap.snapshot_json);
    assert.equal(parsed.questions[0].stem, 'Original Genesis Stem');
  });

  // ADV-QZ-22: Direct SQL UPDATE against published_quiz_snapshots
  await t.test('ADV-QZ-22: SQLite trigger prevent_snapshot_update aborts direct SQL UPDATE', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Stem 1');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Trigger Update Test' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare("UPDATE published_quiz_snapshots SET title = 'Hacked' WHERE quiz_id = ?").run(quiz.id);
      },
      (err: any) => /IMMUTABILITY_VIOLATION.*cannot be updated/i.test(err.message)
    );

    // Verify row in DB is unchanged
    const rawSnap = db.prepare('SELECT title FROM published_quiz_snapshots WHERE quiz_id = ?').get(quiz.id) as any;
    assert.equal(rawSnap.title, 'Trigger Update Test');
  });

  // ADV-QZ-23: Direct SQL DELETE against published_quiz_snapshots
  await t.test('ADV-QZ-23: SQLite trigger prevent_snapshot_delete aborts direct SQL DELETE', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Stem 1');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Trigger Delete Test' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare('DELETE FROM published_quiz_snapshots WHERE quiz_id = ?').run(quiz.id);
      },
      (err: any) => /IMMUTABILITY_VIOLATION.*cannot be deleted/i.test(err.message)
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.snapshotCount, 1);
  });

  // ADV-QZ-24: Participant answer secrecy projection boundary
  await t.test('ADV-QZ-24: Participant question projection strips correctOptionIndices and explanation', () => {
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
  await t.test('ADV-QZ-26: Deterministic atomic rollback via simulateSnapshotFailure seam', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Rollback Test Quiz' });
    quizService.addQuestion(org, quiz.id, q1);

    const preAudit = captureDbAudit(db, quiz.id);
    assert.equal(preAudit.quizStatus, 'DRAFT');
    assert.equal(preAudit.snapshotCount, 0);

    // Arm the test seam
    quizRepo.simulateSnapshotFailure = true;

    assert.throws(
      () => quizService.publishQuiz(org, quiz.id, 'teacher-1'),
      /TEST_SIMULATED_SNAPSHOT_PERSISTENCE_FAILURE/
    );

    // Direct SQLite table audit: proves 100% rollback
    const postAudit = captureDbAudit(db, quiz.id);
    assert.equal(postAudit.quizStatus, 'DRAFT', 'Quiz status must remain DRAFT after failure');
    assert.equal(postAudit.snapshotCount, 0, 'Zero snapshot rows must exist after rollback');

    // Disarm seam and verify publish now succeeds cleanly
    quizRepo.simulateSnapshotFailure = false;
    assert.doesNotThrow(() => quizService.publishQuiz(org, quiz.id, 'teacher-1'));

    const finalAudit = captureDbAudit(db, quiz.id);
    assert.equal(finalAudit.quizStatus, 'PUBLISHED');
    assert.equal(finalAudit.snapshotCount, 1);
  });

  // ADV-QZ-27 (QA Gap 1): Question Options Invalidated TOCTOU
  await t.test('ADV-QZ-27: Question options invalidated TOCTOU before publish causes rollback', async () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Stem with options');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Invalidated Options Quiz' });
    quizService.addQuestion(org, quiz.id, q1);

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
  await t.test('ADV-QZ-28: SQLite trigger prevent_published_quiz_delete prevents deleting published quiz', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Cannot Delete Quiz' });
    quizService.addQuestion(org, quiz.id, q1);
    quizService.publishQuiz(org, quiz.id, 'teacher-1');

    assert.throws(
      () => {
        db.prepare('DELETE FROM quizzes WHERE id = ?').run(quiz.id);
      },
      (err: any) => /ILLEGAL_OPERATION.*cannot be physically deleted/i.test(err.message)
    );

    const audit = captureDbAudit(db, quiz.id);
    assert.equal(audit.quizCount, 1);
  });

  // ADV-QZ-29 (QA Gap 3): Archived quiz cannot be modified or published
  await t.test('ADV-QZ-29: ARCHIVED quiz is locked out from mutation and publishing', async () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');
    const quiz = quizService.createQuiz(org, { organizationId: org, title: 'Archived Quiz' });
    quizService.addQuestion(org, quiz.id, q1);

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
  await t.test('ADV-QZ-30: Draft archive can be restored to DRAFT; Published archive cannot', () => {
    const org = 'church-berea-alpha';
    const q1 = seedApprovedQuestion(bankService, org, 'Q1');

    // 1. Draft -> Archived -> Draft
    const draftQuiz = quizService.createQuiz(org, { organizationId: org, title: 'Draft Archivable' });
    quizService.archiveQuiz(org, draftQuiz.id);
    const restored = quizService.restoreDraftQuiz(org, draftQuiz.id);
    assert.equal(restored?.status, QuizStatus.DRAFT);

    // 2. Published -> Archived -> Draft (FORBIDDEN)
    const pubQuiz = quizService.createQuiz(org, { organizationId: org, title: 'Pub Archivable' });
    quizService.addQuestion(org, pubQuiz.id, q1);
    quizService.publishQuiz(org, pubQuiz.id, 'teacher-1');
    quizService.archiveQuiz(org, pubQuiz.id);

    assert.throws(
      () => quizService.restoreDraftQuiz(org, pubQuiz.id),
      /Cannot restore a published archived quiz back to DRAFT/i
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
