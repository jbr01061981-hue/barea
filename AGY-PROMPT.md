# AGY — BAREA-005 DESIGN GATE

## STATUS

BAREA-004 is completed and merged on `main`.

**BAREA-005 implementation is NOT authorized.**

Your task at this stage is **DESIGN ONLY**. Do not modify application code, database schema, tests, or UI implementation for BAREA-005.

Do not open an implementation PR. Do not start BAREA-006 or any later milestone.

The purpose of this gate is to produce and validate a precise BAREA-005 design before implementation permission is granted.

---

## SOURCE OF TRUTH

Read the current `main` versions of:

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md` if present
- `docs/VERIFICATION-GATES.md` if present
- `README.md`

Then inspect the current implementation and persistence conventions, especially:

- `src/domain/question.ts`
- `src/service/question-bank-service.ts`
- `src/persistence/sqlite-question-repository.ts`
- `src/app/teacher/review/db.ts`
- all Teacher Review server actions
- relevant existing tests
- `AGY-REPORT.md`

Do not assume a schema or service structure that is inconsistent with the existing codebase.

---

# 1. BAREA-005 OBJECTIVE

Design the quiz-authoring and publishing layer for this flow:

`Approved Question Bank -> Quiz Draft -> Configure -> Review -> Publish -> Immutable Published Snapshot`

BAREA-005 covers:

- compiling approved questions from Question Bank into structured quizzes;
- configurable per-question countdowns;
- scoring-style configuration;
- question ordering;
- option-shuffling configuration;
- explicit publishing;
- immutable published snapshots for future live sessions.

BAREA-005 does NOT implement live gameplay.

---

# 2. EXPLICIT NON-GOALS

Do NOT design or implement beyond the BAREA-005 boundary:

- participant accounts;
- room creation;
- room codes;
- QR joining;
- participant joining;
- WebSockets/realtime transport;
- live countdown execution;
- answer submission;
- server-side live scoring;
- leaderboard;
- podium;
- projector synchronization;
- church-wide deployment;
- unrelated refactoring.

Those belong to later milestones.

---

# 3. REQUIRED QUIZ DOMAIN MODEL

Define the conceptual Quiz model and explain how it fits the existing repository architecture.

At minimum establish:

- `id`
- `organizationId`
- `title`
- `description`
- lifecycle status
- question membership/order
- timer configuration
- scoring configuration
- option-shuffle configuration
- creation/update metadata where consistent with existing conventions
- published snapshot representation

The exact physical database schema is NOT predetermined.

Evaluate whether the existing persistence model calls for:

- quiz tables;
- quiz-question membership/order records;
- published snapshot records or an equivalent immutable representation.

Choose the simplest architecture that preserves the required invariants and explain the decision.

---

# 4. QUIZ LIFECYCLE

Define a minimal lifecycle:

`DRAFT -> PUBLISHED`

Specify:

- which operations are legal in DRAFT;
- what happens when a quiz is published;
- whether a published quiz can be edited;
- whether republishing/versioning is intentionally deferred.

Do not invent an unpublish/versioning feature unless existing requirements require it.

A published quiz must not silently change because its source Question Bank records later change.

---

# 5. QUESTION SELECTION SECURITY BOUNDARY

This is a mandatory security section of the design.

When a teacher supplies question IDs, the server must re-fetch every selected question and verify:

1. it exists;
2. it belongs to the authorized organization;
3. it is currently `APPROVED`;
4. it is eligible for quiz use;
5. its structure is valid;
6. the requesting teacher is authorized to modify the quiz.

Never trust browser-provided:

- `organizationId`;
- `ownerId`;
- approval status;
- quiz ownership;
- protected question fields;
- arbitrary persistence fields.

Do not repeat the BAREA-004 mistake of passing an arbitrary runtime object into persistence merely because TypeScript types appear to restrict it.

All security-sensitive request fields must be reconstructed from explicit allowlists and trusted server context.

---

# 6. TENANT ISOLATION

Every Quiz operation must be organization-scoped using trusted server-side authorization context.

Define and test the required behavior for:

- create;
- read;
- update;
- add question;
- remove question;
- reorder;
- configure;
- publish.

An Org A teacher must not be able to read, mutate, publish, or attach questions from Org B.

Browser/query/form fields must have zero authority to select the tenant.

---

# 7. DRAFT MUTATION RULES

Define the explicitly mutable Quiz fields.

Expected configurable areas:

- title;
- description;
- selected approved questions;
- question order;
- timers;
- scoring style;
- option shuffle.

Define an explicit runtime allowlist.

Protected fields such as these must never be client-controlled:

- quiz ID;
- organization ID;
- ownership;
- lifecycle status;
- published snapshot;
- created/updated metadata where server-controlled.

---

# 8. QUESTION ORDERING

Define the initial ordering behavior.

At minimum support deterministic manual ordering if consistent with the requirements.

Specify validation rules for:

- duplicate question IDs;
- missing questions;
- foreign-tenant questions;
- nonexistent questions;
- invalid positions;
- malformed order payloads.

Do not let the client create an inconsistent persisted question sequence.

---

# 9. TIMER CONFIGURATION

Define:

- quiz-level default timer;
- optional per-question override;
- validation rules;
- allowed units/range;
- behavior when an override is absent.

Timer configuration is stored as quiz configuration.

Do NOT implement the live countdown engine in BAREA-005.

Reject malformed values including negative, zero where prohibited, non-numeric, NaN, Infinity, excessively large, or otherwise invalid values according to the chosen domain rules.

---

# 10. SCORING CONFIGURATION

Define a server-validated finite scoring-style model.

Do not accept arbitrary scoring strings from the client.

BAREA-005 configures scoring behavior; it does NOT implement live scoring.

If multiple scoring styles are required by the requirements, enumerate them and define their semantics precisely. If only one is currently required, keep the model minimal and document future extensibility rather than inventing unsupported modes.

---

# 11. OPTION SHUFFLING

Define the quiz-level option-shuffling configuration.

The setting must become part of the published snapshot.

Do NOT implement participant-side randomization or live gameplay in this milestone.

If deterministic behavior is required later, document what BAREA-005 must preserve so the future live engine can implement it without changing the published quiz definition.

---

# 12. PUBLISHING SECURITY BOUNDARY

Publishing is an explicit server-side operation.

Before publication the server must:

1. authenticate/establish the authorized teacher context;
2. authorize access to the Quiz;
3. verify the Quiz is publishable;
4. re-fetch every referenced question;
5. verify every question still belongs to the organization;
6. verify every question is still `APPROVED` and eligible;
7. validate the complete quiz configuration and order;
8. construct the immutable published snapshot;
9. persist publication atomically;
10. transition the Quiz to `PUBLISHED`.

Approval MUST be revalidated at publication time.

Do not rely only on the state observed when a question was originally added to the draft.

---

# 13. IMMUTABLE PUBLISHED SNAPSHOT

This is a mandatory invariant.

A published quiz must be independent of future Question Bank edits.

Example:

`Question Bank Q1 -> Quiz Draft -> Publish -> Snapshot`

If Q1 is later edited, archived, or otherwise changed, the already-published Quiz must retain its published content and configuration.

Future live sessions must consume the frozen published representation, not the mutable Question Bank.

Choose and document the physical persistence strategy that best fits the repository.

---

# 14. ATOMIC PUBLICATION

Publication must not leave partially published state.

Avoid states such as:

- `PUBLISHED` with an incomplete snapshot;
- snapshot created but Quiz still incorrectly marked DRAFT;
- only some questions persisted into the published representation.

Use the transaction/atomicity mechanisms appropriate to the existing persistence layer.

Define failure behavior explicitly.

---

# 15. REQUIRED ADVERSARIAL ACCEPTANCE TEST DESIGN

The design document must define tests for at least:

### Tenant isolation

- Org A cannot read Org B Quiz.
- Org A cannot edit Org B Quiz.
- Org A cannot publish Org B Quiz.
- Org A cannot attach an Org B question.

### Approval enforcement

- unapproved questions cannot enter a Quiz;
- client-injected `status: APPROVED` cannot bypass approval;
- Question Bank ownership cannot be overwritten;
- publication re-checks approval;
- a question becoming ineligible after draft selection blocks publication.

### Identifier attacks

- client cannot replace the Quiz ID with another tenant's Quiz;
- client cannot inject `organizationId`;
- client cannot attach foreign question IDs;
- duplicate IDs are rejected or normalized according to the defined invariant;
- nonexistent IDs are rejected.

### Protected-field injection

Attempt payloads containing arbitrary values for:

`id`, `organizationId`, `ownerId`, `status`, `published`, `createdAt`, `updatedAt`, `publishedSnapshot`, and unknown fields

must not mutate protected server-controlled state.

### Snapshot integrity

1. publish a Quiz;
2. modify the source Question Bank record;
3. read the published Quiz;
4. prove the published Quiz remains unchanged.

### Publication integrity

- invalid Quiz cannot publish;
- invalid timer cannot publish;
- invalid scoring configuration cannot publish;
- invalid ordering cannot publish;
- unauthorized teacher cannot publish;
- failed publication leaves no partially published state.

---

# 16. UI DESIGN SCOPE

Design the teacher authoring flow only:

`Question Bank -> select approved questions -> Quiz Editor -> configure -> review -> publish`

The design should specify the required screens/components and server actions, while respecting the existing frontend standards.

Do not implement UI yet.

---

# 17. REQUIRED DESIGN ARTIFACT

Create/update a dedicated design document:

`docs/BAREA-005-DESIGN-GATE.md`

The document must contain:

1. objective;
2. scope/non-goals;
3. domain model;
4. lifecycle;
5. persistence design;
6. authorization/tenant model;
7. question-selection rules;
8. timer configuration;
9. scoring configuration;
10. ordering;
11. option shuffle;
12. publication workflow;
13. immutable snapshot design;
14. atomicity/failure behavior;
15. API/server-action boundaries;
16. UI design scope;
17. security invariants;
18. adversarial acceptance tests;
19. implementation risks/trade-offs;
20. explicit implementation readiness verdict.

Do not modify application implementation while producing this artifact.

---

# 18. MULTI-AGENT DESIGN REVIEW

Use available specialized agents if the environment supports them.

Request independent input from:

1. **Security/Backend** — challenge tenant isolation, approval enforcement, protected fields, and publication/snapshot integrity.
2. **Persistence/Data** — challenge schema, transaction, and snapshot design.
3. **Frontend/Next.js** — challenge the teacher authoring flow and server/client boundary.
4. **Testing** — challenge the acceptance-test matrix and identify missing adversarial cases.
5. **Independent Review** — attempt to find a design-level authorization or snapshot bypass.

Record only actual participation and actual findings. Never fabricate agent participation.

If specialized agents are unavailable, state that explicitly and perform the corresponding review yourself where possible.

---

# 19. DESIGN VERIFICATION

Before declaring the gate ready, cross-check the design against:

- BAREA-004 security lessons;
- `docs/REQUIREMENTS.md`;
- `docs/ARCHITECTURE.md`;
- `docs/DECISIONS.md`;
- existing persistence conventions;
- existing server-action authorization patterns;
- existing test conventions.

Identify any requirement conflict rather than silently choosing an implementation.

---

# 20. AGY-REPORT.md

Update `AGY-REPORT.md` with a BAREA-005 design-gate section containing:

- documents inspected;
- implementation intentionally not started;
- proposed architecture;
- security model;
- snapshot strategy;
- persistence/transaction strategy;
- acceptance-test strategy;
- actual multi-agent participation/evidence;
- unresolved design questions, if any;
- final design readiness recommendation.

Do not claim implementation or tests that were not actually performed.

---

# 21. STOP CONDITION

When the design artifact and report are complete:

- do NOT modify BAREA application code;
- do NOT create BAREA-005 implementation branches;
- do NOT open an implementation PR;
- do NOT merge anything related to BAREA-005 implementation;
- do NOT start BAREA-006 or later milestones;
- leave the working tree clean except for the intentional design-document/report changes;
- stop and wait for independent BAREA design review and explicit implementation authorization.

## FINAL RULE

**Design first. Code later.**

BAREA-005 implementation permission will be granted only after the design gate is independently reviewed and explicitly marked GO.