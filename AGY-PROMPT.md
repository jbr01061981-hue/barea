# AGY Prompt — BAREA-002 Corrective Fix

## Mission
Continue the existing **BAREA-002 Question Bank** corrective cycle on branch `barea-002-question-bank` / PR #2.

**Do not merge. Do not create a new PR. Do not start BAREA-003 or add AI, UI, live quiz, auth, QR, realtime, scoring, analytics, or other later-milestone work.**

## Required Fix — Approval Gate
The current implementation has a lifecycle bypass:

`SqliteQuestionRepository.create()` can accept `status: APPROVED` and persist an approved question directly.

This violates the required human-review gate. A question must **never be created directly as APPROVED**.

### Implement
1. Make normal question creation always start as `DRAFT`, regardless of a supplied status; OR reject an explicit `status: APPROVED`. Prefer rejecting an explicit APPROVED status if that keeps the API clearer.
2. Ensure there is no alternate create path that can persist APPROVED without the required lifecycle transition.
3. Add regression tests proving:
   - normal creation produces DRAFT;
   - direct creation with `status: APPROVED` is rejected (if using the preferred approach);
   - APPROVED can still only be reached through the existing review lifecycle.
4. Update existing tests/fixtures that currently create questions directly with `status: APPROVED` so they first create as DRAFT and transition through the legitimate lifecycle.

## Preserve
Do not regress the already-correct BAREA-002 behavior:
- lifecycle and approval safety;
- APPROVED content edits demote to PENDING_REVIEW;
- explicit archiving;
- duplicate MULTI_SELECT index rejection;
- durable SQLite persistence across close/reopen;
- organization/tenant isolation;
- CRUD, retrieval, list/filter/search;
- parameterized SQL;
- existing question types and difficulty;
- automated tests.

Do not redesign the architecture merely to fix this defect.

## Optional Cleanup
`ApprovedQuestionModificationError` appears to be exported but unused. Remove it only if this can be done cleanly without changing behavior. This is not required for acceptance.

## Verification
Run the complete test suite:

`npm test`

Confirm the working tree and branch state. Keep PR #2 open and unmerged.

## Git
Make **one focused Conventional Commit** for this corrective change, e.g.:

`fix: prevent direct approval on question creation`

Push the existing branch. Do not modify `main`.

## AGY REPORT — IMPORTANT
Do **not** ask the user to copy/paste your result into ChatGPT.

At the end of the task, create or update **`AGY-REPORT.md` in the repository** with a concise report containing:

- task completed;
- exact commit SHA;
- files changed;
- lifecycle/approval behavior fixed;
- tests added/updated;
- exact `npm test` result;
- `git status` / branch state;
- PR #2 state;
- confirmation that no BAREA-003+ work was performed.

Commit and push `AGY-REPORT.md` as part of the same focused corrective commit if possible.

The report file is the handoff to BAREA/ChatGPT. **Do not put the report only in the terminal response.**

## Acceptance Criteria
BAREA-002 is ready for independent review only when:
- direct APPROVED creation is impossible;
- approval requires the legitimate lifecycle transition;
- regression coverage proves the invariant;
- all tests pass;
- the report is committed to `AGY-REPORT.md`;
- PR #2 remains open and unmerged;
- no later-milestone work was introduced.
