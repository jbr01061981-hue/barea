import test from 'node:test';
import assert from 'node:assert/strict';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

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
  setAuthorizedTeacherContext,
  getAuthorizedTeacherContext,
  isTestEnvironment,
} from '../src/app/teacher/review/db';

test('Teacher Review Workflow, Actions & Security Boundary (BAREA-004)', async (t) => {
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
    setAuthorizedTeacherContext(null);
  });

  const orgA = 'church-review-alpha';
  const orgB = 'church-review-beta';

  // Seed sample questions directly through domain lifecycle
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
  const pendingB = bankService.transitionStatus(orgB, draftB.id, QuestionStatus.PENDING_REVIEW)!;

  // Set trusted context to Org A teacher initially
  setAuthorizedTeacherContext({
    userId: 'teacher-alpha',
    organizationId: orgA,
    displayName: 'Teacher Alpha',
    role: 'teacher',
  });

  await t.test('1. queue returns only pending questions for the server-authorized organization', async () => {
    const resA = await getPendingQuestionsAction();
    assert.ok(resA.success);
    assert.equal(resA.data?.length, 2);
    assert.ok(resA.data?.every((q: Question) => q.status === QuestionStatus.PENDING_REVIEW));
    assert.ok(resA.data?.every((q: Question) => q.organizationId === orgA));

    // Switch context to Org B
    setAuthorizedTeacherContext({
      userId: 'teacher-beta',
      organizationId: orgB,
      displayName: 'Teacher Beta',
      role: 'teacher',
    });

    const resB = await getPendingQuestionsAction();
    assert.ok(resB.success);
    assert.equal(resB.data?.length, 1);
    assert.equal(resB.data?.[0].organizationId, orgB);

    // Reset back to Org A
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });
  });

  await t.test('2. saving an edit updates content and preserves PENDING_REVIEW state (never approves)', async () => {
    const editRes = await updateQuestionAction(pending1.id, {
      stem: 'According to Genesis 1:3, what was created first?',
      explanation: 'God said, Let there be light.',
    });

    assert.ok(editRes.success);
    assert.equal(editRes.data?.stem, 'According to Genesis 1:3, what was created first?');
    assert.equal(editRes.data?.explanation, 'God said, Let there be light.');
    // Critical BAREA-004 invariant: edit does NOT approve
    assert.equal(editRes.data?.status, QuestionStatus.PENDING_REVIEW);

    const verified = await getQuestionByIdAction(pending1.id);
    assert.equal(verified.data?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('3. rejects invalid edit payload and leaves question unchanged', async () => {
    const badRes = await updateQuestionAction(pending1.id, {
      stem: '', // Empty stem is invalid
    });
    assert.equal(badRes.success, false);
    assert.match(badRes.error || '', /Question stem text is required and cannot be empty/);

    const verified = await getQuestionByIdAction(pending1.id);
    assert.notEqual(verified.data?.stem, '');
  });

  await t.test('4. explicit single approval transitions PENDING_REVIEW -> APPROVED', async () => {
    const approveRes = await approveQuestionAction(pending1.id);
    assert.ok(approveRes.success);
    assert.equal(approveRes.data?.status, QuestionStatus.APPROVED);

    // Verified removed from pending queue
    const queue = await getPendingQuestionsAction();
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

    const batchRes = await batchApproveQuestionsAction([pA.id, pB.id]);
    assert.ok(batchRes.success);
    assert.equal(batchRes.data?.approvedCount, 2);

    const checkA = await getQuestionByIdAction(pA.id);
    const checkB = await getQuestionByIdAction(pB.id);
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

    const failBatchRes = await batchApproveQuestionsAction([pC.id, 'non-existent-id']);
    assert.equal(failBatchRes.success, false);

    // Crucial rollback verification: pC must STILL be PENDING_REVIEW
    const checkC = await getQuestionByIdAction(pC.id);
    assert.equal(checkC.data?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('7. archive action sets question status to ARCHIVED', async () => {
    const archiveRes = await archiveQuestionAction(pending2.id);
    assert.ok(archiveRes.success);
    assert.equal(archiveRes.data?.status, QuestionStatus.ARCHIVED);

    // Verified removed from pending queue
    const queue = await getPendingQuestionsAction();
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

    const regenRes = await regenerateQuestionAction(pOrig.id, 'Focus on God so loved the world');
    assert.ok(regenRes.success);
    assert.ok(regenRes.data);
    assert.notEqual(regenRes.data.id, pOrig.id, 'New candidate must have a distinct ID');
    assert.equal(regenRes.data.stem, 'Regenerated Alternative Question');
    assert.equal(regenRes.data.status, QuestionStatus.PENDING_REVIEW);
    assert.equal(regenRes.data.organizationId, orgA);

    // Verify original question is intact
    const originalCheck = await getQuestionByIdAction(pOrig.id);
    assert.equal(originalCheck.data?.stem, 'Original Question');
    assert.equal(originalCheck.data?.status, QuestionStatus.PENDING_REVIEW);
  });

  // =========================================================================
  // SECURITY AUTHORIZATION & CROSS-ORGANIZATION REGRESSION TESTS
  // =========================================================================

  await t.test('9. security: teacher from Org A cannot retrieve a question belonging to Org B', async () => {
    // Authorized as Org A teacher
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    const crossRead = await getQuestionByIdAction(pendingB.id);
    assert.equal(crossRead.success, false);
    assert.match(crossRead.error || '', /not found/i);
  });

  await t.test('10. security: teacher from Org A cannot edit a question belonging to Org B', async () => {
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    const crossEdit = await updateQuestionAction(pendingB.id, {
      stem: 'ATTACKER OVERWRITE STEM',
    });
    assert.equal(crossEdit.success, false);

    // Verify Org B question in bank was NOT modified
    const untouched = bankService.getQuestion(orgB, pendingB.id);
    assert.equal(untouched?.stem, 'Who built the ark?');
  });

  await t.test('11. security: teacher from Org A cannot approve a question belonging to Org B', async () => {
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    const crossApprove = await approveQuestionAction(pendingB.id);
    assert.equal(crossApprove.success, false);

    // Verify Org B question is still PENDING_REVIEW
    const untouched = bankService.getQuestion(orgB, pendingB.id);
    assert.equal(untouched?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('12. security: teacher from Org A cannot include Org B question in batch approval (fails closed)', async () => {
    // Org A pending question
    const qA = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Org A Question for Mixed Batch',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['1', '2'],
      correctOptionIndices: [0],
      explanation: 'Exp',
      scriptureReference: 'Gen 1',
      topic: 'Topic',
      difficulty: QuestionDifficulty.EASY,
      language: 'en',
    });
    const pA = bankService.transitionStatus(orgA, qA.id, QuestionStatus.PENDING_REVIEW)!;

    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    // Attempt batch with Org A question and Org B question
    const mixedBatchRes = await batchApproveQuestionsAction([pA.id, pendingB.id]);
    assert.equal(mixedBatchRes.success, false);

    // All-or-nothing rollback: neither question was approved
    const checkA = bankService.getQuestion(orgA, pA.id);
    const checkB = bankService.getQuestion(orgB, pendingB.id);
    assert.equal(checkA?.status, QuestionStatus.PENDING_REVIEW);
    assert.equal(checkB?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('13. security: teacher from Org A cannot archive a question belonging to Org B', async () => {
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    const crossArchive = await archiveQuestionAction(pendingB.id);
    assert.equal(crossArchive.success, false);

    // Verify Org B question is NOT archived
    const untouched = bankService.getQuestion(orgB, pendingB.id);
    assert.equal(untouched?.status, QuestionStatus.PENDING_REVIEW);
  });

  await t.test('14. security: teacher from Org A cannot regenerate a question belonging to Org B', async () => {
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    const crossRegen = await regenerateQuestionAction(pendingB.id, 'Malicious prompt injection');
    assert.equal(crossRegen.success, false);
    assert.match(crossRegen.error || '', /not found/i);
  });

  await t.test('15. security: missing or invalid server teacher context fails closed', async () => {
    // Invalidate teacher context
    setAuthorizedTeacherContext({
      userId: '',
      organizationId: '',
      displayName: 'Invalid',
      role: 'teacher',
    });

    const queueRes = await getPendingQuestionsAction();
    assert.equal(queueRes.success, false);
    assert.match(queueRes.error || '', /unauthorized/i);

    const approveRes = await approveQuestionAction('any-id');
    assert.equal(approveRes.success, false);
    assert.match(approveRes.error || '', /unauthorized/i);
  });

  await t.test('16. security: production / non-development mode fails closed immediately', async () => {
    // Reset test override to test default runtime resolution
    setAuthorizedTeacherContext(null);

    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    try {
      envMap.NODE_ENV = 'production';
      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /production teacher authentication is required/i
      );

      // Verify server action fails closed in production
      const queueRes = await getPendingQuestionsAction();
      assert.equal(queueRes.success, false);
      assert.match(queueRes.error || '', /production teacher authentication is required/i);

      // Verify test hook is forbidden in production
      assert.throws(
        () => setAuthorizedTeacherContext({ userId: 'x', organizationId: 'y', displayName: 'd', role: 'teacher' }),
        /Forbidden/i
      );
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      // Re-enable test fixture override
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('17. security: development configuration with missing or whitespace-only org ID fails closed', async () => {
    setAuthorizedTeacherContext(null);

    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    const prevDevOrg = envMap.BAREA_DEV_ORG_ID;
    try {
      envMap.NODE_ENV = 'development';

      // Case A: missing (undefined)
      delete envMap.BAREA_DEV_ORG_ID;
      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /BAREA_DEV_ORG_ID is missing or empty/i
      );

      // Case B: whitespace only
      envMap.BAREA_DEV_ORG_ID = '   ';
      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /BAREA_DEV_ORG_ID is missing or empty/i
      );

      const queueRes = await getPendingQuestionsAction();
      assert.equal(queueRes.success, false);
      assert.match(queueRes.error || '', /missing or empty/i);
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      if (prevDevOrg !== undefined) {
        envMap.BAREA_DEV_ORG_ID = prevDevOrg;
      } else {
        delete envMap.BAREA_DEV_ORG_ID;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('18. security: valid development configuration returns expected dev context', async () => {
    setAuthorizedTeacherContext(null);

    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    const prevDevOrg = envMap.BAREA_DEV_ORG_ID;
    try {
      envMap.NODE_ENV = 'development';
      envMap.BAREA_DEV_ORG_ID = 'church-berea-configured';

      const ctx = await getAuthorizedTeacherContext();
      assert.equal(ctx.organizationId, 'church-berea-configured');
      assert.equal(ctx.role, 'teacher');
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      if (prevDevOrg !== undefined) {
        envMap.BAREA_DEV_ORG_ID = prevDevOrg;
      } else {
        delete envMap.BAREA_DEV_ORG_ID;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('19. security: unset NODE_ENV without a trusted test override strictly fails closed', async () => {
    setAuthorizedTeacherContext(null);

    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    try {
      delete envMap.NODE_ENV;

      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /runtime environment \(unset\) is not authorized/i
      );

      const queueRes = await getPendingQuestionsAction();
      assert.equal(queueRes.success, false);
      assert.match(queueRes.error || '', /runtime environment \(unset\) is not authorized/i);
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('20. security: unknown/non-standard NODE_ENV without trusted authentication fails closed', async () => {
    setAuthorizedTeacherContext(null);

    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    try {
      envMap.NODE_ENV = 'staging';

      await assert.rejects(
        async () => getAuthorizedTeacherContext(),
        /runtime environment \(staging\) is not authorized/i
      );

      const queueRes = await getPendingQuestionsAction();
      assert.equal(queueRes.success, false);
      assert.match(queueRes.error || '', /runtime environment \(staging\) is not authorized/i);
    } finally {
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('21. security: arbitrary CLI argv or execArgv (including --test, --test-evil, --test=attacker) cannot activate test authorization', async () => {
    // Save original state
    const originalArgv = [...process.argv];
    const originalExecArgv = [...process.execArgv];
    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;

    const attackerContext = {
      userId: 'attacker',
      organizationId: 'org-attacker',
      displayName: 'Attacker',
      role: 'teacher' as const,
    };

    // Every pattern must fail to activate test authorization
    const maliciousArgvPatterns = [
      ['--test'],
      ['--test-evil'],
      ['--test=attacker'],
      ['--arg-with-test'],
      ['contest'],
      ['testing-suite'],
      ['--test-attacker'],
      ['--test-not-real'],
      ['--test-fake'],
      ['--test-anything'],
      ['--test', '--test-evil', '--test=attacker', '--arg-with-test', 'contest', 'testing-suite'],
    ];

    try {
      // Clear any existing test override
      setAuthorizedTeacherContext(null);

      for (const pattern of maliciousArgvPatterns) {
        // Test 1: Untrusted process.argv in unset NODE_ENV
        delete envMap.NODE_ENV;
        process.argv = ['node', 'server.js', ...pattern];
        process.execArgv = [];

        assert.equal(isTestEnvironment(), false, `Pattern ${pattern.join(' ')} in argv must not activate isTestEnvironment()`);

        await assert.rejects(
          async () => getAuthorizedTeacherContext(),
          /runtime environment \(unset\) is not authorized/i
        );

        assert.throws(
          () => setAuthorizedTeacherContext(attackerContext),
          /Forbidden: test authorization overrides cannot be executed/i
        );

        // Test 2: Untrusted process.execArgv in unset NODE_ENV
        process.argv = ['node', 'server.js'];
        process.execArgv = [...pattern];

        assert.equal(isTestEnvironment(), false, `Pattern ${pattern.join(' ')} in execArgv must not activate isTestEnvironment()`);

        await assert.rejects(
          async () => getAuthorizedTeacherContext(),
          /runtime environment \(unset\) is not authorized/i
        );

        assert.throws(
          () => setAuthorizedTeacherContext(attackerContext),
          /Forbidden: test authorization overrides cannot be executed/i
        );

        // Test 3: Production environment + untrusted patterns in argv and execArgv
        envMap.NODE_ENV = 'production';
        process.argv = ['node', 'server.js', ...pattern];
        process.execArgv = [...pattern];

        assert.equal(isTestEnvironment(), false);
        await assert.rejects(
          async () => getAuthorizedTeacherContext(),
          /production teacher authentication is required/i
        );
        assert.throws(
          () => setAuthorizedTeacherContext(attackerContext),
          /Forbidden: test authorization overrides cannot be executed/i
        );

        // Test 4: Staging / unknown environment + untrusted patterns in argv and execArgv
        envMap.NODE_ENV = 'staging';
        process.argv = ['node', 'server.js', ...pattern];
        process.execArgv = [...pattern];

        assert.equal(isTestEnvironment(), false);
        await assert.rejects(
          async () => getAuthorizedTeacherContext(),
          /runtime environment \(staging\) is not authorized/i
        );
        assert.throws(
          () => setAuthorizedTeacherContext(attackerContext),
          /Forbidden: test authorization overrides cannot be executed/i
        );
      }
    } finally {
      process.argv = originalArgv;
      process.execArgv = originalExecArgv;
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('22. security: genuine repository test execution uses trusted NODE_ENV=test and establishes fixture context', async () => {
    const originalArgv = [...process.argv];
    const originalExecArgv = [...process.execArgv];
    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;

    const fixtureContext = {
      userId: 'teacher-fixture',
      organizationId: 'church-fixture',
      displayName: 'Teacher Fixture',
      role: 'teacher' as const,
    };

    try {
      setAuthorizedTeacherContext(null);

      // Trusted environment declaration: NODE_ENV === 'test'
      delete envMap.NODE_ENV;
      envMap.NODE_ENV = 'test';
      process.argv = ['node', 'dist/test/teacher-review.test.js'];
      process.execArgv = [];

      assert.equal(isTestEnvironment(), true);

      // Verify legitimate test fixture can set and get context
      setAuthorizedTeacherContext(fixtureContext);
      const ctx = await getAuthorizedTeacherContext();
      assert.equal(ctx.userId, 'teacher-fixture');
      assert.equal(ctx.organizationId, 'church-fixture');
      assert.equal(ctx.role, 'teacher');

      // Verify clearing fixture context reverts properly
      setAuthorizedTeacherContext(null);
    } finally {
      process.argv = originalArgv;
      process.execArgv = originalExecArgv;
      if (prevNodeEnv !== undefined) {
        envMap.NODE_ENV = prevNodeEnv;
      } else {
        delete envMap.NODE_ENV;
      }
      setAuthorizedTeacherContext({
        userId: 'teacher-alpha',
        organizationId: orgA,
        displayName: 'Teacher Alpha',
        role: 'teacher',
      });
    }
  });

  await t.test('23. security: updateQuestionAction ignores runtime injected status, organizationId, or arbitrary properties', async () => {
    setAuthorizedTeacherContext({
      userId: 'teacher-alpha',
      organizationId: orgA,
      displayName: 'Teacher Alpha',
      role: 'teacher',
    });

    // 1. Create a fresh PENDING_REVIEW question for Org A
    const qInject = bankService.createQuestion({
      organizationId: orgA,
      stem: 'Original Stem Before Malicious Update',
      type: QuestionType.MULTIPLE_CHOICE,
      options: ['Opt 1', 'Opt 2'],
      correctOptionIndices: [0],
      explanation: 'Original explanation',
      scriptureReference: 'Acts 1:8',
      topic: 'Witness',
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en',
    });
    const pendingInject = bankService.transitionStatus(orgA, qInject.id, QuestionStatus.PENDING_REVIEW)!;
    assert.equal(pendingInject.status, QuestionStatus.PENDING_REVIEW);

    // 2. Invoke updateQuestionAction with runtime injected properties:
    // - status: APPROVED (attempting unauthorized lifecycle bypass)
    // - organizationId: orgB (attempting cross-tenant re-assignment)
    // - id: 'attacker-chosen-id'
    // - arbitrary runtime property: evilPayload
    // - legitimate field: stem & explanation
    const hostilePayload = {
      stem: 'Safely Updated Stem Via Allowlist',
      explanation: 'Updated Explanation',
      status: QuestionStatus.APPROVED,
      organizationId: orgB,
      id: 'attacker-tampered-id',
      evilPayload: 'malicious-data',
    };

    const updateRes = await updateQuestionAction(pendingInject.id, hostilePayload as unknown as Parameters<typeof updateQuestionAction>[1]);

    // 3. Verify the action does NOT approve the question
    assert.ok(updateRes.success);
    assert.equal(updateRes.data?.status, QuestionStatus.PENDING_REVIEW);
    assert.notEqual(updateRes.data?.status, QuestionStatus.APPROVED);

    // 4. Verify the persisted question in QuestionBankService remains PENDING_REVIEW and in Org A
    const persisted = bankService.getQuestion(orgA, pendingInject.id);
    assert.ok(persisted);
    assert.equal(persisted.status, QuestionStatus.PENDING_REVIEW);
    assert.equal(persisted.organizationId, orgA);
    assert.equal(persisted.id, pendingInject.id);

    // 5. Verify legitimate editable fields still updated normally
    assert.equal(persisted.stem, 'Safely Updated Stem Via Allowlist');
    assert.equal(persisted.explanation, 'Updated Explanation');

    // 6. Verify question does NOT exist in Org B
    const persistedInB = bankService.getQuestion(orgB, pendingInject.id);
    assert.equal(persistedInB, null);
  });
});
