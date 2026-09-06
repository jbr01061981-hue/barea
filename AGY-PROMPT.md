# AGY-PROMPT — BAREA-002 Final Corrective Fix

Task: fix the remaining approval-gate defect in PR #2.

Read this file and execute exactly. Do not start BAREA-003 or implement any later milestone.

## Blocking defect

`SqliteQuestionRepository.create()` currently permits a caller to create a question directly with `status: APPROVED`, bypassing:

`DRAFT -> PENDING_REVIEW -> APPROVED`

This must be impossible.

## Required fix

Normal question creation must never produce `APPROVED` content directly.

Preferred behavior:
- New questions are created as `DRAFT`.
- Explicit `status: APPROVED` on create is rejected with the project's normal domain-validation error.
- No bypass flag or privileged creation path.
- Legitimate approval remains `DRAFT -> PENDING_REVIEW -> APPROVED`.

## Tests

Add a service/public-path regression test proving direct APPROVED creation is rejected.

Ensure normal creation produces `DRAFT`.

Update existing fixtures that currently create questions directly as APPROVED. Where an approved state is required, create as DRAFT and transition through PENDING_REVIEW -> APPROVED.

Run the complete test suite with:

`npm test`

All tests must pass.

## Preserve

Do not regress:
- Easy / Medium / Hard question-level difficulty
- MULTIPLE_CHOICE / TRUE_FALSE / MULTI_SELECT
- lifecycle rules
- approved-edit demotion to PENDING_REVIEW
- archive/soft-delete behavior
- organization isolation
- SQLite persistence
- search/filtering
- approved-only retrieval

## Scope

Do not implement AI, LLM integration, teacher review UI, quiz authoring, live quiz, participant joining, QR, projector, scoring, leaderboard, analytics, or unrelated architecture changes.

If `ApprovedQuestionModificationError` is unused, remove the unused class/import/export rather than adding behavior around it.

## Git

Stay on `barea-002-question-bank` and update existing PR #2. Make a focused corrective commit, push it, and do not merge.

## AGY-REPORT.md

At completion, create or update `AGY-REPORT.md` in the repository with:

- task completed
- exact commit SHA
- files changed
- direct-APPROVED creation behavior
- tests added/updated
- exact `npm test` result
- final `git status`
- confirmation PR #2 remains OPEN and unmerged
- confirmation no BAREA-003+ functionality was added

Do not rely on terminal output alone; write the complete report into `AGY-REPORT.md` and commit it.

Stop after completing this task.