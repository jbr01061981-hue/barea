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
  GeminiAIProvider,
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

  await t.test('atomic rollback on persistence failure guarantees zero questions remain in database', async () => {
    const orgId = 'church-atomic-rollback';

    // Queue a valid 3-question batch from LLM
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Atomic Q1',
          type: 'MULTIPLE_CHOICE',
          options: ['A1', 'B1'],
          correctOptionIndices: [0],
          explanation: 'Exp1',
          scriptureReference: 'Gen 1:1',
          topic: 'Creation',
          difficulty: 'Easy',
          language: 'en'
        },
        {
          stem: 'Atomic Q2',
          type: 'MULTIPLE_CHOICE',
          options: ['A2', 'B2'],
          correctOptionIndices: [0],
          explanation: 'Exp2',
          scriptureReference: 'Gen 1:2',
          topic: 'Creation',
          difficulty: 'Easy',
          language: 'en'
        },
        {
          stem: 'Atomic Q3',
          type: 'MULTIPLE_CHOICE',
          options: ['A3', 'B3'],
          correctOptionIndices: [0],
          explanation: 'Exp3',
          scriptureReference: 'Gen 1:3',
          topic: 'Creation',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    });

    // Mock transitionStatus to throw on the 2nd question after 1st question has been inserted into SQLite
    const originalTransition = questionBankService.transitionStatus.bind(questionBankService);
    let transitionCount = 0;
    questionBankService.transitionStatus = (oId, qId, nextStatus) => {
      transitionCount++;
      if (transitionCount === 2) {
        throw new Error('Simulated SQLite disk/lock failure during question #2 staging');
      }
      return originalTransition(oId, qId, nextStatus);
    };

    try {
      await assert.rejects(
        () => service.generateQuizQuestions({
          organizationId: orgId,
          topic: 'Creation',
          count: 3,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        /Simulated SQLite disk\/lock failure during question #2 staging/
      );

      // Verify strictly: 0 questions exist in database for this organization
      const persisted = questionBankService.listQuestions(orgId);
      assert.equal(persisted.length, 0, 'Zero questions must remain in database after transaction rollback');
    } finally {
      // Restore original method
      questionBankService.transitionStatus = originalTransition;
    }
  });

  await t.test('successful batch persists exactly N questions in PENDING_REVIEW', async () => {
    const orgId = 'church-atomic-success';
    fakeProvider.queueResponse({
      questions: [
        {
          stem: 'Success Q1',
          type: 'MULTIPLE_CHOICE',
          options: ['A1', 'B1'],
          correctOptionIndices: [0],
          explanation: 'Exp1',
          scriptureReference: 'Gen 1:1',
          topic: 'Creation',
          difficulty: 'Easy',
          language: 'en'
        },
        {
          stem: 'Success Q2',
          type: 'TRUE_FALSE',
          options: ['True', 'False'],
          correctOptionIndices: [0],
          explanation: 'Exp2',
          scriptureReference: 'Gen 1:2',
          topic: 'Creation',
          difficulty: 'Easy',
          language: 'en'
        }
      ]
    });

    const result = await service.generateQuizQuestions({
      organizationId: orgId,
      topic: 'Creation',
      count: 2,
      difficulty: QuestionDifficulty.EASY,
      language: 'en'
    });

    assert.equal(result.questions.length, 2);
    assert.equal(result.status, QuestionStatus.PENDING_REVIEW);

    const persisted = questionBankService.listQuestions(orgId);
    assert.equal(persisted.length, 2);
    assert.ok(persisted.every((q) => q.status === QuestionStatus.PENDING_REVIEW));
  });
});

test('GeminiAIProvider Unit Tests (Deterministic / Mocked Fetch)', async (t) => {
  const originalFetch = globalThis.fetch;

  await t.test('fails if API key is not configured', async () => {
    const provider = new GeminiAIProvider({ apiKey: '' });
    await assert.rejects(
      () => provider.generateRaw({
        organizationId: 'church-1',
        topic: 'Grace',
        count: 1,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      }),
      /Gemini API key is not configured/
    );
  });

  await t.test('defaults to gemini-2.5-flash and uses x-goog-api-key header and structured schema', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      capturedBody = JSON.parse((init?.body as string) || '{}');

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      questions: [
                        {
                          stem: 'What is grace?',
                          type: 'MULTIPLE_CHOICE',
                          options: ['Unmerited favor', 'Punishment'],
                          correctOptionIndices: [0],
                          explanation: 'Ephesians 2:8',
                          scriptureReference: 'Ephesians 2:8',
                          topic: 'Grace',
                          difficulty: 'Easy',
                          language: 'en'
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        })
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({ apiKey: 'test-secret-key-12345' });
      const raw = await provider.generateRaw({
        organizationId: 'church-1',
        topic: 'Grace',
        count: 1,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      });

      // Verify URL does not contain ?key= or secret
      assert.ok(!capturedUrl.includes('test-secret-key-12345'), 'URL must NOT contain the API key');
      assert.ok(capturedUrl.includes('/models/gemini-2.5-flash:generateContent'), 'Default model must be gemini-2.5-flash');

      // Verify header contains x-goog-api-key
      assert.equal(capturedHeaders['x-goog-api-key'], 'test-secret-key-12345');
      assert.equal(capturedHeaders['Content-Type'], 'application/json');

      // Verify request body contains responseSchema and responseMimeType
      const genConfig = capturedBody.generationConfig as Record<string, unknown>;
      assert.equal(genConfig.responseMimeType, 'application/json');
      assert.ok(genConfig.responseSchema, 'Must include structured output responseSchema');

      // Verify parsed output returned
      const resultObj = raw as { questions: unknown[] };
      assert.equal(resultObj.questions.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('honors explicitly configured model', async () => {
    let capturedUrl = '';

    globalThis.fetch = async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ questions: [] }) }]
              }
            }
          ]
        })
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({
        apiKey: 'test-key',
        model: 'gemini-3.8-flash'
      });

      await provider.generateRaw({
        organizationId: 'church-1',
        topic: 'Faith',
        count: 1,
        difficulty: QuestionDifficulty.EASY,
        language: 'en'
      });

      assert.ok(capturedUrl.includes('/models/gemini-3.8-flash:generateContent'), 'Custom model must be reflected in URL');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('handles non-2xx response and sanitizes errors without leaking credentials', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'API_KEY_INVALID: The key provided is not authorized.'
      } as unknown as Response;
    };

    try {
      const secretKey = 'ultra-secret-token-abcdef';
      const provider = new GeminiAIProvider({ apiKey: secretKey });

      await assert.rejects(
        () => provider.generateRaw({
          organizationId: 'church-1',
          topic: 'Prayer',
          count: 1,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        (err: unknown) => {
          assert.ok(err instanceof AIProviderError);
          assert.match(err.message, /Gemini API error: HTTP 403 Forbidden/);
          assert.ok(!err.message.includes(secretKey), 'Error message must not leak credentials');
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('redacts fake api key if provider echoes key or header in error message', async () => {
    const fakeKey = 'fake-api-key-xyz-987654321';
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({
          error: {
            code: 400,
            message: `Invalid key provided: ${fakeKey} with header x-goog-api-key:${fakeKey}`,
            status: 'INVALID_ARGUMENT'
          }
        })
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({ apiKey: fakeKey });

      await assert.rejects(
        () => provider.generateRaw({
          organizationId: 'church-1',
          topic: 'Prayer',
          count: 1,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        (err: unknown) => {
          assert.ok(err instanceof AIProviderError);
          assert.ok(!err.message.includes(fakeKey), 'Must redact fake API key from error');
          assert.ok(err.message.includes('[REDACTED]'), 'Must replace sensitive token with [REDACTED]');
          assert.match(err.message, /HTTP 400 Bad Request/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('does not leak arbitrary raw provider body on non-JSON response', async () => {
    const sensitiveInternalDump = 'SECRET_INTERNAL_STACK_TRACE_LINE_1\nLINE2\nLINE3\nSECRET_DATABASE_URL=postgres://root:pass@host/db';
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => sensitiveInternalDump
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({ apiKey: 'some-key' });

      await assert.rejects(
        () => provider.generateRaw({
          organizationId: 'church-1',
          topic: 'Prayer',
          count: 1,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        (err: unknown) => {
          assert.ok(err instanceof AIProviderError);
          assert.ok(!err.message.includes('SECRET_DATABASE_URL'), 'Must not dump arbitrary multi-line raw bodies');
          assert.match(err.message, /HTTP 502 Bad Gateway/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('handles malformed JSON response safely', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'NOT VALID JSON <<<' }]
              }
            }
          ]
        })
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({ apiKey: 'test-key' });

      await assert.rejects(
        () => provider.generateRaw({
          organizationId: 'church-1',
          topic: 'Prayer',
          count: 1,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        (err: unknown) => {
          assert.ok(err instanceof AIProviderError);
          assert.match(err.message, /Failed to call Gemini provider/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('handles empty candidate parts response safely', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: []
        })
      } as unknown as Response;
    };

    try {
      const provider = new GeminiAIProvider({ apiKey: 'test-key' });

      await assert.rejects(
        () => provider.generateRaw({
          organizationId: 'church-1',
          topic: 'Prayer',
          count: 1,
          difficulty: QuestionDifficulty.EASY,
          language: 'en'
        }),
        (err: unknown) => {
          assert.ok(err instanceof AIProviderError);
          assert.match(err.message, /Gemini API returned an empty or missing response content part/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});