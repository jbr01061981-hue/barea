# AGY PROMPT — BAREA-007 FINAL DEADLINE ATOMICITY REMEDIATION

Repository: `jbr01061981-hue/barea`
Target PR: #11
Branch: `barea-007-live-quiz`

## OBJECTIVE

Apply the remaining security/correctness remediation identified by the independent review of BAREA-007 PR #11.

Current SSE authorization, server-derived realtime role, canonical projection/replay filtering, current-question enforcement, and client-timestamp rejection are substantially implemented. **Do not undo or weaken those controls.**

The remaining blocker is **authoritative deadline atomicity at persistence**.

The service currently validates the persisted `answerDeadlineAt` before calling the repository, but the final persistence decision must itself be authoritative with respect to server time. A request can otherwise pass the service-level check immediately before the deadline and reach persistence after the deadline while still being accepted using an older captured `submittedAt`.

## REQUIRED REMEDIATION

### 1. Make deadline acceptance authoritative at the persistence boundary

Inspect:

- `src/service/live-quiz-service.ts`
- `src/persistence/sqlite-session-repository.ts`
- relevant live-quiz domain types/errors

The final answer acceptance decision MUST be made atomically with the database insertion.

Required invariant:

> An answer is persisted only if the authoritative server time used by the persistence transaction is at or before the persisted `answerDeadlineAt` for the authoritative current question.

Do not rely solely on an earlier service-level `Date.now()` check.

The persistence operation should, within the same transaction/atomic operation that establishes first-write-wins:

1. Read the authoritative live state/current question and persisted `answerDeadlineAt`.
2. Obtain fresh server time at the persistence decision point.
3. Verify the question is still the authoritative current answerable question.
4. Verify the deadline has not expired.
5. Verify the participant/group has not already submitted.
6. Insert the submission only when all required conditions pass.
7. Commit the transaction.

If the deadline has expired, fail with the existing `AnswerDeadlineExpiredError` (or the established equivalent) and create **zero persisted answer records**.

### 2. Do not use a caller-controlled or stale timestamp as the acceptance authority

The following MUST NOT determine deadline validity:

- `clientTimestamp`;
- a client-supplied `submittedAt`;
- a timestamp captured before the persistence transaction and then treated as the final authority;
- client clock time;
- question position supplied by the client without authoritative comparison.

The repository/persistence boundary must derive the authoritative acceptance timestamp itself.

If the existing API currently passes `submittedAt`, refactor it so that this value cannot override the fresh persistence-time decision. Prefer deriving `submittedAt` inside the repository transaction and returning that authoritative value to the service.

Likewise, `isWithinDeadline` should be derived from the authoritative persistence-time check rather than trusted as a caller/service assertion.

### 3. Preserve first-accepted-submission semantics under concurrency

The existing unique constraints and duplicate-submission protections must remain intact.

The implementation must handle concurrent submissions correctly:

- At most one valid submission for a participant/question.
- At most one valid submission for a group/question.
- A submission cannot win merely because its service-level pre-check happened before the deadline.
- A late transaction must fail even if an earlier pre-check succeeded.
- Do not replace database uniqueness with an in-memory lock.
- Do not weaken transactional guarantees.

Use SQLite's existing transactional/constraint mechanisms appropriately.

### 4. Apply the same rule to teacher-group submissions

`submitGroupAnswer` must receive the same persistence-level authoritative deadline treatment as `submitParticipantAnswer`.

A group answer must not be persisted after the authoritative deadline merely because the service checked the deadline earlier.

Preserve existing teacher-host authorization and group/session ownership checks.

### 5. Preserve the existing service-level checks

Do not remove useful early validation in `LiveQuizService`.

The service should continue to reject:

- inactive sessions;
- non-current question positions;
- non-ANSWERING lifecycle states;
- invalid choices;
- unauthorized participant tokens;
- unauthorized hosts/groups;
- already-submitted answers;
- expired deadlines.

However, these are defense-in-depth checks. The **database persistence boundary remains the final authoritative acceptance gate** for deadline-sensitive insertion.

### 6. Mandatory regression tests

Add/update deterministic tests proving:

#### Deadline correctness

1. Current-question answer before deadline is accepted.
2. Answer after authoritative deadline is rejected.
3. `clientTimestamp` cannot extend or bypass the deadline.
4. Non-current question is rejected.
5. Failed timing attempts create zero persisted submissions.
6. Group answer after deadline is rejected with zero persisted submissions.
7. Group answer before deadline is accepted.

#### Persistence-boundary/race regression — mandatory

Add a test that specifically proves the final persistence decision uses authoritative time rather than a stale service timestamp.

The test must model this boundary:

```text
service/pre-check: deadline still open
        ↓
logical delay / simulated passage of time
        ↓
persistence decision: deadline expired
        ↓
submission MUST NOT be inserted
```

Do not merely repeat the existing test that directly changes the database deadline before invoking the service. The new regression must exercise the distinction between an earlier service check and the later persistence decision.

A deterministic test hook/clock abstraction is acceptable if it is strictly test-only and cannot influence production authorization or timing. Do not use process arguments, client input, or environment tricks as production timing authority.

#### Concurrency/first-write-wins

8. Concurrent or simulated competing submissions still result in exactly one persisted answer.
9. Duplicate submission remains rejected.
10. No late submission can be persisted after the authoritative deadline.

### 7. Be careful with SQLite transaction design

Inspect the existing SQLite repository transaction implementation before changing it.

The desired behavior is conceptually:

```text
BEGIN IMMEDIATE / equivalent safe transaction
  read authoritative live state
  obtain authoritative current server time
  compare now <= answerDeadlineAt
  verify current question/lifecycle
  enforce uniqueness / duplicate protection
  insert submission with server-derived submittedAt
COMMIT
```

Use the repository's existing transaction conventions and SQLite APIs rather than introducing an unrelated persistence architecture.

Do not claim a transaction is atomic unless the actual SQLite implementation guarantees the required ordering.

### 8. Preserve all previously fixed security boundaries

Do NOT regress any of the following:

- server-derived SSE role;
- host authorization by authenticated `hostUserId`;
- participant session-token authorization;
- cross-session isolation;
- canonical `projectEventForRole()` filtering;
- role-aware replay/history filtering;
- removal of sensitive answer keys from participant/projector projections;
- authoritative current-question enforcement;
- clientTimestamp being non-authoritative;
- BAREA-006 tenant/admission boundaries;
- BAREA-006 trusted-IP/rate-limiting boundaries.

A participant must never receive:

- `correctOptionIndices`;
- `explanation`;
- `correctOptionIndex`;
- `correctAnswer`;
- equivalent answer-key information.

### 9. Scope restrictions

This is **BAREA-007 only**.

Do NOT:

- implement BAREA-008 UI;
- implement BAREA-009 scoring/leaderboards;
- implement BAREA-010/011/012/013;
- provision Cloudflare or deployment infrastructure;
- redesign BAREA-006 authentication/admission/tenant boundaries;
- introduce a new external authentication system;
- weaken or remove existing security checks.

### 10. Documentation

Update `AGY-REPORT.md` with a new section documenting:

- the deadline race/atomicity issue;
- why service-level validation alone was insufficient;
- the exact persistence/transaction remediation;
- participant and group behavior;
- race-boundary regression testing;
- verification results.

Do not rewrite, truncate, or remove historical report sections.

Update `docs/DECISIONS.md` only as necessary so the documented BAREA-007 timing invariant accurately states that final answer acceptance is authoritative at the persistence boundary.

Do not mark BAREA-007 fully completed merely because tests pass. It remains pending independent review until this remediation is reviewed and accepted.

## REQUIRED VERIFICATION

Run all applicable repository checks:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
```

Also run the focused BAREA-007 live-quiz suite, including the new persistence-boundary/race regression.

Report:

- exact commit SHA;
- files changed;
- test counts and results;
- authoritative deadline behavior;
- participant behavior;
- group behavior;
- persistence transaction behavior;
- concurrency/first-write-wins behavior;
- confirmation that no previous BAREA-007 security remediation was regressed;
- confirmation that no out-of-scope milestone was implemented.

## GIT RULES

- Work only on `barea-007-live-quiz`.
- Do not force-push.
- Do not rewrite history.
- Do not use `git reset --hard` while work exists.
- Commit with a descriptive message.
- Push to `origin/barea-007-live-quiz`.
- Keep PR #11 open.
- Stop after implementation and verification.
- Wait for independent review.
