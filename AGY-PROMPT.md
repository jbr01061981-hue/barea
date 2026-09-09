# AGY — BAREA-005 PR #7 — FINAL VERIFICATION & CONDITIONAL MERGE

## STATUS

PR #7 has completed the requested remediation pass and is now awaiting one final independent review.

**Do not assume the reported remediation is correct. Verify the actual GitHub head.**

Current expected PR:
- PR: `#7`
- Branch: `barea-005-quiz-authoring`
- Reported head: `b4516c2`
- Base: `main`

Do not start BAREA-006 or BAREA-007.

---

# 1. MANDATORY SUB-AGENT FINAL REVIEW

Before any merge decision, MUST use available specialized sub-agents for a fresh final challenge.

Use these independent roles:

1. **Security Red Team**
   - attempt tenant-isolation bypasses;
   - attempt approval/lifecycle bypasses;
   - attempt protected-field injection;
   - attempt snapshot mutation/deletion;
   - inspect answer-secrecy boundary;
   - inspect server-action/runtime validation.

2. **SQLite / Persistence Specialist**
   - inspect the real production repository wiring;
   - inspect schema constraints, triggers, foreign keys, transactions;
   - verify `BEGIN IMMEDIATE` publication semantics;
   - verify TOCTOU behavior;
   - verify rollback/failure injection.

3. **QA / Test Architect**
   - verify the real test count;
   - verify the 30 adversarial cases are genuinely executed;
   - verify tests use production repository/service paths rather than weak substitutes;
   - verify no dead/unused setup remains.

4. **TypeScript / Code Quality Specialist**
   - audit changed `src/` and relevant tests for `any`, unsafe casts, dead code, and false quality claims;
   - compare source with AGY-REPORT.

5. **Frontend / Next.js Specialist**
   - inspect teacher quiz routes and draft/published separation;
   - check server/client boundary;
   - check that published quiz views are read-only;
   - check for accidental participant/live-game scope creep.

6. **Independent Release Reviewer**
   - compare final implementation against `docs/BAREA-005-DESIGN-GATE.md`;
   - identify any remaining implementation/design divergence;
   - provide a final GO/NO-GO recommendation.

Record only actual sub-agent participation and findings. Never fabricate agent IDs, reviews, or results.

---

# 2. VERIFY THE ACTUAL PR HEAD

Fetch PR #7 and verify:

- current head SHA;
- changed-file list;
- mergeable status;
- PR state;
- actual diff.

Do not rely solely on the reported `b4516c2`. If the head moved, use the actual current head.

---

# 3. VERIFY THE REMEDIATIONS DIRECTLY IN CODE

### A. Production `any`

Confirm `src/persistence/sqlite-quiz-repository.ts` contains no `any`/`as any` in the final head.

Perform an actual source audit across changed production `src/` files.

Do not declare zero occurrences unless the search proves it.

### B. Test repository wiring

Confirm `test/quiz-authoring.test.ts`:

- no longer uses the handwritten `customQRepo` stub;
- no longer contains `any` casts as a shortcut;
- uses the real `SqliteQuestionRepository` and `QuestionBankService` against the intended shared `DatabaseSync` instance, or has a clearly justified typed alternative;
- contains no dead repository instantiation.

This is a release criterion, not merely a quality preference.

### C. Test accounting

Run/verify the real `npm test` result.

Reconcile:

- total number of executed tests;
- baseline tests;
- BAREA-005 tests;
- skipped/cancelled/failing tests.

Do not use informal grouping such as `ADV-QZ-01 to ADV-QZ-04 = one test` to inflate or obscure coverage.

Report the exact test runner count.

### D. Adversarial coverage

Verify all intended adversarial scenarios are actually backed by executable tests and production paths where applicable:

- cross-tenant read;
- cross-tenant update;
- cross-tenant attach;
- cross-tenant publish;
- unapproved question rejection;
- archive rejection;
- TOCTOU demotion/archive/corruption;
- protected-field injection;
- duplicate questions;
- ordering integrity;
- invalid timers;
- invalid scoring;
- published quiz mutation protection;
- snapshot independence;
- raw snapshot UPDATE/DELETE triggers;
- published quiz DELETE protection;
- participant projection secrecy;
- atomic rollback;
- lifecycle archive/restore semantics;
- scoring math boundaries.

### E. Security boundaries

Verify `getAuthorizedTeacherContext()` remains the sole tenant/teacher authority for current teacher actions.

Verify client input cannot override:

- `organizationId`;
- ownership;
- `id`;
- lifecycle status;
- snapshot data;
- protected timestamps/metadata.

### F. Snapshot integrity

Verify the snapshot implementation remains:

- self-contained;
- database-protected from UPDATE/DELETE;
- protected from physical deletion of the associated published quiz;
- independent from later Question Bank modifications.

### G. Publication/TOCTOU

Verify publication actually:

- starts the appropriate SQLite write transaction;
- verifies Quiz ownership/status;
- reads membership;
- re-reads every Question;
- checks organization ownership;
- checks `APPROVED` state;
- builds the snapshot;
- inserts snapshot;
- transitions Quiz to `PUBLISHED`;
- commits atomically;
- rolls back completely on injected failure.

### H. Scoring

Verify the final code matches the design exactly:

- STANDARD = 100/0;
- SPEED_WEIGHTED = exact 50..100 formula;
- correct timestamp boundary handling;
- expired answers = 0.

### I. Lifecycle

Verify the actual implementation matches the approved semantics for:

- `DRAFT -> PUBLISHED`;
- `DRAFT -> ARCHIVED`;
- draft archive restore;
- `PUBLISHED -> ARCHIVED`;
- published archived quiz cannot return to draft;
- snapshot retained.

### J. Frontend

Inspect the actual routes/components for:

- `/teacher/quizzes`;
- `/teacher/quizzes/[id]`;
- draft editor;
- published/archived read-only inspector.

Verify no participant/live-game functionality was accidentally added.

---

# 4. RUN THE FULL VERIFICATION GATE

Run these exact commands on the final PR head:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git diff --check
```

Also perform:

```text
source audit for `any` / `as any`
```

and inspect the final test source to prove the intended production repository wiring.

Record exact real outputs/results.

---

# 5. CHECK FOR NEW SECURITY ISSUES FROM REMEDIATION

Do not limit the review to the two originally reported defects.

Specifically challenge whether the shared `DatabaseSync` support introduced any lifecycle/ownership bug.

Check:

- who owns/closes the shared DB connection;
- whether `SqliteQuestionRepository.close()` can accidentally close a DB still used by `SqliteQuizRepository`;
- whether repository `transaction()` methods can nest incorrectly;
- whether test-only failure injection can activate outside `NODE_ENV=test`;
- whether new typed row interfaces correctly validate runtime SQLite data.

---

# 6. DOCUMENTATION

Update `AGY-REPORT.md` only after the final verification is complete.

The report must state:

- actual final PR head SHA;
- actual mergeability/state;
- exact test count;
- exact build/typecheck results;
- exact `any` audit result;
- actual sub-agent participation and findings;
- any remaining non-blocking observations;
- final recommendation.

Do not claim GO merely because sub-agents say GO. The report must reflect the actual repository evidence.

Update `docs/ROADMAP.md` to `BAREA-005 = COMPLETED — PENDING MERGE` while PR #7 remains open.

Do not mark BAREA-005 fully completed until merge occurs.

---

# 7. MERGE AUTHORIZATION RULE

Only if ALL of the following are true:

- no HIGH or CRITICAL security finding remains;
- no unresolved authorization/lifecycle bypass remains;
- production `src/` contains no unsafe `any`/`as any` introduced by this PR;
- test suite passes with an honestly reported count;
- adversarial tests exercise the real production repository/services;
- typecheck passes;
- CommonJS build passes;
- Next.js production build passes;
- diff check passes;
- sub-agent final review finds no blocker;
- implementation matches the approved BAREA-005 design gate;
- no BAREA-006/007 scope creep exists.

Then **AND ONLY THEN**:

1. record the final GO decision in `AGY-REPORT.md`;
2. merge PR #7 into `main` using the repository's standard merge strategy;
3. record the merge commit SHA;
4. synchronize local `main`;
5. clean only obsolete local build/test artifacts without deleting tracked project files;
6. verify `git status` is clean;
7. update `docs/ROADMAP.md` to `BAREA-005 = COMPLETED — MERGED`.

If any merge condition fails:

**DO NOT MERGE.**

Create a focused remediation commit on PR #7 and repeat the verification cycle.

---

# 8. FINAL RESPONSE REQUIRED

Return:

1. sub-agent review summary;
2. actual PR head SHA;
3. exact test count/results;
4. typecheck/build results;
5. source `any` audit;
6. production repository wiring verdict;
7. security verdict;
8. final GO/NO-GO;
9. if GO and merged: merge commit SHA and final clean repository state;
10. if NO-GO: exact blockers and next remediation.

## FINAL RULE

**Do not merge based on AGY's previous report. Verify first.**

`FINAL SUB-AGENT CHALLENGE -> INDEPENDENT VERIFICATION -> GO/NO-GO -> CONDITIONAL MERGE`
