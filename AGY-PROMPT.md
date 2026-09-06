# AGY TASK — BAREA-003 Final Corrective Pass 2

## STATUS

PR #4 (`barea-003-ai-generation`) remains under independent review.

**Verdict: CHANGES REQUIRED — FINAL FOCUSED PASS. Do NOT merge PR #4.**

The previous corrective pass fixed the atomic persistence boundary. One final focused correction remains: independently verify the Gemini model/API contract against the current official Google documentation and harden provider error handling.

Do NOT start BAREA-004 or any later milestone.

---

## 1. BASELINE / SCOPE

Repository: `jbr01061981-hue/barea`
PR: `#4`
Branch: `barea-003-ai-generation`
Base: `main`

Current reviewed head before this pass:
`7ab4890343ff24b59a80505110f2c0b0d3b60f1f`

Do not reset, force-push, squash, or rewrite existing branch history. Add focused corrective commits only.

Preserve the existing BAREA-003 architecture:

- strongly typed generation request;
- AIProvider abstraction;
- FakeAIProvider;
- Gemini adapter;
- provider structured output;
- local JSON Schema structural validation;
- existing Question domain validation;
- PENDING_REVIEW staging;
- organizationId isolation;
- BAREA-002 lifecycle preservation;
- true SQLite transaction boundary already implemented.

Do not broaden scope.

---

## 2. REQUIRED CORRECTION A — VERIFY CURRENT GEMINI MODEL/API CONTRACT

### Problem

The current adapter defaults to:

`gemini-2.5-flash`

That model is listed by current Google documentation as stable and has no announced shutdown date, so it is not inherently obsolete. However, this pass must explicitly verify the complete model/API/structured-output combination rather than relying on an earlier assumption.

### Official references to verify against

Use current official Google Gemini documentation as the source of truth at execution time.

Relevant current documentation includes:

- Google Gemini models documentation:
  https://ai.google.dev/gemini-api/docs/models
- Google Gemini structured output documentation:
  https://ai.google.dev/gemini-api/docs/structured-output
- Google Gemini Generate Content documentation:
  https://ai.google.dev/gemini-api/docs/generate-content/text-generation
- Google Gemini deprecations documentation:
  https://ai.google.dev/gemini-api/docs/deprecations

The current documentation reviewed for this task shows `gemini-2.5-flash` as a stable model and documents JSON-schema structured output and `x-goog-api-key` authentication. It also shows newer stable Gemini 3.x models. Do not blindly change the model merely because a newer model exists.

### Required decision

Verify and document one specific production-default model that satisfies all of these:

1. currently supported;
2. stable, not preview/experimental/deprecated/shut down;
3. suitable for structured JSON question generation;
4. compatible with the exact API surface implemented by this adapter;
5. appropriate for the current BAREA-003 scope.

If `gemini-2.5-flash` remains the correct choice after verification, KEEP it. Do not change models unnecessarily.

If the current official documentation shows a materially better stable choice for this exact workload/API, change the default to that model.

Keep model selection configurable through `GeminiProviderConfig` and `GEMINI_MODEL`.

### Required documentation

Update ADR-009 to record:

- exact selected default model;
- why it was selected;
- exact Gemini API surface used (`generateContent` or another explicitly verified surface);
- endpoint/API version;
- structured-output mechanism;
- authentication mechanism;
- date of verification;
- official Google documentation references used.

Do not resolve unrelated architectural decisions.

---

## 3. REQUIRED CORRECTION B — VERIFY STRUCTURED OUTPUT REQUEST FORMAT

The current provider sends:

`generationConfig.responseMimeType`

and

`generationConfig.responseSchema`

Before changing anything, compare the actual request body against the current official documentation for the exact API surface and selected model.

The current official structured-output documentation must be treated as authoritative.

If the current REST API requires a different field structure—for example the currently documented `responseFormat` structure—update the adapter accordingly.

If the existing `generationConfig.responseMimeType` + `responseSchema` structure is valid for the selected API/model combination, retain it and document why.

Do not make changes based on guesswork.

Add/update deterministic tests that inspect the exact request body and prove that the implemented request matches the verified API contract.

No live API call is required or permitted as part of the normal test suite.

---

## 4. REQUIRED CORRECTION C — REAL ERROR/SECRET REDACTION

### Problem

The current non-2xx handling truncates the provider response body to 500 characters. Truncation alone is not credential redaction.

A provider response body must not be blindly copied into an application error.

### Required implementation

Implement a small, deterministic, provider-local sanitization strategy.

At minimum:

- never include the API key in thrown errors;
- never include the `x-goog-api-key` header value in thrown errors;
- never include authorization credentials in thrown errors;
- do not expose arbitrary raw provider response bodies;
- do not log request headers or credentials;
- preserve safe HTTP status/statusText information for diagnosis;
- include only a bounded, sanitized provider error message when useful.

A simple safe approach is acceptable, such as parsing known provider error fields and allowing only safe textual fields after explicit redaction, or returning a generic bounded provider error without the raw body.

Do not introduce a large security framework.

### Required tests

Add deterministic tests proving that:

1. a simulated provider error containing a fake API key does not expose that key;
2. a simulated provider error containing the fake `x-goog-api-key` value does not expose it;
3. raw arbitrary response-body content is not blindly surfaced;
4. HTTP status information remains available;
5. malformed provider responses remain safely handled.

Use fake credentials only. Never use a real credential.

---

## 5. PRESERVE THE ATOMIC TRANSACTION FIX

Do not regress the already-corrected transaction implementation.

The generation batch must continue to:

- pre-validate generated question payloads;
- create/stage through the existing Question Bank service;
- execute all persistence inside one SQLite transaction;
- commit only after the entire batch succeeds;
- roll back the complete batch on any persistence failure;
- leave zero generated questions persisted after a failed batch;
- return successful questions as `PENDING_REVIEW`.

Do not reintroduce compensating archive/delete cleanup.

Keep the existing rollback regression tests green.

---

## 6. PRESERVE ALL BAREA-003 INVARIANTS

Do not regress:

- request count 1–20;
- supported question types;
- Easy/Medium/Hard difficulty;
- language;
- topic/passage context;
- provider structured output;
- local structural validation;
- Question domain validation;
- duplicate MULTI_SELECT rejection;
- exact generated-count enforcement;
- organizationId isolation;
- PENDING_REVIEW staging;
- rejection of direct APPROVED creation;
- approved-content modification demotion;
- approved-only retrieval;
- FakeAIProvider deterministic testing;
- TypeScript-only application source;
- CommonJS runtime contract;
- node:sqlite / DatabaseSync persistence;
- atomic batch persistence.

---

## 7. STRICTLY OUT OF SCOPE

Do NOT implement:

- BAREA-004 teacher review UI;
- approval UI;
- regeneration UI;
- HTTP/REST endpoints;
- authentication;
- authorization framework;
- quiz authoring;
- quiz publishing;
- live sessions;
- participant joining;
- QR codes;
- WebSockets/realtime;
- host UI;
- participant UI;
- projector UI;
- scoring;
- leaderboards;
- analytics;
- deployment;
- pilot work;
- theological truth certification;
- Scripture fact-checking engine;
- database replacement;
- ORM;
- unrelated refactoring.

---

## 8. VALIDATION REQUIREMENTS

Actually execute and report:

1. clean dependency install;
2. `npm run typecheck`;
3. `npm run build`;
4. `npm test`;
5. `git diff --check`;
6. verify zero `any` in `src/`;
7. verify no BOM artifacts introduced;
8. verify no secrets committed;
9. verify no legacy `.js` application/test source introduced;
10. verify `dist/` remains ignored;
11. verify atomic rollback regression tests pass;
12. verify Gemini provider tests pass without network credentials;
13. verify the exact Gemini request body against the cited official documentation;
14. verify fake API keys are absent from thrown errors in the new security tests.

Do not report results that were not actually executed.

---

## 9. REPORT REQUIREMENTS

Update ADR-009 and `AGY-REPORT.md`.

`AGY-REPORT.md` must include:

- exact files changed;
- final Gemini default model;
- why that model was selected;
- exact API surface and API version/endpoint;
- exact structured-output request format;
- official Google documentation references used;
- authentication method;
- error-redaction design;
- security regression test results;
- atomic transaction regression result;
- complete validation results;
- final head SHA;
- PR #4 status;
- working-tree status;
- explicit confirmation that BAREA-004+ was not started.

Do not fabricate any result, documentation claim, test result, or SHA.

---

## 10. GIT / PR RULES

Stay on:

`barea-003-ai-generation`

Do not create another implementation branch.

Use focused Conventional Commits.

Update PR #4 rather than opening a replacement PR.

PR #4 must remain:

- OPEN;
- UNMERGED;
- not self-approved.

Do not force-push or rewrite history.

---

## STOP CONDITION

After this final focused correction:

- Gemini model/API contract is independently verified against current official Google documentation;
- the selected stable default is documented;
- structured-output request format is verified and tested;
- provider errors cannot expose credentials or arbitrary raw response bodies;
- security regression tests pass;
- atomic transaction and all existing BAREA-003 tests remain green;
- typecheck/build/diff/secrets/BOM/source audits pass;
- ADR-009 and AGY-REPORT.md are updated;
- PR #4 remains OPEN and UNMERGED;
- working tree is clean;
- BAREA-004+ has not started.

**STOP.**

Do not merge PR #4.

Do not start BAREA-004.

Wait for independent review.