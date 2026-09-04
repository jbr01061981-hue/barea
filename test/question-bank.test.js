const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  DomainValidationError,
  InvalidLifecycleTransitionError,
  validateQuestionPayload,
  assertValidStatusTransition,
  SqliteQuestionRepository,
  QuestionBankService
} = require('../src/index');

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
});

test('Question Lifecycle State Transitions', async (t) => {
  await t.test('valid transitions succeed', () => {
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.DRAFT, QuestionStatus.PENDING_REVIEW));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.PENDING_REVIEW, QuestionStatus.APPROVED));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.PENDING_REVIEW, QuestionStatus.DRAFT));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.APPROVED, QuestionStatus.ARCHIVED));
    assert.doesNotThrow(() => assertValidStatusTransition(QuestionStatus.ARCHIVED, QuestionStatus.DRAFT));
  });

  await t.test('invalid transitions are rejected', () => {
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.DRAFT, QuestionStatus.APPROVED),
      InvalidLifecycleTransitionError
    );
    assert.throws(
      () => assertValidStatusTransition(QuestionStatus.APPROVED, QuestionStatus.PENDING_REVIEW),
      InvalidLifecycleTransitionError
    );
  });
});

test('Question Bank Persistence & Service CRUD Operations', async (t) => {
  const repo = new SqliteQuestionRepository(':memory:');
  const service = new QuestionBankService(repo);

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

    assert.ok(created.id);
    assert.equal(created.organizationId, 'church-alpha');
    assert.equal(created.stem, 'Where was Paul converted on the road to?');
    assert.equal(created.status, QuestionStatus.DRAFT);
    assert.equal(created.difficulty, QuestionDifficulty.MEDIUM);
    assert.deepEqual(created.correctOptionIndices, [1]);

    const retrieved = service.getQuestion('church-alpha', created.id);
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

    const updated = service.updateQuestion('church-alpha', created.id, {
      stem: 'Updated stem with more clarity',
      difficulty: QuestionDifficulty.HARD
    });

    assert.equal(updated.stem, 'Updated stem with more clarity');
    assert.equal(updated.difficulty, QuestionDifficulty.HARD);
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
    const inReview = service.transitionStatus('church-alpha', created.id, QuestionStatus.PENDING_REVIEW);
    assert.equal(inReview.status, QuestionStatus.PENDING_REVIEW);

    const approved = service.transitionStatus('church-alpha', created.id, QuestionStatus.APPROVED);
    assert.equal(approved.status, QuestionStatus.APPROVED);

    // Invalid transition: APPROVED directly to DRAFT (not allowed, must go via ARCHIVED)
    assert.throws(
      () => service.transitionStatus('church-alpha', created.id, QuestionStatus.DRAFT),
      InvalidLifecycleTransitionError
    );
  });

  await t.test('filters by topic, difficulty, type, language, status, and search', () => {
    service.createQuestion({
      organizationId: 'church-filter-test',
      stem: 'Creation light query',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Genesis 1:3',
      topic: 'Creation',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
      status: QuestionStatus.APPROVED
    });

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

    service.createQuestion({
      organizationId: 'church-filter-test',
      stem: 'David and Goliath battle',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['5 stones', '3 stones', '1 stone'],
      correctOptionIndices: [0],
      scriptureReference: '1 Samuel 17:40',
      topic: 'Kingdom',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en',
      status: QuestionStatus.APPROVED
    });

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
      language: 'en',
      status: QuestionStatus.APPROVED
    });

    const qB = service.createQuestion({
      organizationId: 'church-B',
      stem: 'Church B question',
      type: QuestionType.TRUE_FALSE,
      options: ['True', 'False'],
      correctOptionIndices: [0],
      scriptureReference: 'Romans 1:1',
      topic: 'Doctrine',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
      status: QuestionStatus.APPROVED
    });

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
});
