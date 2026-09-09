# AGY — BAREA-005 IMPLEMENTATION AUTHORIZATION

## STATUS

**BAREA-005 DESIGN GATE: GO — IMPLEMENTATION AUTHORIZED.**

The independent final review has been completed against the revised design at commit `ae48606`.

Findings A-G are considered remediated. The independent verdict is:

> **GO — IMPLEMENT BAREA-005.**

You may now implement BAREA-005, but implementation must remain strictly within the approved design and milestone boundary in `docs/BAREA-005-DESIGN-GATE.md`.

---

# 1. MANDATORY SUB-AGENT / MULTI-AGENT IMPLEMENTATION REVIEW

**Use available sub-agents/specialized agents before and during implementation.**

Do not rely on a single-agent implementation for this milestone when specialized sub-agents are available.

Required roles:

1. **Security Architect / Red-Team Agent**
   - independently challenge tenant isolation;
   - authorization boundaries;
   - runtime payload allowlisting;
   - published snapshot immutability;
   - answer secrecy;
   - TOCTOU and protected-field attacks.

2. **SQLite / Persistence Architect**
   - review schema and foreign keys;
   - verify SQLite trigger design;
   - verify `BEGIN IMMEDIATE` transaction behavior;
   - review repository boundaries;
   - verify atomic publication and rollback.

3. **Backend / Domain Architect**
   - review Quiz domain model and service boundaries;
   - validate lifecycle transitions;
   - validate timer/scoring configuration;
   - verify publication invariants.

4. **Frontend Architect / UI Specialist**
   - review teacher authoring routes and component boundaries;
   - enforce existing frontend standards;
   - verify published quizzes are read-only;
   - check that client input never becomes authorization authority.

5. **Independent Test / QA Agent**
   - review the adversarial test matrix;
   - identify missing negative cases;
   - verify tests prove security invariants rather than merely happy-path behavior.

If a specialist is unavailable, state that explicitly and perform the review yourself.

**Record only actual sub-agent participation, findings, disagreements, and resolutions. Never fabricate agent IDs, reports, or conclusions.**

Before implementation begins, have the sub-agents challenge the implementation plan and identify any divergence from the approved design. Resolve material disagreements before coding.

After implementation, have the Security/Red-Team and QA agents independently review the completed implementation before declaring the milestone complete.

---

# 2. SOURCE OF TRUTH

The following are authoritative:

- `docs/BAREA-005-DESIGN-GATE.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md`
- existing BAREA-004 implementation and tests

Do not weaken or reinterpret the approved security invariants to make implementation easier.

If implementation discovers a genuine design contradiction, **STOP and report it** rather than silently changing the architecture.

---

# 3. IMPLEMENTATION SCOPE

Implement only BAREA-005:

- Quiz domain model;
- Quiz persistence/repository;
- Quiz service/application layer;
- authorized teacher server actions;
- Question Bank composition into Quiz drafts;
- deterministic ordering/reordering;
- timer configuration and validation;
- scoring-style configuration;
- option-shuffle configuration;
- Quiz lifecycle including the approved ARCHIVED semantics;
- atomic publication;
- immutable published snapshots;
- teacher authoring UI;
- required adversarial and unit/integration tests;
- documentation updates required to accurately describe the completed implementation.

Do NOT start BAREA-006, BAREA-007, or later milestones.

---

# 4. SECURITY REQUIREMENTS — NON-NEGOTIABLE

## Tenant authority

- Organization identity MUST come from the authenticated server-side teacher context.
- Never trust client-supplied `organizationId`, `tenantId`, role, user ID, query parameters, headers, or hidden form fields for authorization.
- Cross-tenant resources must fail closed without disclosure.

## Runtime allowlisting

For every mutable Quiz payload, reconstruct an explicit allowlist at the server boundary.

Never allow runtime injection of:

- `id`
- `organizationId`
- `status`
- `publishedSnapshot`
- `createdAt`
- `updatedAt`
- unknown properties

Do not rely on TypeScript types as the runtime security boundary.

## Question eligibility

Only questions belonging to the authenticated teacher's organization and having `status === APPROVED` may be attached to a Quiz or enter a published snapshot.

Re-check eligibility inside the atomic publication transaction.

## Published snapshot immutability

Implement the approved database-level triggers:

- `prevent_snapshot_update`
- `prevent_snapshot_delete`

The snapshot repository must expose insert/read behavior only; no update/delete/replace operation is permitted.

A published snapshot must remain byte-for-byte/logically unchanged even if the source Question Bank question is later edited, demoted, archived, or otherwise changed.

## Answer secrecy

`correctOptionIndices` and other answer-bearing snapshot fields are server-authoritative.

They MUST NOT be returned to participants during an active question window.

Implement only the BAREA-005 foundations necessary for this boundary; the actual live participant transport belongs to later milestones.

---

# 5. SQLITE / TRANSACTION REQUIREMENTS

Use the approved Node.js `DatabaseSync` architecture.

For atomic publication:

1. resolve authorized teacher context;
2. begin `BEGIN IMMEDIATE`;
3. re-read Quiz by ID and organization;
4. verify Quiz is `DRAFT`;
5. read ordered Quiz membership;
6. re-read every referenced Question;
7. verify organization ownership;
8. verify `APPROVED` status;
9. validate the complete composition;
10. construct the complete self-contained snapshot;
11. insert the snapshot;
12. update Quiz status to `PUBLISHED`;
13. commit;
14. only after successful commit perform cache revalidation.

Any failure must roll back the entire publication.

Do not use generic claims about row locking that are not applicable to SQLite. Follow the actual transaction semantics documented in the design.

Question Bank mutations participating in the publication TOCTOU boundary must use the same database transaction/locking discipline so publication has deterministic serialized behavior.

---

# 6. SNAPSHOT SCHEMA / IMMUTABILITY

Implement the approved schema from the design document.

Important:

- `quiz_questions` MUST NOT contain the removed redundant `organization_id` field.
- `published_quiz_snapshots` stores a complete self-contained snapshot.
- `published_quiz_snapshots` must have database-enforced update/delete prevention.
- published Quiz reads must use the frozen snapshot rather than mutable Question Bank content.
- physical deletion of a Quiz containing a published snapshot must be prevented according to the approved schema/lifecycle semantics.

Add tests that attempt direct SQL UPDATE and DELETE against the snapshot table and verify the SQLite triggers reject them.

---

# 7. QUIZ LIFECYCLE

Implement exactly the approved lifecycle:

`DRAFT -> PUBLISHED`
`DRAFT -> ARCHIVED -> DRAFT`
`PUBLISHED -> ARCHIVED`

For published archives:

- hide from active Quiz catalogs;
- prevent creation of new live rooms in the later session milestone;
- preserve the immutable snapshot;
- do not disrupt already-running live sessions;
- do not restore a published archive to DRAFT.

Do not add additional lifecycle states or transitions.

---

# 8. TIMER AND SCORING CONTRACT

Timer values:

- default: 30 seconds;
- valid range: 10-120 seconds inclusive;
- integer only;
- per-question override uses the same range.

Scoring styles:

### STANDARD
- correct before expiry: 100 points;
- incorrect: 0;
- late/expired: 0.

### SPEED_WEIGHTED
- base: 100;
- floor: 50;
- exact formula from the approved design:

`50 + Math.round(50 * (remainingTimeMs / totalTimeLimitMs))`

- maximum remaining time: 100;
- positive remaining time approaching zero: 50;
- expired (`remainingTimeMs <= 0`): 0;
- incorrect: 0;
- integer result using standard `Math.round()`.

Scoring must be based on server-authoritative timing in the later live engine.

Reject arbitrary scoring strings.

---

# 9. DETERMINISTIC FAILURE INJECTION

Implement the approved test seam for publication atomicity.

It must:

- be active only when `NODE_ENV === 'test'`;
- inject failure after snapshot insertion but before Quiz status changes to `PUBLISHED`;
- cause the transaction to roll back;
- leave the Quiz as `DRAFT`;
- leave zero snapshot rows for that Quiz;
- prove no partial publication state remains.

The test seam must not provide a production authorization or mutation path.

---

# 10. REQUIRED ADVERSARIAL TESTS

Implement and pass all cases specified in `docs/BAREA-005-DESIGN-GATE.md`, including:

- cross-tenant read/edit/attach/publish attempts;
- unapproved Question Bank questions;
- archived Question Bank questions;
- TOCTOU demotion/archive races;
- protected-field injection;
- unknown-property injection;
- duplicate question insertion;
- invalid ordering/reordering;
- zero-question publication;
- invalid timer values;
- invalid scoring style;
- source-question mutation after publication;
- source-question archive/delete after publication;
- direct snapshot UPDATE;
- direct snapshot DELETE;
- answer-secrecy projection checks;
- concurrent mutation/publication behavior;
- deterministic atomic failure injection.

Do not merely assert that functions return errors. Verify the underlying database state and security invariants remain correct.

---

# 11. FRONTEND REQUIREMENTS

Implement the teacher authoring UI using the existing BAREA frontend architecture and `docs/FRONTEND-STANDARD.md`.

Expected conceptual routes:

- `/teacher/quizzes`
- `/teacher/quizzes/new`
- `/teacher/quizzes/[id]`

The UI must support the approved authoring workflow without introducing participant/session functionality.

Published quizzes must be presented as read-only with respect to frozen published content.

Do not put authorization decisions solely in client components.

---

# 12. VALIDATION / QUALITY GATE

Before opening the implementation PR:

1. run the complete existing test suite;
2. run the new BAREA-005 adversarial tests;
3. run TypeScript/typecheck validation;
4. run the production build validation appropriate to the repository;
5. run `git diff --check`;
6. inspect the final diff for accidental milestone creep;
7. have the Security/Red-Team sub-agent independently review the implementation;
8. have the QA/Test sub-agent independently review the tests and security invariants;
9. resolve any material findings;
10. verify the working tree and branch state are clean/intentional.

Do not report a test as passed unless it was actually executed.

---

# 13. DOCUMENTATION / REPORTING

Update `AGY-REPORT.md` with:

- implementation summary;
- files changed;
- actual sub-agents used;
- actual findings and resolutions;
- security review results;
- test commands actually executed and exact results;
- build/typecheck results;
- confirmation of adversarial test coverage;
- final commit SHA;
- implementation PR number.

Update `docs/ROADMAP.md` only when appropriate to reflect the actual milestone state.

Do not fabricate sub-agent identities, review results, test results, or CI results.

---

# 14. STOP / ESCALATION RULES

Stop and report before proceeding if:

- the approved design cannot be implemented without changing a security invariant;
- a required database constraint cannot be enforced as specified;
- tenant isolation cannot be guaranteed;
- answer secrecy cannot be preserved;
- publication atomicity cannot be demonstrated;
- the existing architecture contradicts the approved design in a material way.

In such a case, do not silently redesign BAREA-005. Report the exact contradiction and wait for review.

Otherwise, implementation is authorized.

---

# FINAL AUTHORITY

The independent design review has granted:

**BAREA-005 = GO.**

The required sequence is now:

`DESIGN -> SUB-AGENT CHALLENGE -> CORRECTION -> INDEPENDENT REVIEW -> GO -> SUB-AGENT IMPLEMENTATION REVIEW -> IMPLEMENTATION -> SECURITY/QA REVIEW -> TEST/VERIFY -> PR`

**Proceed with BAREA-005 implementation. Use sub-agents. Stay strictly within scope.**
