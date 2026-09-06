import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QuestionDifficulty,
  QuestionType,
  QuestionStatus,
  SqliteQuestionRepository,
  QuestionBankService,
  AIGenerationService,
  FakeAIProvider,
  type Question,
} from '../src/index';

import {
  getPendingQuestionsAction,
  getQuestionByIdAction,
  updateQuestionAction,
  approveQuestionAction,
  batchApproveQuestionsAction,
  archiveQuestionAction,
  regenerateQuestionAction,
} from '../src/app/teacher/review/actions';
import {
  setQuestionBankService,
  setAIGenerationService,
} from '../src/app/teacher/review/db';

test('Teacher Review Workflow & Actions (BAREA-004)', async (t) => {
  const repo = new SqliteQuestionRepository(':memory:');
  const bankService = new QuestionBankService(repo);
  const fakeProvider = new FakeAIProvider();
  const aiService = new AIGenerationService({
    aiProvider: fakeProvider,
    questionBankService: bankService,
  });

  setQuestionBankService(bankService);
  setAIGenerationService(aiService);

  t.after(() => {
    setQuestionBankService(null);
    setAIGenerationService(null);
  });

  const orgA = 'church-review-alpha';
  const orgB = 'church-review-beta';

  // Seed sample question directly through domain lifecycle
  const draft1 = bankService.createQuestion({
    organizationId: orgA,
    stem: 'What was the first thing God created?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['Light', 'Earth', 'Animals'],
    correctOptionIndices: [0],
    explanation: 'Genesis 1:3',
    scriptureReference: 'Genesis 1:3',
    topic: 'Creation',
    difficulty: QuestionDifficulty.EASY,
    language: 'en',
  });
  const pending1 = bankService.transitionStatus(orgA, draft1.id, QuestionStatus.PENDING_REVIEW)!;

  const draft2 = bankService.createQuestion({
    organizationId: orgA,
    stem: 'Who was the father of Isaac?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['Abraham', 'Jacob', 'Noah'],
    correctOptionIndices: [0],
    explanation: 'Genesis 21:3',
    scriptureReference: 'Genesis 21:3',
    topic: 'Patriarchs',
    difficulty: QuestionDifficulty.EASY,
    language: 'en',
  });
  const pending2 = bankService.transitionStatus(orgA, draft2.id, QuestionStatus.PENDING_REVIEW)!;

  // Question for Org B
  const draftB = bankService.createQuestion({
    organizationId: orgB,
    stem: 'Who built the ark?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: ['Noah', 'Moses'],
    correctOptionIndices: [0],
    explanation: 'Genesis 6:14',
    scriptureReference: 'Genesis 6:14',
    topic: 'Noah',
    difficulty: QuestionDifficulty.EASY,
    language: 'en',
  });
  bankService.transitionStatus(orgB, draftB.id, QuestionStatus.PENDING_REVIEW);

  await t.test('1. queue returns only pending questions for the specified organization', async () => {
    const resA = await getPendingQuestionsAction(orgA);
    assert.ok(resA.success);
    assert.equal(resA.data?.length, 2);
    assert.ok(resA.data?.every((q: Question) => q.status === QuestionStatus.PENDING_REVIEW));
    assert.ok(resA.data?.every((q: Question) => q.organizationId === orgA));

    const resB = await getPendingQuestionsAction(orgB);
    assert.ok(resB.success);
    assert.equal(resB.data?.length, 1);
    assert.equal(resB.data?.[0].organizationId, orgB);
  });

  await t.test('2. saving an edit updates content and preserves PENDING_REVIEW state (never approves)', async () => {
    const editRes = await updateQuestionAction(orgA, pending1.id, {
      stem: 'According to Genesis 1:3, what was created first?',
      explanation: 'God said, Let there be light.',
    });

    assert.ok(editRes.success);
    assert.equal(editRes.data?.stem, 'According to Genesis 1:3, what was created first?');
    assert.equal(editRes.data?.explanation, 'God said, Let there be light.');
    // Critical BAREA-004 invariant: edit does NOT approve
    assert.equal(editRes.data?.status, QuestionStatus.PENDING_REVIEW);

    const verified = await getQuestionByIdAction(orgA, pending1.id);
    assert.equal(verified.data?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('3. rejects invalid edit payload and leaves question unchanged', async () => {
    const badRes = await updateQuestionAction(orgA, pending1.id, {
      stem: '', // Empty stem is invalid
    });
    assert.equal(badRes.success, false);
    assert.match(badRes.error || '', /Question stem text is required and cannot be empty/);

    const verified = await getQuestionByIdAction(orgA, pending1.id);
    assert.notEqual(verified.data?.stem, '');
  });

  await t.test('4. explicit single approval transitions PENDING_REVIEW -> APPROVED', async () => {
    const approveRes = await approveQuestionAction(orgA, pending1.id);
    assert.ok(approveRes.success);
    assert.equal(approveRes.data?.status, QuestionStatus.APPROVED);

    // Verified removed from pending queue
    const queue = await getPendingQuestionsAction(orgA);
    assert.equal(queue.data?.length, 1);
    assert.equal(queue.data?.[0].id, pending2.id);
  });

  await t.test('5. batch approval transitions multiple questions atomically', async () => {
    // Add two more pending questions
    const qA = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Batch Q1',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      explanation: 'Exp',
      scriptureReference: 'Gen 1',
      topic: 'Gen',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
    });
    const pA = bankService.transitionStatus(orgA, qA.id, QuestionStatus.PENDING_REVIEW)!;

    const qB = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Batch Q2',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      explanation: 'Exp',
      scriptureReference: 'Gen 2',
      topic: 'Gen',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
    });
    const pB = bankService.transitionStatus(orgA, qB.id, QuestionStatus.PENDING_REVIEW)!;

    const batchRes = await batchApproveQuestionsAction(orgA, [pA.id, pB.id]);
    assert.ok(batchRes.success);
    assert.equal(batchRes.data?.approvedCount, 2);

    const checkA = await getQuestionByIdAction(orgA, pA.id);
    const checkB = await getQuestionByIdAction(orgA, pB.id);
    assert.equal(checkA.data?.status, QuestionStatus.APPROVED);
    assert.equal(checkB.data?.status, QuestionStatus.APPROVED);
  });

  await t.test('6. batch approval rolls back completely if any transition fails (all-or-nothing)', async () => {
    // One valid pending question, one non-existent question ID
    const qC = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Batch Rollback Q',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['A', 'B'],
      correctOptionIndices: [0],
      explanation: 'Exp',
      scriptureReference: 'Gen 3',
      topic: 'Gen',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
    });
    const pC = bankService.transitionStatus(orgA, qC.id, QuestionStatus.PENDING_REVIEW)!;

    const failBatchRes = await batchApproveQuestionsAction(orgA, [pC.id, 'non-existent-id']);
    assert.equal(failBatchRes.success, false);

    // Crucial rollback verification: pC must STILL be PENDING_REVIEW
    const checkC = await getQuestionByIdAction(orgA, pC.id);
    assert.equal(checkC.data?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('7. archive action sets question status to ARCHIVED', async () => {
    const archiveRes = await archiveQuestionAction(orgA, pending2.id);
    assert.ok(archiveRes.success);
    assert.equal(archiveRes.data?.status, QuestionStatus.ARCHIVED);

    // Verified removed from pending queue
    const queue = await getPendingQuestionsAction(orgA);
    assert.ok(!queue.data?.some((q: Question) => q.id === pending2.id));
  });

  await t.test('8. regeneration generates a new candidate without modifying or overwriting the original', async () => {
    const qOrig = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Original Question',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Orig1', 'Orig2'],
      correctOptionIndices: [0],
      explanation: 'Orig Exp',
      scriptureReference: 'John 3:16',
      topic: 'Gospel',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en',
    });
    const pOrig = bankService.transitionStatus(orgA, qOrig.id, QuestionStatus.PENDING_REVIEW)!;

    // Queue provider response for regeneration
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Regenerated Alternative Question',
          type: 'MULTIPLE_CHOICE',
          options: ['Alt1', 'Alt2'],
          correctOptionIndices: [0],
          explanation: 'Alt Exp',
          scriptureReference: 'John 3:16',
          topic: 'Gospel',
          difficulty: 'Medium',
          language: 'en',
        },
      ],
    });

    const regenRes = await regenerateQuestionAction(orgA, pOrig.id, 'Focus on God so loved the world');
    assert.ok(regenRes.success);
    assert.ok(regenRes.data);
    assert.notEqual(regenRes.data.id, pOrig.id, 'New candidate must have a distinct ID');
    assert.equal(regenRes.data.stem, 'Regenerated Alternative Question');
    assert.equal(regenRes.data.status, QuestionStatus.PENDING_REVIEW);

    // Verify original question is intact
    const originalCheck = await getQuestionByIdAction(orgA, pOrig.id);
    assert.equal(originalCheck.data?.stem, 'Original Question');
    assert.equal(originalCheck.data?.status, QuestionStatus.PENDING_REVIEW);
  });
});