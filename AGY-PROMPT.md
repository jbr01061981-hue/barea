# AGY TASK — BAREA-003 AI Quiz Generation

## STATUS

BAREA-001, BAREA-002, and BAREA-002A are COMPLETED and independently verified.

Current `main` is the approved baseline.

**BAREA-003 is now the next implementation milestone.**

Do not start BAREA-004 or any later milestone.

This prompt authorizes implementation of **BAREA-003 only** after AGY verifies the repository baseline below.

---

## 1. VERIFY BEFORE CHANGING ANYTHING

Repository:
- `jbr01061981-hue/barea`
- base branch: `main`

Verify first:

1. `main` is clean and synchronized with `origin/main`.
2. `docs/ROADMAP.md` says:
   - BAREA-001 = COMPLETED
   - BAREA-002 = COMPLETED
   - BAREA-002A = COMPLETED
   - BAREA-003 = NOT STARTED
3. The existing TypeScript Question Bank implementation is present and tests are green.
4. Read before implementation:
   - `README.md`
   - `AGENTS.md`
   - `docs/PRODUCT.md`
   - `docs/REQUIREMENTS.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DECISIONS.md`
   - `docs/ROADMAP.md`
5. Confirm no BAREA-004+ implementation already exists unexpectedly.

If the baseline is not as expected, **STOP and report the discrepancy.**

Do not modify files before completing this verification.

---

## 2. BAREA-003 OBJECTIVE

Implement the **server-side AI Quiz Generation pipeline** that:

`Teacher Generation Request`
`        ->`
`LLM Generation`
`        ->`
`Structured Output / JSON Schema Enforcement`
`        ->`
`Structural Validation`
`        ->`
`Question Domain Validation`
`        ->`
`PENDING_REVIEW Question Bank Drafts`

The milestone delivers the generation pipeline and its contracts.

It does **not** deliver the teacher review UI or approval workflow; those belong to BAREA-004.

### Core invariant

AI proposes.

The system structurally validates.

The teacher later reviews and approves.

AI-generated questions must **never** become APPROVED content automatically.

AI-generated questions must **never** be published directly to a live quiz.

---

## 3. REQUIRED GENERATION INPUT CONTRACT

Define a strongly typed generation request contract.

It must support:

- `topic` and/or Scripture passage/context;
- question count, constrained to **1–20 per request**;
- question-level difficulty targeting using Easy / Medium / Hard, including mixed difficulty distribution;
- question type selection;
- language;
- an optional teacher instruction/context field where appropriate.

The request contract must reject:

- zero or negative question counts;
- counts above 20;
- unsupported question types;
- unsupported/invalid difficulty values;
- empty required topic/passage context;
- malformed language values according to the contract chosen for BAREA-003.

Keep the contract focused. Do not introduce quiz-authoring settings such as timers, scoring, shuffling, publishing, or live-session configuration.

---

## 4. QUESTION TYPES

Use the existing BAREA Question Bank question-type model.

BAREA-003 must support the question types already approved by BAREA-002:

- `MULTIPLE_CHOICE`
- `TRUE_FALSE`
- `MULTI_SELECT`

Do not invent a second incompatible question-type vocabulary.

The generated output must satisfy the existing Question domain rules, including valid options and correct-option indices.

For `MULTI_SELECT`, duplicate correct-option indices must remain invalid.

---

## 5. REQUIRED GENERATED QUESTION CONTRACT

Define a machine-validated structured output contract containing the fields needed by the existing Question domain, including at minimum:

- stem
- options
- correct option indices
- explanation
- scripture reference
- topic
- difficulty
- language
- question type

The generated output must not contain an approval status that can cause automatic approval.

If a status field is present in an external/provider response, it must be ignored or rejected rather than trusted.

The application must assign the lifecycle state itself.

Every successfully generated question persisted by BAREA-003 must be created as:

`PENDING_REVIEW`

Never `APPROVED`.

---

## 6. STRUCTURED OUTPUT / JSON SCHEMA ENFORCEMENT

BAREA-003 must use a real machine-readable schema for the LLM response rather than relying only on prose instructions.

Requirements:

1. Define the generated-question JSON schema in a maintainable repository location.
2. Enforce the schema against the raw/provider output before persistence.
3. Validate required fields, field types, enum values, array shapes, and relevant bounds.
4. Reject malformed output safely.
5. Do not silently coerce invalid AI output into valid questions.
6. Do not persist a question until structural validation succeeds.
7. After schema validation, run the existing Question domain validation as the second validation boundary.

Schema validation means **structural correctness only**.

It does NOT certify:

- biblical truth;
- theological correctness;
- scripture-reference accuracy;
- age appropriateness;
- doctrinal suitability.

Those remain teacher responsibilities under ADR-001 and BAREA-004.

---

## 7. AI PROVIDER ARCHITECTURE

The specific LLM provider remains an architectural concern and must not be hard-coded into the Question Bank domain.

Implement a small, strongly typed **AI generation port/interface** so the core generation service depends on an abstraction rather than directly on an SDK.

The provider boundary must allow:

- a real LLM provider adapter;
- deterministic fake/mock generation for tests;
- future provider substitution without rewriting the domain/service layer.

If BAREA-003 selects a concrete provider/SDK for the first real adapter, document that choice in a new ADR in `docs/DECISIONS.md` before or with the implementation. Keep provider credentials and model identifiers configuration-driven; never hard-code secrets.

Do not add an ORM, database replacement, web framework, authentication system, WebSocket transport, or frontend framework as part of provider integration.

If the selected provider requires an environment variable for credentials, document the variable name and safe local setup. Never commit credentials, `.env` files containing secrets, or real API keys.

---

## 8. FAILURE / SAFETY BEHAVIOR

The pipeline must fail closed.

At minimum test and handle:

- provider/API failure;
- timeout or unavailable provider;
- malformed provider output;
- schema validation failure;
- Question domain validation failure;
- unsupported generated question type;
- invalid difficulty;
- invalid option/correct-index combinations;
- duplicate MULTI_SELECT correct indices;
- response count mismatch with requested count;
- unexpected approval/status fields attempting to bypass the lifecycle.

A failed generation request must not leave partially persisted invalid questions.

Prefer an all-or-nothing persistence boundary for one generation request: if the returned batch cannot be validated completely, persist **zero** questions from that request.

Do not silently retry indefinitely.

Provider retries, if introduced, must be bounded and documented.

---

## 9. QUESTION BANK INTEGRATION

Reuse the existing BAREA-002 Question Bank service/repository/domain contracts.

Do not create a parallel question storage system.

For a successful generation request:

1. Validate the request.
2. Call the AI provider through the abstraction.
3. Validate the structured output/schema.
4. Validate each generated question against the existing domain rules.
5. Verify the requested question count is satisfied.
6. Persist the generated questions using the existing Question Bank infrastructure.
7. Ensure every persisted item is `PENDING_REVIEW`.
8. Preserve `organizationId` isolation.
9. Return the generated staged questions/result to the caller without exposing provider credentials or internal secrets.

Do not add direct APPROVED creation paths.

Do not weaken the BAREA-002 lifecycle rules.

---

## 10. ORGANIZATIONAL ISOLATION

BAREA-002 requires `organizationId` isolation.

BAREA-003 must carry organization context through generation and persistence.

A generation request for organization A must never create or expose questions belonging to organization B.

Test this explicitly.

Do not introduce cross-organization prompt/context leakage through shared mutable state.

---

## 11. SCRIPTURE / THEOLOGICAL BOUNDARY

Do not claim that automated validation verifies biblical truth.

BAREA-003 may validate that a Scripture reference is present and structurally represented, but it must not label a question as theologically verified.

Do not implement a Scripture truth engine, theological fact-checking service, Bible translation verification service, or teacher review UI in this milestone.

Those concerns belong to the human review stage / later milestone.

---

## 12. TESTING REQUIREMENTS

Tests are a first-class deliverable.

Add deterministic automated coverage for:

### Request validation
- valid generation request;
- count 1;
- count 20;
- count 0 rejected;
- count >20 rejected;
- invalid difficulty rejected;
- invalid question type rejected;
- invalid required context rejected.

### Structured output validation
- valid output accepted;
- missing required field rejected;
- wrong field type rejected;
- malformed options rejected;
- invalid correct-option indices rejected;
- duplicate MULTI_SELECT correct indices rejected;
- invalid enum rejected;
- extra approval/status attempt cannot bypass lifecycle.

### Pipeline behavior
- provider called with normalized request;
- valid generation persists questions;
- persisted questions are `PENDING_REVIEW`;
- requested count is enforced;
- invalid batch persists zero questions;
- provider failure persists zero questions;
- domain validation failure persists zero questions;
- organization isolation is preserved.

### Question Bank lifecycle
Explicitly prove BAREA-002 invariants remain intact:

- no direct APPROVED creation;
- DRAFT/PENDING_REVIEW are not approved content;
- approved-content modification still demotes to PENDING_REVIEW;
- approved-only retrieval remains approved-only.

### Provider boundary
Use a deterministic fake provider in the normal automated test suite.

If a real provider adapter is included, do not make ordinary tests depend on network access or live credentials.

A separate opt-in integration test may exist only if clearly isolated and disabled by default.

---

## 13. DATA / PERSISTENCE SAFETY

Use the existing Question Bank persistence implementation.

Do not replace `node:sqlite` / `DatabaseSync` during BAREA-003.

Do not introduce an ORM.

Do not create a second database schema for AI-generated questions.

The AI pipeline is a service layer over the existing Question Bank.

---

## 14. SECURITY / SECRET HANDLING

Never commit:

- API keys;
- provider credentials;
- access tokens;
- `.env` files containing secrets;
- copied production configuration.

Provider configuration must come from environment/configuration boundaries.

Log safely:

- do not log API keys;
- do not log authorization headers;
- do not dump raw provider responses if they could contain secrets or sensitive configuration;
- keep error messages useful without leaking credentials.

---

## 15. SCOPE — STRICTLY OUT OF SCOPE

Do NOT implement:

- BAREA-004 teacher review UI;
- teacher approval UI;
- batch approval UI;
- regeneration UI;
- HTTP/REST API endpoints;
- authentication/authorization framework;
- quiz authoring;
- quiz publishing;
- live sessions;
- participant joining;
- QR codes;
- WebSockets/realtime transport;
- host/participant/projector UI;
- scoring;
- leaderboards;
- analytics;
- production deployment;
- church pilot;
- theological truth certification;
- Scripture fact-checking engine;
- database replacement;
- ORM;
- frontend framework;
- unrelated refactoring.

A service/API contract for future HTTP exposure is acceptable only if it is a small internal TypeScript interface required by the milestone. Do not build the HTTP layer itself.

---

## 16. DOCUMENTATION / ADR REQUIREMENTS

Before coding beyond the smallest necessary setup, review whether BAREA-003 introduces any architectural decision that is currently open.

At minimum address the **AI LLM Gateway** open decision in `docs/DECISIONS.md`.

If a concrete provider/SDK is selected, add an ADR documenting:

- provider choice;
- why it is isolated behind the AI generation port;
- configuration/credential boundary;
- model configuration strategy;
- structured-output enforcement approach;
- testing strategy without mandatory live network calls;
- future provider substitution strategy.

Keep the ADR narrow. Do not resolve unrelated open decisions.

Update `docs/ROADMAP.md` only to accurately reflect the BAREA-003 implementation state after work is actually completed/reviewed. Do not mark future milestones active.

---

## 17. GIT / BRANCH / PR WORKFLOW

Create a dedicated branch from current `main`:

`barea-003-ai-generation`

Use focused Conventional Commits.

Open a PR against `main`.

Do **not** merge the PR.

Do **not** self-approve the PR.

Do **not** start BAREA-004.

Keep the PR focused strictly on BAREA-003.

---

## 18. REQUIRED VALIDATION

Before reporting completion, run the repository's actual validation commands and record exact results.

At minimum:

1. clean dependency install;
2. `npm run typecheck`;
3. `npm run build`;
4. `npm test`;
5. any additional schema-validation or integration test command introduced by the implementation;
6. `git diff --check`;
7. verify no secrets were added;
8. verify no legacy JavaScript source was introduced;
9. verify `dist/` remains ignored;
10. verify BAREA-002 tests and invariants remain green.

Do not report a pass unless the commands were actually executed.

---

## 19. AGY-REPORT.md

Update `AGY-REPORT.md` with an execution report containing:

- baseline `main` SHA;
- branch name;
- implementation summary;
- exact files changed;
- AI provider abstraction and concrete adapter, if any;
- schema/validation design;
- Question Bank integration;
- lifecycle safety confirmation;
- organization isolation confirmation;
- test coverage;
- exact validation command results;
- provider/credential configuration notes;
- ADR changes;
- PR number and URL;
- final branch/head SHA;
- working-tree status;
- explicit confirmation that BAREA-004+ was not started.

Do not fabricate any SHA, test result, provider result, or PR status.

---

## 20. STOP CONDITION

When the following are true:

- BAREA-003 implementation is complete;
- tests and validation pass;
- documentation/ADR requirements are complete;
- PR is open against `main`;
- working tree is clean;
- BAREA-004+ has not been started;
- `AGY-REPORT.md` is updated;

**STOP.**

Do not merge the PR.

Do not begin BAREA-004.

Do not perform any unrelated work.
