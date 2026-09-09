# AGY — BAREA-005 PR #7 — REMEDIATION PASS

## STATUS

**PR #7 IS NOT AUTHORIZED TO MERGE.**

Independent review of commit `38745a2` found concrete verification/code-quality discrepancies. This is a **targeted remediation pass on PR #7**.

Do not start BAREA-006 or BAREA-007.

## 1. MANDATORY SUB-AGENT REVIEW FIRST

Before changing code, MUST use available specialized sub-agents to independently challenge these findings.

Required roles:

1. **Security Architect / Red Team**
   - inspect all new server actions;
   - tenant isolation;
   - runtime allowlisting;
   - snapshot immutability;
   - answer secrecy;
   - attempt bypasses not covered by current tests.

2. **SQLite / Persistence Architect**
   - inspect `sqlite-quiz-repository.ts`;
   - transaction boundaries;
   - foreign keys and triggers;
   - TOCTOU behavior;
   - production-vs-test repository wiring;
   - database integrity.

3. **QA / Test Architect**
   - independently count and classify the actual tests;
   - verify that claimed test counts correspond to real execution;
   - identify weak test doubles, dead setup, and coverage gaps;
   - verify all adversarial cases against production code paths.

4. **TypeScript / Code Quality Specialist**
   - search all changed `src/` files for `any` and unsafe casts;
   - compare quality claims in AGY-REPORT/PR body with actual source;
   - identify type-safety regressions.

5. **Independent Implementation Reviewer**
   - compare implementation against `docs/BAREA-005-DESIGN-GATE.md` and existing BAREA architecture;
   - look for scope drift and semantic mismatches.

Record only actual sub-agent participation and findings. Never fabricate agent IDs, transcripts, or conclusions. If a specialist is unavailable, state that and perform the review yourself.

## 2. REQUIRED REMEDIATIONS

### A — REMOVE THE FALSE `any` CLAIM AND FIX PRODUCTION `any`

The current `src/persistence/sqlite-quiz-repository.ts` publication path contains an `as any` cast when reading a Question row.

Remove that unsafe `any` from production `src/` code. Replace it with an explicit typed row interface or another type-safe narrowing mechanism.

Then search the entire changed `src/` tree and verify the actual result.

Do not claim `0 occurrences of any` unless the repository search genuinely proves it.

### B — FIX THE TEST REPOSITORY WIRING

`test/quiz-authoring.test.ts` currently creates `SqliteQuestionRepository(':memory:')` but does not use it, then constructs a handwritten `customQRepo` containing numerous `any` annotations and simplified behavior.

This is not acceptable as the primary security/integration test path.

Prefer using the real `SqliteQuestionRepository` against the same `DatabaseSync` instance used by `SqliteQuizRepository`, with the actual production `QuestionBankService`.

If the production repository architecture cannot currently share a database connection, make the minimum justified repository change needed to support proper shared test wiring. Do not weaken production behavior merely for tests.

Do not use `any` in the test double as a shortcut. If a test double is genuinely required, define a fully typed `QuestionRepository` implementation with no `any` and explain why it is necessary.

Remove dead/unused test setup such as an instantiated repository that is never used.

### C — VERIFY TEST COUNT HONESTLY

The PR claims:

`115 passing tests (82 baseline + 33 BAREA-005)`

and the test source groups many cases into nested test blocks.

Run the exact canonical command:

`npm test`

Capture the actual final Node test summary, including tests/pass/fail/skipped if available.

Reconcile the reported count with actual execution. Do not manufacture a 115/33 figure.

If Node reports a different count because nested tests are counted differently, report the exact real count and explain the accounting.

### D — VERIFY ALL SECURITY TESTS AGAINST PRODUCTION PATHS

After fixing repository wiring, ensure the following are genuinely exercised through production services/repositories/actions wherever applicable:

- cross-tenant read/edit/attach/publish;
- protected field injection;
- unapproved/archived question rejection;
- TOCTOU demotion/archive/corruption;
- published quiz mutation rejection;
- snapshot update/delete triggers;
- published quiz physical-delete protection;
- participant answer projection;
- deterministic rollback;
- timer bounds;
- scoring boundaries;
- lifecycle transitions;
- reorder integrity.

Do not count a test as meaningful coverage merely because an equivalent assertion exists against a custom mock that does not implement production semantics.

### E — CHECK PUBLICATION ANSWER SECRECY

Inspect the server actions carefully.

`publishQuizAction()` currently returns a full `PublishedQuizSnapshot`, which contains `correctOptionIndices`.

The BAREA-005 design permits teacher-side access to the snapshot, while participant active-game secrecy belongs to the future live-session boundary. Confirm that no current participant route/action exists that exposes this snapshot.

If no participant route exists in BAREA-005, document that clearly rather than pretending the projection test alone proves end-to-end participant secrecy.

Do not implement BAREA-006/007 participant APIs here.

### F — CONCURRENCY SPECIFICATION ALIGNMENT

Preserve the approved `BEGIN IMMEDIATE` publication transaction and TOCTOU revalidation.

However, do not make false claims that all Question Bank operations universally use `BEGIN IMMEDIATE` if they do not.

Document the actual SQLite behavior and the exact publication transaction boundary.

### G — PRESERVE DESIGN-GATE INVARIANTS

Do not regress any approved Finding A-G remediation:

- SQLite snapshot UPDATE/DELETE triggers;
- published-quiz physical deletion protection;
- normalized `quiz_questions` schema;
- exact scoring semantics;
- formal ARCHIVED lifecycle;
- snapshot answer-secrecy boundary;
- deterministic publication transaction/TOCTOU handling;
- deterministic rollback injection.

## 3. REQUIRED VERIFICATION

After remediation, run all of the following and record real results:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `npm run build:next`
5. `git diff --check`
6. source search proving whether `any` remains in changed `src/`
7. test/source inspection confirming the real Question repository is exercised

If any command fails, fix it before declaring completion.

## 4. SUB-AGENT SECOND PASS

After remediation and before updating the PR report, use the sub-agents again for a focused verification pass:

- Security Red Team: try to bypass tenant isolation, publication approval, snapshot immutability, and answer secrecy.
- SQLite Architect: inspect transaction/trigger/foreign-key correctness.
- QA Architect: verify every adversarial test actually executes and uses the intended production path.
- TypeScript Specialist: verify no unsafe `any` remains in changed production code.
- Independent Reviewer: compare final implementation against the design gate.

Record actual findings only.

## 5. UPDATE DOCUMENTATION

Update:

- `AGY-REPORT.md`
- `docs/ROADMAP.md` if needed

The report must contain:

- exact remediation changes;
- actual sub-agent roles and findings;
- exact commands run and real results;
- actual test count;
- exact source `any` audit result;
- confirmation that production repository wiring is exercised;
- confirmation that no BAREA-006/007 work was added.

Do not claim GO merely because tests pass. The report must accurately describe what was verified.

## 6. PR REQUIREMENT

Keep work on **PR #7** unless a clean new PR is technically necessary.

Push the remediation commit(s) to `barea-005-quiz-authoring`.

Do not merge PR #7.

Do not create a new milestone.

## 7. STOP CONDITION

When remediation, sub-agent review, and verification are complete:

**STOP and await independent review.**

Do not merge PR #7 yourself.

Do not start BAREA-006 or BAREA-007.

Final sequence:

`PR #7 REVIEW → SUB-AGENT CHALLENGE → REMEDIATION → SUB-AGENT VERIFICATION → TEST/VERIFY → INDEPENDENT REVIEW → MERGE AUTHORIZATION`
