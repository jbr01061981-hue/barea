# AGY TASK — Merge Approved BAREA-002A and Clean Up

## STATUS

BAREA-002A has completed independent review and is **APPROVED FOR MERGE**.

Repository: `jbr01061981-hue/barea`
PR: `#3`
Branch: `barea-ts-migration`
Approved head: `327824f186f1b6ca80abebd2734f7cf7dd1225a9`

Do NOT start BAREA-003 during this task.

## 1. VERIFY BEFORE MERGE

1. Confirm PR #3 is OPEN and UNMERGED.
2. Confirm the PR head contains the approved BAREA-002A TypeScript migration.
3. Do not merge if the PR head has changed unexpectedly from the approved implementation. If it has changed, STOP and report the difference.

## 2. MERGE

Merge PR #3 into `main` using the repository's normal GitHub merge workflow.

Do not add unrelated changes during the merge.

## 3. SYNCHRONIZE LOCAL MAIN

After the merge:

1. Switch to `main`.
2. Fetch from `origin`.
3. Pull the merged `origin/main`.
4. Confirm local `main` is synchronized with `origin/main`.

## 4. CLEAN UP THE MIGRATION BRANCH

After confirming the merge succeeded:

1. Delete local branch `barea-ts-migration`.
2. Delete remote branch `origin/barea-ts-migration`.
3. Prune stale remote references.

Do not delete `main` or any other branch.

## 5. POST-MERGE VALIDATION

On the merged `main`, actually run:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npm test`

Record the exact results.

Also verify:

- TypeScript is now the application language.
- No migrated BAREA-002 `.js` source/test files have returned.
- `dist/` remains ignored.
- The approved BAREA-002 Question Bank behavior remains intact.
- No BAREA-003+ functionality exists.
- No AI/LLM, UI, HTTP API, authentication, WebSocket, realtime quiz, or quiz-authoring implementation was added.

## 6. ROADMAP

Update `docs/ROADMAP.md` on `main` so the milestone status accurately reflects:

- `BAREA-001` = COMPLETED
- `BAREA-002` = COMPLETED
- `BAREA-002A` = COMPLETED
- `BAREA-003` = NOT STARTED

Do not mark BAREA-003 active or completed.

## 7. AGY-REPORT.md

Update `AGY-REPORT.md` with the post-merge cleanup report, including:

- PR #3 merge status;
- merge commit SHA;
- resulting `main` commit;
- branch deletion results;
- validation commands and exact results;
- roadmap update;
- final working-tree status;
- confirmation that BAREA-003 remains NOT STARTED.

Do not fabricate any SHA or result.

## 8. STRICT SCOPE

This task is ONLY:

**Merge approved BAREA-002A → synchronize main → clean obsolete migration branch → validate → update roadmap/report → stop.**

Do NOT:

- start BAREA-003;
- implement AI/LLM;
- add UI/frontend;
- add HTTP APIs;
- add authentication;
- add WebSockets/realtime transport;
- add quiz authoring;
- redesign architecture;
- perform unrelated refactoring.

## STOP CONDITION

When PR #3 is merged, local `main` is synchronized with `origin/main`, the obsolete migration branch is removed, validation passes, `docs/ROADMAP.md` is updated, `AGY-REPORT.md` is updated, and the working tree is clean:

**STOP.**

Do not begin BAREA-003.