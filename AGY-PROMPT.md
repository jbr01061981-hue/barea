# AGY — BAREA-005 DESIGN GATE — CORRECTION PASS

## STATUS

**BAREA-005 IMPLEMENTATION IS NOT AUTHORIZED.**

The independent review of `docs/BAREA-005-DESIGN-GATE.md` found the core architecture sound, but identified several design-level issues that must be corrected before implementation authorization can be considered.

This is a **DESIGN CORRECTION ONLY** task.

Do NOT implement BAREA-005 application code, database migrations, Quiz services/actions, routes, UI components, or implementation tests.

Do NOT open an implementation PR.

---

# 1. FIRST: USE SUB-AGENTS FOR AN INDEPENDENT DESIGN CHALLENGE

You MUST use available sub-agents/specialized agents for this correction pass if the environment supports them.

Ask them to independently challenge the seven findings below rather than simply agreeing with the existing design.

Required review roles:

1. **Security Architect**
   - snapshot immutability enforcement;
   - tenant isolation;
   - protected-field/runtime allowlisting;
   - publication authorization;
   - answer secrecy.

2. **SQLite/Persistence Architect**
   - `quiz_questions` schema;
   - redundant `organization_id`;
   - foreign keys;
   - transaction semantics;
   - concurrent publication/mutation behavior;
   - snapshot persistence.

3. **Backend/Concurrency Specialist**
   - TOCTOU semantics;
   - `BEGIN IMMEDIATE` behavior;
   - publication transaction boundary;
   - failure/rollback behavior;
   - deterministic fault injection for atomicity tests.

4. **Domain/Product Specialist**
   - Quiz lifecycle;
   - ARCHIVED semantics;
   - scoring-style contract;
   - timer rules;
   - BAREA-005 scope versus later milestones.

5. **Independent Red-Team Reviewer**
   - attempt to find a design-level bypass not already covered;
   - especially try to publish stale/unapproved/foreign questions or mutate a published snapshot.

Record only actual sub-agent participation and actual findings. Do not fabricate agent IDs, reviews, or conclusions.

If a requested specialist is unavailable, state that explicitly and perform that review yourself.

---

# 2. FINDING A — TRUE SNAPSHOT IMMUTABILITY

The current design calls the published snapshot immutable, but the proposed table does not itself establish an update/delete prohibition.

Revise the design so that immutability is an explicit architectural invariant.

It must define:

- the repository API for snapshots;
- that publication is insert-only;
- no normal update operation exists;
- no normal delete operation exists;
- published snapshot data cannot be replaced by a later client request;
- published Quiz reads resolve to the frozen snapshot;
- any administrative/destructive operation, if ever required, is explicitly outside BAREA-005.

Add an adversarial test for attempted snapshot mutation/deletion and define the expected fail-closed behavior.

Do NOT claim database-level immutability unless the chosen SQLite mechanism actually enforces it.

The design must distinguish **application-enforced immutable semantics** from **database-enforced constraints**.

---

# 3. FINDING B — REMOVE OR JUSTIFY REDUNDANT `organization_id` FROM `quiz_questions`

The current proposed schema stores:

`quiz_questions.quiz_id`
`quiz_questions.organization_id`
`quiz_questions.question_id`

The tenant is already derivable from the Quiz and Question.

This redundant field can become inconsistent.

Prefer removing `organization_id` from `quiz_questions` unless there is a compelling, demonstrated reason to retain it.

If retained, the design MUST define how database/application integrity guarantees:

`quiz_questions.organization_id == quizzes.organization_id == questions.organization_id`

and must include tests for inconsistency attempts.

Do not leave this ambiguity unresolved.

---

# 4. FINDING C — FINALIZE SCORING SEMANTICS

The current design defines `SPEED_WEIGHTED` using a floor described as `e.g. 50`.

That is not implementation-ready.

Choose one of these paths:

### Preferred minimal path
If BAREA-009 is responsible for actual live scoring, keep BAREA-005 configuration minimal and define only a stable finite scoring enum whose meaning is unambiguous.

### Or fully specify SPEED_WEIGHTED
If retaining `SPEED_WEIGHTED`, define exactly:

- base points;
- floor;
- formula;
- rounding behavior;
- boundary behavior at zero/maximum remaining time;
- whether the scoring configuration is sufficient for BAREA-009.

No `e.g.` values may remain in an implementation contract.

Do not allow arbitrary scoring strings.

---

# 5. FINDING D — RESOLVE `ARCHIVED` LIFECYCLE SCOPE

The original BAREA-005 boundary is centered on:

`DRAFT -> PUBLISHED`

The current design introduces:

`DRAFT -> ARCHIVED`
`PUBLISHED -> ARCHIVED`

Either:

1. remove ARCHIVED lifecycle behavior from BAREA-005 and defer it to a later milestone; OR
2. formally define its semantics.

If ARCHIVED remains, explicitly define:

- who may archive;
- whether draft archive is reversible;
- whether published archive affects existing live sessions;
- whether it prevents new live sessions;
- whether it removes/hides the quiz from lists;
- whether snapshot data remains intact;
- what operations remain legal after archive.

Do not introduce lifecycle behavior without precise semantics.

---

# 6. FINDING E — EXPLICIT SNAPSHOT ANSWER-SECRECY BOUNDARY

The published snapshot correctly contains `correctOptionIndices` because the future server-authoritative engine needs them.

However, the design MUST explicitly state:

> Published snapshots are server-authoritative data and are never returned in full to participants during an active question window.

Define the future safe projection conceptually:

`PublishedQuizSnapshot -> participant-safe projection`

where correct answers are withheld until the appropriate result state.

Do not implement the participant projection now.

Cross-reference ADR-004 and preserve its answer-secrecy invariant.

---

# 7. FINDING F — TIGHTEN TOCTOU/CONCURRENCY SEMANTICS

The design currently says publication uses `BEGIN IMMEDIATE` and revalidates every question.

Make the concurrency contract precise.

The design must state:

1. when the transaction begins;
2. how the Quiz is re-read/serialized inside the transaction;
3. how the membership rows are read;
4. how every referenced Question is re-read;
5. how tenant ownership is checked;
6. how approval/eligibility is checked;
7. when the snapshot object is constructed;
8. when the snapshot row is inserted;
9. when Quiz status becomes `PUBLISHED`;
10. what happens if any validation or persistence step fails;
11. what happens if a concurrent Question Bank mutation is attempted;
12. why the resulting behavior is deterministic.

Do not use generic claims such as "row locking" that are not native to SQLite. Describe actual SQLite behavior and the transaction strategy chosen by the repository.

If the design depends on serialization of all Question Bank writes through the same database connection/transaction discipline, state that explicitly.

---

# 8. FINDING G — DETERMINISTIC ATOMICITY TEST FAILURE INJECTION

ADV-QZ-20 currently says:

"If snapshot generation fails midway..."

Specify how the test deliberately causes that failure.

Use a deterministic test seam/failure injection mechanism at the service/repository boundary rather than relying on an accidental SQLite failure.

The design must define:

- the injected failure point;
- expected rollback;
- expected Quiz status;
- expected snapshot state;
- cleanup behavior;
- how the test proves there is no partial publication.

Do not implement the failure seam yet; design it only.

---

# 9. EXPAND THE ADVERSARIAL MATRIX

Keep `ADV-QZ-01` through `ADV-QZ-20`, but add the newly discovered cases as additional stable IDs rather than deleting existing coverage.

At minimum add:

- attempted published-snapshot update;
- attempted published-snapshot deletion;
- redundant-tenant-field inconsistency if that field is retained;
- participant exposure of `correctOptionIndices` through a hypothetical active-question projection;
- concurrent Question Bank mutation during publication;
- deterministic publication-failure injection.

The final matrix must have explicit expected outcomes.

---

# 10. CROSS-CHECK AGAINST ACTUAL REPOSITORY

Before finalizing the revised design, inspect the real current implementation and documentation:

- `src/persistence/sqlite-question-repository.ts`
- `src/app/teacher/review/db.ts`
- existing Question Bank services/actions
- existing transaction helpers/patterns
- `docs/DECISIONS.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `AGY-REPORT.md`

Do not invent APIs, database capabilities, or locking semantics that the current architecture cannot support.

If the design references `SqliteQuizRepository`, `src/domain/quiz.ts`, or other BAREA-005 implementation artifacts, keep those as **proposed future artifacts only**. They must not be created during this correction pass.

---

# 11. REQUIRED DOCUMENTATION CHANGES

Update only documentation/design artifacts:

1. `docs/BAREA-005-DESIGN-GATE.md`
2. `AGY-REPORT.md`
3. `docs/ROADMAP.md` if needed for accurate status

The design document must show:

**DESIGN GATE — REVISED / AWAITING FINAL INDEPENDENT REVIEW**

Do not mark BAREA-005 implementation-ready merely because the corrections are written.

---

# 12. AGY-REPORT REQUIREMENTS

Record:

- independent review findings;
- each correction made for Findings A-G;
- sub-agent roles actually used;
- actual findings from each sub-agent;
- disagreements and their resolution;
- exact documentation commit SHA;
- confirmation that zero BAREA-005 application implementation was added;
- confirmation that implementation remains unauthorized.

Do not claim `82/82` or any other test result unless it was actually run during this pass.

---

# 13. STRICT STOP CONDITION

After completing the correction pass:

**STOP.**

Do NOT:

- create `src/domain/quiz.ts`;
- create `SqliteQuizRepository`;
- create `quizzes`, `quiz_questions`, or `published_quiz_snapshots` tables;
- create Quiz server actions/services;
- create Quiz UI routes/components;
- implement BAREA-005 tests;
- create an implementation PR;
- start BAREA-006 or later milestones.

Only documentation/design changes are authorized.

Wait for the next independent review.

# FINAL AUTHORITY

The sequence remains:

`DESIGN -> SUB-AGENT CHALLENGE -> CORRECTION -> INDEPENDENT REVIEW -> GO -> IMPLEMENTATION`

**No GO has been granted.**