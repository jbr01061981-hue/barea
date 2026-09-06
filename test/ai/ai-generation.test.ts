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
  validateGenerationRequest,
  validateStructuralOutput,
  GenerationValidationError,
  StructuralValidationError,
  AIProviderError,
  type GenerationRequest,
  type GeneratedQuestionBatch
} from '../../src/index';

test('AI Generation Request Validation', async (t) => {
  await t.test('accepts valid request with count 1', () => {
    const req: GenerationRequest = {
      organizationId: 'church-gen-1',
      topic: 'Creation',
      count: 1,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.doesNotThrow(() => validateGenerationRequest(req));
  });

  await t.test('accepts valid request with count 20', () => {
    const req: GenerationRequest = {
      organizationId: 'church-gen-1',
      topic: 'Exodus',
      count: 20,
      difficulty: QuestionDifficulty.HARD,
      type: QuestionType.MULTI_SELECT,
      language: 'en',
      passageReference: 'Exodus 20',
      teacherInstructions: 'Focus on the Ten Commandments'
    };
    assert.doesNotThrow(() => validateGenerationRequest(req));
  });

  await t.test('rejects count 0', () => {
    const req = {
      organizationId: 'church-gen-1',
      topic: 'Creation',
      count: 0,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /Question count must be between 1 and 20/
    );
  });

  await t.test('rejects count greater than 20', () => {
    const req = {
      organizationId: 'church-gen-1',
      topic: 'Creation',
      count: 21,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /Question count must be between 1 and 20/
    );
  });

  await t.test('rejects invalid difficulty', () => {
    const req = {
      organizationId: 'church-gen-1',
      topic: 'Creation',
      count: 5,
      difficulty: 'SuperHard',
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /Invalid difficulty/
    );
  });

  await t.test('rejects invalid question type', () => {
    const req = {
      organizationId: 'church-gen-1',
      topic: 'Creation',
      count: 5,
      difficulty: QuestionDifficulty.MEDIUM,
      type: 'ESSAY',
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /Invalid question type/
    );
  });

  await t.test('rejects missing topic and passageReference', () => {
    const req = {
      organizationId: 'church-gen-1',
      topic: '   ',
      passageReference: '',
      count: 5,
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /Either topic or passageReference is required/
    );
  });

  await t.test('rejects missing organizationId', () => {
    const req = {
      organizationId: '',
      topic: 'Parables',
      count: 5,
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    };
    assert.throws(
      () => validateGenerationRequest(req),
      /organizationId is required/
    );
  });
});

test('Structured Output Validation', async (t) => {
  await t.test('accepts structurally valid question batch', () => {
    const raw = {
      questions: [
        {
          stem: 'Who built the ark?',
          type: 'MULTIPLE_CHOICE',
          options: ['Noah', 'Moses', 'David', 'Elijah'],
          correctOptionIndices: [0],
          explanation: 'God commanded Noah to build an ark.',
          scriptureReference: 'Genesis 6:14',
          topic: 'Genesis',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    };
    const batch = validateStructuralOutput(raw);
    assert.equal(batch.questions.length, 1);
    assert.equal(batch.questions[0].stem, 'Who built the ark?');
  });

  await t.test('rejects missing questions array', () => {
    assert.throws(
      () => validateStructuralOutput({}),
      /LLM output must contain a 'questions' array/
    );
  });

  await t.test('rejects missing required field stem', () => {
    const raw = {
      questions: [
        {
          type: 'MULTIPLE_CHOICE',
          options: ['A', 'B'],
          correctOptionIndices: [0],
          explanation: '',
          scriptureReference: 'Gen 1:1',
          topic: 'Topic',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    };
    assert.throws(
      () => validateStructuralOutput(raw),
      /empty or missing stem/
    );
  });

  await t.test('rejects invalid question type', () => {
    const raw = {
      questions: [
        {
          stem: 'Some question',
          type: 'INVALID_TYPE',
          options: ['A', 'B'],
          correctOptionIndices: [0],
          explanation: '',
          scriptureReference: 'Gen 1:1',
          topic: 'Topic',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    };
    assert.throws(
      () => validateStructuralOutput(raw),
      /has invalid question type/
    );
  });

  await t.test('rejects out of bounds correctOptionIndices', () => {
    const raw = {
      questions: [
        {
          stem: 'Some question',
          type: 'MULTIPLE_CHOICE',
          options: ['A', 'B'],
          correctOptionIndices: [5],
          explanation: '',
          scriptureReference: 'Gen 1:1',
          topic: 'Topic',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    };
    assert.throws(
      () => validateStructuralOutput(raw),
      /out-of-bounds correct option index/
    );
  });
});

test('AI Generation Pipeline Execution & Lifecycle Invariants', async (t) => {
  const repo = new SqliteQuestionRepository(':memory:');
  const questionBankService = new QuestionBankService(repo);
  const fakeProvider = new FakeAIProvider();
  const service = new AIGenerationService({
    aiProvider: fakeProvider,
    questionBankService
  });

  await t.test('generates questions and stages them as PENDING_REVIEW', async () => {
    const result = await service.generateQuizQuestions({
      organizationId: 'church-org-1',
      topic: 'The Gospels',
      count: 3,
      difficulty: QuestionDifficulty.MEDIUM,
      type: QuestionType.MULTIPLE_CHOICE,
      language: 'en'
    });

    assert.equal(result.totalGenerated, 3);
    assert.equal(result.status, QuestionStatus.PENDING_REVIEW);
    assert.equal(result.questions.length, 3);

    for (const q of result.questions) {
      assert.equal(q.organizationId, 'church-org-1');
      assert.equal(q.status, QuestionStatus.PENDING_REVIEW);
      assert.notEqual(q.status, QuestionStatus.APPROVED);
    }

    // Must NOT be returned by listApprovedQuestions
    const approvedList = questionBankService.listApprovedQuestions('church-org-1');
    assert.equal(approvedList.length, 0);

    // Staged questions can be retrieved via listQuestions with status: PENDING_REVIEW
    const pendingList = questionBankService.listQuestions('church-org-1', {
      status: QuestionStatus.PENDING_REVIEW
    });
    assert.equal(pendingList.length, 3);
  });

  await t.test('enforces exact count matching and rejects count mismatch', async () => {
    // Provider returns 2 questions when 3 were requested
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Q1',
          type: 'TRUE_FALSE',
          options: ['True', 'False'],
          correctOptionIndices: [0],
          explanation: 'E1',
          scriptureReference: 'Genesis 1:1',
          topic: 'Genesis',
          difficulty: 'Easy',
          language: 'en'
        },
        {
          stem: 'Q2',
          type: 'TRUE_FALSE',
          options: ['True', 'False'],
          correctOptionIndices: [0],
          explanation: 'E2',
          scriptureReference: 'Genesis 1:2',
          topic: 'Genesis',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    });

    await assert.rejects(
      () => service.generateQuizQuestions({
        organizationId: 'church-org-1',
        topic: 'Genesis',
        count: 3,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }),
      /Generated question count mismatch: requested 3, but received 2/
    );
  });

  await t.test('provider failure persists zero questions (fail-closed)', async () => {
    const initialCount = questionBankService.listQuestions('church-org-fail').length;
    assert.equal(initialCount, 0);

    fakeProvider.queueResponse(new Error('Network timeout contacting LLM gateway'));

    await assert.rejects(
      () => service.generateQuizQuestions({
        organizationId: 'church-org-fail',
        topic: 'Miracles',
        count: 2,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }),
      /AI Provider failed during generation/
    );

    const postFailCount = questionBankService.listQuestions('church-org-fail').length;
    assert.equal(postFailCount, 0);
  });

  await t.test('provider attempting to pass status: APPROVED cannot bypass lifecycle', async () => {
    // LLM response tries to inject status: APPROVED
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Who was swallowed by a great fish?',
          type: 'MULTIPLE_CHOICE',
          options: ['Jonah', 'Paul'],
          correctOptionIndices: [0],
          explanation: 'Book of Jonah',
          scriptureReference: 'Jonah 1:17',
          topic: 'Prophets',
          difficulty: 'Easy',
          language: 'en',
          status: 'APPROVED'
        }
      ]
    });

    const result = await service.generateQuizQuestions({
      organizationId: 'church-org-bypass-test',
      topic: 'Prophets',
      count: 1,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });

    // The status from the provider must be overridden by the pipeline to PENDING_REVIEW
    assert.equal(result.questions[0].status, QuestionStatus.PENDING_REVIEW);
    assert.notEqual(result.questions[0].status, QuestionStatus.APPROVED);

    const approvedList = questionBankService.listApprovedQuestions('church-org-bypass-test');
    assert.equal(approvedList.length, 0);
  });

  await t.test('enforces strict organization isolation', async () => {
    await service.generateQuizQuestions({
      organizationId: 'church-alpha',
      topic: 'Acts',
      count: 2,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });

    await service.generateQuizQuestions({
      organizationId: 'church-beta',
      topic: 'Romans',
      count: 2,
      difficulty: QuestionDifficulty.MEDIUM,
      language: 'en'
    });

    const alphaQuestions = questionBankService.listQuestions('church-alpha');
    const betaQuestions = questionBankService.listQuestions('church-beta');

    assert.equal(alphaQuestions.length, 2);
    assert.equal(betaQuestions.length, 2);
    assert.ok(alphaQuestions.every((q) => q.organizationId === 'church-alpha'));
    assert.ok(betaQuestions.every((q) => q.organizationId === 'church-beta'));
  });

  await t.test('rejects duplicate correct option indices for MULTI_SELECT', async () => {
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Which are gospels?',
          type: 'MULTI_SELECT',
          options: ['Matthew', 'Mark', 'Genesis'],
          correctOptionIndices: [0, 0], // duplicate index
          explanation: 'Matthew and Mark are gospels.',
          scriptureReference: 'Matthew 1:1',
          topic: 'Gospels',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    });

    await assert.rejects(
      () => service.generateQuizQuestions({
        organizationId: 'church-duplicate-test',
        topic: 'Gospels',
        count: 1,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }),
      /Duplicate correct option index in MULTI_SELECT/
    );

    const persisted = questionBankService.listQuestions('church-duplicate-test');
    assert.equal(persisted.length, 0);
  });
});