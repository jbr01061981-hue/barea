import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  DomainValidationError,
  InvalidLifecycleTransitionError,
  validateQuestionPayload,
  assertValidStatusTransition,
  SqliteQuestionRepository,
  QuestionBankService,
  type CreateQuestionPayload
} from '../src/index';

test('Question Domain & Validation', async (t) => {
  await t.test('accepts valid MCQ question payload', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Who led the Israelites out of Egypt?',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Abraham', 'Moses', 'David', 'Elijah'],
      correctOptionIndices: [1],
      explanation: 'God called Moses through the burning bush.',
      scriptureReference: 'Exodus 3:10',
      topic: 'Exodus',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.doesNotThrow(() => validateQuestionPayload(payload, false));
  });

  await t.test('accepts valid TRUE_FALSE question payload', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Jesus was born in Bethlehem.',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      explanation: 'Prophesied in Micah 5:2 and fulfilled in Luke 2.',
      scriptureReference: 'Luke 2:4-7',
      topic: 'Gospels',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.doesNotThrow(() => validateQuestionPayload(payload, false));
  });

  await t.test('accepts valid MULTI_SELECT question payload', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Which of the following are fruits of the Spirit?',
      type: QuestionType.MULTI_SELECT,
      options: ['Love', 'Joy', 'Pride', 'Peace'],
      correctOptionIndices: [0, 1, 3],
      explanation: 'Galatians 5:22-23 lists love, joy, peace, patience...',
      scriptureReference: 'Galatians 5:22-23',
      topic: 'Epistles',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.doesNotThrow(() => validateQuestionPayload(payload, false));
  });

  await t.test('rejects empty organizationId', () => {
    const payload = {
      organizationId: '   ',
      stem: 'Test question',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload, false), /organizationId is required/);
  });

  await t.test('rejects empty stem', () => {
    const payload = {
      organizationId: 'church-1',
      stem: '   ',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload, false), /stem text is required/);
  });

  await t.test('rejects invalid difficulty', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Test stem',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: 'SuperHard',
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload, false), /Invalid difficulty/);
  });

  await t.test('rejects invalid question type', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Test stem',
      type: 'FILL_IN_BLANK',
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.HARD,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload, false), /Invalid question type/);
  });

  await t.test('rejects out of bounds correctOptionIndices', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Test stem',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [5],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload, false), /out of bounds/);
  });

  await t.test('rejects duplicate correctOptionIndices in MULTI_SELECT', () => {
    const payload1 = {
      organizationId: 'church-1',
      stem: 'Test stem duplicate zeros',
      type: QuestionType.MULTI_SELECT,
      options: ['A', 'B', 'C'],
      correctOptionIndices: [0, 0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload1, false), /Duplicate correct option index/);

    const payload2 = {
      organizationId: 'church-1',
      stem: 'Test stem duplicate ones',
      type: QuestionType.MULTI_SELECT,
      options: ['A', 'B', 'C', 'D'],
      correctOptionIndices: [1, 1, 2],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.throws(() => validateQuestionPayload(payload2, false), /Duplicate correct option index/);
  });

  await t.test('rejects question creation with explicit APPROVED status', () => {
    const payload = {
      organizationId: 'church-1',
      stem: 'Directly approved question stem',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
      status: QuestionStatus.APPROVED
    };
    assert.throws(
      () => validateQuestionPayload(payload, false),
      /Questions cannot be created directly with APPROVED status/
    );
  });
});

test('Question Lifecycle State Transitions', async (t) => {
  await t.test('valid transitions succeed', () => {
    // DRAFT transitions
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.DRAFT, QuestionStatus.PENDING_REVIEW));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.DRAFT, QuestionStatus.ARCHIVED));

    // PENDING_REVIEW transitions
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.PENDING_REVIEW, QuestionStatus.APPROVED));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.PENDING_REVIEW, QuestionStatus.DRAFT));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.PENDING_REVIEW, QuestionStatus.ARCHIVED));

    // APPROVED transitions (cannot bypass review to DRAFT; can be demoted for edit or archived)
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.APPROVED, QuestionStatus.PENDING_REVIEW));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.APPROVED, QuestionStatus.ARCHIVED));

    // ARCHIVED transitions
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.ARCHIVED, QuestionStatus.DRAFT));
  });

  await t.test('invalid transitions are rejected', () => {
    // DRAFT cannot jump directly to APPROVED (must pass review gate)
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.DRAFT, QuestionStatus.APPROVED),
      InvalidLifecycleTransitionError
    );

    // APPROVED cannot transition directly to DRAFT (must be demoted to PENDING_REVIEW or ARCHIVED)
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.APPROVED, QuestionStatus.DRAFT),
      InvalidLifecycleTransitionError
    );

    // ARCHIVED cannot jump directly to APPROVED or PENDING_REVIEW
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.ARCHIVED, QuestionStatus.APPROVED),
      InvalidLifecycleTransitionError
    );
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.ARCHIVED, QuestionStatus.PENDING_REVIEW),
      InvalidLifecycleTransitionError
    );
  });
});

test('Question Bank Persistence & Service CRUD Operations', async (t) => {
  const repo = new SqliteQuestionRepository(':memory:');
  const service = new QuestionBankService(repo);

  await t.test('creates question defaulting to DRAFT and rejects explicit APPROVED create in repository/service', () => {
    // Default creation produces DRAFT
    const defaultCreated = service.createQuestion({
      organizationId: 'church-create-test',
      stem: 'Question created with default status',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    assert.equal(defaultCreated.status, QuestionStatus.DRAFT);

    // Explicit DRAFT creation succeeds
    const explicitDraft = service.createQuestion({
      organizationId: 'church-create-test',
      stem: 'Question created with explicit DRAFT status',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
      status: QuestionStatus.DRAFT
    });
    assert.equal(explicitDraft.status, QuestionStatus.DRAFT);

    // Direct create with APPROVED status is rejected
    assert.throws(
      () => service.createQuestion({
        organizationId: 'church-create-test',
        stem: 'Question created with explicit APPROVED status',
        type: QuestionType.TRUE_FALSE,
        options: ['True', 'False'],
        correctOptionIndices: [0],
        scriptureReference: 'Genesis 1:1',
        topic: 'Creation',
        difficulty: QuestionDifficulty.EASY,
        language: 'en',
        status: QuestionStatus.APPROVED
      }),
      /Questions cannot be created directly with APPROVED status/
    );

    // APPROVED can only be reached through the legitimate review lifecycle:
    // DRAFT -> PENDING_REVIEW -> APPROVED
    const inReview = service.transitionStatus('church-create-test', defaultCreated.id, QuestionStatus.PENDING_REVIEW);
    assert.equal(inReview!.status, QuestionStatus.PENDING_REVIEW);

    const approved = service.transitionStatus('church-create-test', defaultCreated.id, QuestionStatus.APPROVED);
    assert.equal(approved!.status, QuestionStatus.APPROVED);
  });

  await t.test('creates and retrieves question with durable persistence', () => {
    const created = service.createQuestion({
      organizationId: 'church-alpha',
      stem: 'Where was Paul converted on the road to?',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Jerusalem', 'Damascus', 'Antioch', 'Rome'],
      correctOptionIndices: [1],
      explanation: 'A light from heaven flashed around him near Damascus.',
      scriptureReference: 'Acts 9:3',
      topic: 'Acts',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en',
      status: QuestionStatus.DRAFT
    });

    assert.ok(created!.id);
    assert.equal(created.organizationId, 'church-alpha');
    assert.equal(created!.stem, 'Where was Paul converted on the road to?');
    assert.equal(created.status, QuestionStatus.DRAFT);
    assert.equal(created.difficulty, QuestionDifficulty.MEDIUM);
    assert.deepEqual(created.correctOptionIndices, [1]);

    const retrieved = service.getQuestion('church-alpha', created!.id);
    assert.deepEqual(retrieved, created);
  });

  await t.test('updates question content and preserves domain invariants', () => {
    const created = service.createQuestion({
      organizationId: 'church-alpha',
      stem: 'Original stem',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      scriptureReference: 'John 1:1',
      topic: 'Gospels',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });

    const updated = service.updateQuestion('church-alpha', created!.id, {
      stem: 'Updated stem with more clarity',
      difficulty: QuestionDifficulty.HARD
    });

    assert.equal(updated!.stem, 'Updated stem with more clarity');
    assert.equal(updated!.difficulty, QuestionDifficulty.HARD);
  });

  await t.test('validates lifecycle transition in service', () => {
    const created = service.createQuestion({
      organizationId: 'church-alpha',
      stem: 'Life transition test',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
      status: QuestionStatus.DRAFT
    });

    // Valid: DRAFT -> PENDING_REVIEW -> APPROVED
    const inReview = service.transitionStatus('church-alpha', created!.id, QuestionStatus.PENDING_REVIEW);
    assert.equal(inReview!.status, QuestionStatus.PENDING_REVIEW);

    const approved = service.transitionStatus('church-alpha', created!.id, QuestionStatus.APPROVED);
    assert.equal(approved!.status, QuestionStatus.APPROVED);

    // Invalid transition: APPROVED directly to DRAFT (not allowed, must go via ARCHIVED)
    assert.throws(
      () => service.transitionStatus('church-alpha', created!.id, QuestionStatus.DRAFT),
      InvalidLifecycleTransitionError
    );
  });

  await t.test('filters by topic, difficulty, type, language, status, and search', () => {
    const q1 = service.createQuestion({
      organizationId: 'church-filter-test',
      stem: 'Creation light query',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:3',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service.transitionStatus('church-filter-test', q1.id, QuestionStatus.PENDING_REVIEW);
    service.transitionStatus('church-filter-test', q1.id, QuestionStatus.APPROVED);

    service.createQuestion({
      organizationId: 'church-filter-test',
      stem: 'Adam and Eve deep study',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Eden', 'Ur', 'Babel'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 2:8',
      topic: 'Creation',
      difficulty: QuestionDifficulty.HARD,
      language: 'en',
      status: QuestionStatus.DRAFT
    });

    const q3 = service.createQuestion({
      organizationId: 'church-filter-test',
      stem: 'David and Goliath battle',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['5 stones', '3 stones', '1 stone'],
      correctOptionIndices: [0],
      scriptureReference: '1 Samuel 17:40',
      topic: 'Kingdom',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    });
    service.transitionStatus('church-filter-test', q3.id, QuestionStatus.PENDING_REVIEW);
    service.transitionStatus('church-filter-test', q3.id, QuestionStatus.APPROVED);

    // Filter by topic
    const creationQuestions = service.listQuestions('church-filter-test', { topic: 'Creation' });
    assert.equal(creationQuestions.length, 2);

    // Filter by difficulty
    const hardQuestions = service.listQuestions('church-filter-test', { difficulty: QuestionDifficulty.HARD });
    assert.equal(hardQuestions.length, 1);
    assert.equal(hardQuestions[0].stem, 'Adam and Eve deep study');

    // Filter by approved only
    const approvedQuestions = service.listApprovedQuestions('church-filter-test');
    assert.equal(approvedQuestions.length, 2);
    for (const q of approvedQuestions) {
      assert.equal(q.status, QuestionStatus.APPROVED);
    }

    // Search by text
    const searchResults = service.listQuestions('church-filter-test', { search: 'Goliath' });
    assert.equal(searchResults.length, 1);
    assert.equal(searchResults[0].stem, 'David and Goliath battle');
  });

  await t.test('enforces strict organizational ownership isolation', () => {
    const qA = service.createQuestion({
      organizationId: 'church-A',
      stem: 'Church A question',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Romans 1:1',
      topic: 'Doctrine',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service.transitionStatus('church-A', qA.id, QuestionStatus.PENDING_REVIEW);
    service.transitionStatus('church-A', qA.id, QuestionStatus.APPROVED);

    const qB = service.createQuestion({
      organizationId: 'church-B',
      stem: 'Church B question',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Romans 1:1',
      topic: 'Doctrine',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service.transitionStatus('church-B', qB.id, QuestionStatus.PENDING_REVIEW);
    service.transitionStatus('church-B', qB.id, QuestionStatus.APPROVED);

    // Church B cannot retrieve Church A question
    const crossRetrieve = service.getQuestion('church-B', qA.id);
    assert.equal(crossRetrieve, null);

    // Church A cannot list Church B questions
    const churchAList = service.listQuestions('church-A');
    assert.equal(churchAList.length, 1);
    assert.equal(churchAList[0].id, qA.id);

    const churchBList = service.listQuestions('church-B');
    assert.equal(churchBList.length, 1);
    assert.equal(churchBList[0].id, qB.id);
  });

  await t.test('modifying approved question content cannot leave it silently approved (demotes to PENDING_REVIEW)', () => {
    const draft = service.createQuestion({
      organizationId: 'church-review-safe',
      stem: 'Original approved stem question',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Alpha', 'Beta'],
      correctOptionIndices: [0],
      scriptureReference: 'Acts 1:1',
      topic: 'Acts',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service.transitionStatus('church-review-safe', draft.id, QuestionStatus.PENDING_REVIEW);
    const created = service.transitionStatus('church-review-safe', draft.id, QuestionStatus.APPROVED);

    assert.equal(created!.status, QuestionStatus.APPROVED);

    // Editing question content without explicit status resets status to PENDING_REVIEW
    const updatedContent = service.updateQuestion('church-review-safe', created!.id, {
      stem: 'Modified stem text requiring fresh review'
    });

    assert.equal(updatedContent!.stem, 'Modified stem text requiring fresh review');
    assert.equal(updatedContent!.status, QuestionStatus.PENDING_REVIEW);

    // Verify it is no longer returned in listApprovedQuestions
    const approvedList = service.listApprovedQuestions('church-review-safe');
    assert.equal(approvedList.some((q) => q.id === created!.id), false);

    // Attempting to edit content while explicitly requesting to remain APPROVED also forces PENDING_REVIEW
    const approvedAgain = service.transitionStatus('church-review-safe', created!.id, QuestionStatus.APPROVED);
    assert.equal(approvedAgain!.status, QuestionStatus.APPROVED);

    const modifiedAgain = service.updateQuestion('church-review-safe', created!.id, {
      explanation: 'Updated theological explanation note',
      status: QuestionStatus.APPROVED
    });
    assert.equal(modifiedAgain!.status, QuestionStatus.PENDING_REVIEW);

    // Pure status-only transition (e.g. archiving) does not trigger content demotion
    const reApproved = service.transitionStatus('church-review-safe', created!.id, QuestionStatus.APPROVED);
    assert.equal(reApproved!.status, QuestionStatus.APPROVED);

    const archived = service.updateQuestion('church-review-safe', created!.id, {
      status: QuestionStatus.ARCHIVED
    });
    assert.equal(archived!.status, QuestionStatus.ARCHIVED);
  });

  await t.test('archiveQuestion soft-deletes question to ARCHIVED status', () => {
    const draft = service.createQuestion({
      organizationId: 'church-archive-test',
      stem: 'Question to be archived',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:1',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service.transitionStatus('church-archive-test', draft.id, QuestionStatus.PENDING_REVIEW);
    const created = service.transitionStatus('church-archive-test', draft.id, QuestionStatus.APPROVED);

    assert.equal(created!.status, QuestionStatus.APPROVED);

    const archived = service.archiveQuestion('church-archive-test', created!.id);
    assert.equal(archived!.status, QuestionStatus.ARCHIVED);

    // Archived question is excluded from listApprovedQuestions
    const approvedList = service.listApprovedQuestions('church-archive-test');
    assert.equal(approvedList.some((q) => q.id === created!.id), false);

    // Can still be retrieved by id and transitioned to DRAFT if unarchived
    const retrieved = service.getQuestion('church-archive-test', created!.id);
    assert.equal(retrieved!.status, QuestionStatus.ARCHIVED);

    const unarchived = service.transitionStatus('church-archive-test', created!.id, QuestionStatus.DRAFT);
    assert.equal(unarchived!.status, QuestionStatus.DRAFT);
  });
});

test('Question Bank Durable Persistence Across File Reopen', async (t) => {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const tmpDbPath = path.join(os.tmpdir(), `barea_test_durable_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);

  try {
    // 1. Create repository against temporary database file
    const repo1 = new SqliteQuestionRepository(tmpDbPath);
    const service1 = new QuestionBankService(repo1);

    // 2. Create question through legitimate review lifecycle
    const draft = service1.createQuestion({
      organizationId: 'church-durable-org',
      stem: 'Is God eternal?',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      explanation: 'From everlasting to everlasting You are God.',
      scriptureReference: 'Psalm 90:2',
      topic: 'Theology',
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });
    service1.transitionStatus('church-durable-org', draft.id, QuestionStatus.PENDING_REVIEW);
    const created = service1.transitionStatus('church-durable-org', draft.id, QuestionStatus.APPROVED);
    assert.ok(created!.id);
    assert.equal(created!.stem, 'Is God eternal?');
    assert.equal(created!.status, QuestionStatus.APPROVED);

    // 3. Close repository
    repo1.close();

    // 4. Reopen repository against same database file
    const repo2 = new SqliteQuestionRepository(tmpDbPath);
    const service2 = new QuestionBankService(repo2);

    // 5. Retrieve question
    const retrieved = service2.getQuestion('church-durable-org', created!.id);

    // 6. Verify data is still present and matches
    assert.ok(retrieved);
    assert.equal(retrieved.id, created!.id);
    assert.equal(retrieved.organizationId, 'church-durable-org');
    assert.equal(retrieved.stem, 'Is God eternal?');
    assert.equal(retrieved!.status, QuestionStatus.APPROVED);
    assert.equal(retrieved.difficulty, QuestionDifficulty.EASY);
    assert.deepEqual(retrieved.options, ['True', 'False']);
    assert.deepEqual(retrieved.correctOptionIndices, [0]);
    assert.equal(retrieved.scriptureReference, 'Psalm 90:2');

    repo2.close();
  } finally {
    // 7. Clean up temporary database file and journal/wal files if created
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const fileToClean = tmpDbPath + suffix;
      if (fs.existsSync(fileToClean)) {
        try {
          fs.unlinkSync(fileToClean);
        } catch {
          // ignore cleanup lock error if any
        }
      }
    }
  }
});

test('CommonJS Runtime Contract & Public Exports', () => {
  // Verifies that the compiled package can be loaded through CommonJS require()
  // and exposes all expected public BAREA exports.
  const path = require('path');
  const fs = require('fs');
  const candidates = [
    path.resolve(__dirname, '../../dist/index.js'),
    path.resolve(process.cwd(), 'dist/index.js'),
    path.resolve(__dirname, '../src/index.js'),
    path.resolve(process.cwd(), 'dist/src/index.js')
  ];
  const resolvedPath = candidates.find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), 'dist/index.js');

  assert.ok(fs.existsSync(resolvedPath), 'dist/index.js (or dist/src/index.js) must exist after build');

  const barea = require(resolvedPath);

  assert.ok(barea, 'BAREA root export must be truthy');
  assert.equal(typeof barea.QuestionDifficulty, 'object');
  assert.equal(barea.QuestionDifficulty.EASY, 'Easy');
  assert.equal(barea.QuestionDifficulty.MEDIUM, 'Medium');
  assert.equal(barea.QuestionDifficulty.HARD, 'Hard');

  assert.equal(typeof barea.QuestionType, 'object');
  assert.equal(barea.QuestionType.MULTIPLE_CHOICE, 'MULTIPLE_CHOICE');
  assert.equal(barea.QuestionType.TRUE_FALSE, 'TRUE_FALSE');
  assert.equal(barea.QuestionType.MULTI_SELECT, 'MULTI_SELECT');

  assert.equal(typeof barea.QuestionStatus, 'object');
  assert.equal(barea.QuestionStatus.DRAFT, 'DRAFT');
  assert.equal(barea.QuestionStatus.PENDING_REVIEW, 'PENDING_REVIEW');
  assert.equal(barea.QuestionStatus.APPROVED, 'APPROVED');
  assert.equal(barea.QuestionStatus.ARCHIVED, 'ARCHIVED');

  assert.equal(typeof barea.VALID_STATUS_TRANSITIONS, 'object');
  assert.equal(typeof barea.DomainValidationError, 'function');
  assert.equal(typeof barea.InvalidLifecycleTransitionError, 'function');
  assert.equal(typeof barea.validateQuestionPayload, 'function');
  assert.equal(typeof barea.assertValidStatusTransition, 'function');
  assert.equal(typeof barea.SqliteQuestionRepository, 'function');
  assert.equal(typeof barea.QuestionBankService, 'function');
  assert.equal(typeof barea.AIGenerationService, 'function');
  assert.equal(typeof barea.FakeAIProvider, 'function');
  assert.equal(typeof barea.GeminiAIProvider, 'function');
  assert.equal(typeof barea.validateGenerationRequest, 'function');
  assert.equal(typeof barea.validateStructuralOutput, 'function');
  assert.equal(typeof barea.GenerationValidationError, 'function');
  assert.equal(typeof barea.StructuralValidationError, 'function');
  assert.equal(typeof barea.AIProviderError, 'function');
});

