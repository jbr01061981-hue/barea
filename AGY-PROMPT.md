# AGY TASK — BAREA-003 Final Corrective Pass

## STATUS

PR #4 (`barea-003-ai-generation`) has completed the first implementation pass and independent review.

**Verdict: CHANGES REQUIRED. Do NOT merge PR #4.**

This is a focused corrective pass only. After completing it, leave PR #4 OPEN and UNMERGED for another independent review.

Do NOT start BAREA-004 or any later milestone.

---

## 1. BASELINE / SCOPE

Repository: `jbr01061981-hue/barea`
PR: `#4`
Branch: `barea-003-ai-generation`
Base: `main`

Current reviewed implementation head before this corrective pass:
`082996c1f00c3211c0e7f8401ad87641742e31f2`

Do not reset or rewrite the branch history. Add focused corrective commits.

The existing BAREA-003 architecture is approved in principle:

- strongly typed generation request;
- AIProvider abstraction;
- FakeAIProvider;
- Gemini adapter;
- JSON Schema structural validation;
- existing Question domain validation;
- PENDING_REVIEW staging;
- organizationId isolation;
- BAREA-002 lifecycle preservation.

Preserve these unless a correction below requires a narrowly scoped change.

---

## 2. REQUIRED CORRECTION A — TRUE ATOMIC BATCH PERSISTENCE

### Problem

The current `AIGenerationService` creates and stages questions one at a time and attempts best-effort cleanup by archiving already-created questions if a later operation fails.

That is not a true atomic/all-or-nothing persistence boundary.

The requirement is:

> If a generation batch fails at any persistence point, zero questions from that batch remain persisted.

### Required implementation

Implement a real atomic transaction boundary using the existing BAREA-002 `node:sqlite` / `DatabaseSync` persistence infrastructure.

Preferred design:

1. Add a narrowly scoped repository/service batch operation that executes the entire generated-question persistence inside one SQLite transaction.
2. Insert/stage all generated questions within that transaction.
3. If any insert or lifecycle transition fails, roll back the transaction.
4. On failure, verify that **zero** generated questions from that batch remain in the database.
5. On success, commit once and return all staged `PENDING_REVIEW` questions.

Do NOT implement this as:

- per-question commits plus compensating archive;
- best-effort cleanup;
- delete/archive loops pretending to be atomic;
- an in-memory transaction simulation.

Reuse the existing repository/storage layer rather than introducing a second database.

### Important lifecycle constraint

Do not weaken ADR-007.

AI-generated questions must still be created through the legitimate lifecycle and end as `PENDING_REVIEW`.

Do not create a new direct-APPROVED path.

### Transaction API design

Keep the abstraction small. A transaction callback/transactional batch method is acceptable.

Do not redesign the entire Question Bank repository.

If the existing repository needs a minimal transaction primitive to support this milestone, add only what is necessary and document the reason in code/ADR if appropriate.

### Required regression tests

Add deterministic tests proving:

1. successful batch persists exactly N questions;
2. a failure during the batch causes **zero** questions from that batch to remain;
3. a failure after at least one successful insert is rolled back;
4. generated questions are all `PENDING_REVIEW` after a successful commit;
5. organization isolation remains intact;
6. existing BAREA-002 persistence/lifecycle tests remain green.

The failure test must exercise the real persistence transaction, not merely a mocked cleanup function.

---

## 3. REQUIRED CORRECTION B — CURRENT GEMINI API / MODEL

### Problem

The current Gemini adapter defaults to:

`gemini-1.5-flash`

This is not an acceptable default for the current BAREA baseline without explicit verification.

Current Google Gemini documentation lists current supported models such as `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`, and others. Current documentation also states which models support structured outputs. Verify the exact choice against the current official documentation before changing it.

### Required implementation

1. Keep the model configurable through `GeminiProviderConfig` / environment configuration.
2. Replace the obsolete/default `gemini-1.5-flash` default with a currently supported model suitable for this BAREA structured-question generation workload.
3. Prefer a **stable** model rather than a deprecated or shut-down model.
4. Use the currently supported Gemini structured-output request format for the selected API surface.
5. Keep credentials out of URLs where the current API supports the safer API-key header mechanism; use the current official recommendation.
6. Do not add the Google SDK merely to solve this correction if the existing fetch-based adapter can remain small and correct.
7. Do not make live network calls part of the normal test suite.

### Current official reference used for this review

Google's current model documentation (updated September 4, 2026) lists `gemini-3.8-flash` and other Gemini 3 models as current stable models and identifies structured-output support in the current documentation.

Google's current structured-output documentation shows JSON Schema structured output and current model examples.

Use the current official Google documentation available at implementation time as the source of truth rather than blindly copying this prompt's example model name.

### Required tests

Add/update deterministic provider-adapter tests that verify:

- configured model is honored;
- default model is the selected current supported model;
- API request contains the required structured-output configuration;
- API key is not embedded in application logs/errors;
- non-2xx responses fail safely;
- malformed provider response fails safely.

Do not require a real API key for these tests.

---

## 4. STRUCTURED OUTPUT REQUIREMENT

The Gemini adapter must request structured JSON from the provider using the provider's supported structured-output mechanism, not merely tell the model in prose to return JSON.

The repository's own JSON Schema validation remains mandatory after the provider response.

The two boundaries are distinct:

`Provider structured-output enforcement`
`        ->`
`BAREA structural validation`
`        ->`
`BAREA Question domain validation`

Do not remove the local validation layer because the provider supports schema-constrained output.

---

## 5. ERROR / SECRET SAFETY

Do not expose:

- API keys;
- authorization headers;
- provider credentials;
- sensitive raw provider payloads.

If provider errors include response bodies, sanitize or bound them so credentials cannot leak.

Keep errors actionable but safe.

---

## 6. PRESERVE EXISTING BAREA-003 INVARIANTS

Do not regress:

- request count 1–20;
- supported question types;
- Easy/Medium/Hard difficulty;
- language;
- topic/passage context;
- structured schema validation;
- existing Question domain validation;
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
- node:sqlite / DatabaseSync persistence.

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
11. verify the atomic rollback regression test actually passes;
12. verify Gemini provider tests pass without network credentials.

Do not report results that were not actually executed.

---

## 9. DOCUMENTATION

Update ADR-009 if the provider model/API details change.

Document:

- selected current Gemini model;
- API surface used;
- structured-output mechanism;
- credential boundary;
- why the provider remains behind `AIProvider`;
- deterministic testing approach.

Do not resolve unrelated open architectural decisions.

Update `AGY-REPORT.md` with:

- corrective-pass summary;
- exact files changed;
- transaction design;
- rollback test result;
- selected Gemini model and API format;
- provider tests;
- complete validation results;
- final head SHA;
- PR #4 status;
- working-tree status;
- explicit confirmation BAREA-004+ was not started.

Do not fabricate any result or SHA.

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

---

## STOP CONDITION

After the corrective implementation:

- true atomic batch persistence is implemented;
- rollback is proven by tests;
- current Gemini model/API configuration is verified and corrected;
- all tests pass;
- validation passes;
- ADR/report are updated;
- PR #4 remains open and unmerged;
- working tree is clean;
- BAREA-004+ has not started;

**STOP.**

Do not merge PR #4.

Do not start BAREA-004.

Wait for independent review.