# AGY TASK — BAREA-002A Final TypeScript Review Corrections

This is the final corrective pass for BAREA-002A on `barea-ts-migration` / PR #3.

Do NOT start BAREA-003. Do NOT merge PR #3. Do NOT add UI, HTTP APIs, auth, WebSockets, realtime, quiz authoring, AI/LLM, ORM, database replacement, or unrelated refactors.

## REQUIRED FIXES

### 1. Remove unnecessary `any`

Make the TypeScript migration genuinely type-safe.

Remove unnecessary `any` from:
- `src/domain/question.ts`
- `src/persistence/sqlite-question-repository.ts`
- the rest of `src/` where introduced by this migration

In particular eliminate patterns such as `data: any`, `type: any`, `payload: any`, `updatesObj: any`, and `as any`.

Use the existing domain types/interfaces plus `unknown` and explicit narrowing where required. Keep the solution simple; do not add elaborate generic abstractions.

Do not weaken validation or change BAREA-002 behavior.

### 2. Prove the CommonJS runtime contract

Preserve the existing CommonJS package contract:
- `package.json` must not add `"type": "module"`;
- runtime entry remains `dist/index.js`;
- compiled output must be loadable with CommonJS `require()`.

Add an automated regression test that actually loads `dist/index.js` with CommonJS `require()` and verifies the expected public exports/runtime constructors are available.

The check must run as part of the repository validation flow; do not merely report a manual check.

Do not convert BAREA to ESM.

### 3. Remove encoding artifacts

Remove unnecessary UTF-8 BOM characters from migrated/configuration/documentation files.

Final files must be normal UTF-8 without BOM unless specifically required by the repository.

### 4. Preserve BAREA-002 invariants

Do not change:
- default DRAFT creation;
- rejection of direct APPROVED creation;
- DRAFT -> PENDING_REVIEW -> APPROVED;
- invalid lifecycle transition rejection;
- APPROVED content edits demoting to PENDING_REVIEW;
- ARCHIVED soft-delete and ARCHIVED -> DRAFT restore;
- approved-only retrieval;
- search/filtering;
- organization isolation;
- MULTIPLE_CHOICE / TRUE_FALSE / MULTI_SELECT;
- duplicate MULTI_SELECT correct-index rejection;
- Easy / Medium / Hard difficulty;
- file-backed SQLite durability across close/reopen;
- parameterized SQL;
- `node:sqlite` / `DatabaseSync`;
- public exports.

Do not redesign domain or persistence architecture.

## VALIDATION

Actually run:

1. clean dependency installation using the repository package manager;
2. `npm run typecheck`;
3. `npm run build`;
4. `npm test`;
5. the CommonJS `require('./dist/index.js')` regression test;
6. verify no migrated `.js` source/test files remain;
7. verify `dist/` is generated and ignored;
8. verify zero BOM artifacts in the repository files touched by this migration.

Do not claim results that were not executed.

## REPORT

Update `AGY-REPORT.md` with:
- baseline commit;
- final commit SHA;
- Node/npm/TypeScript versions;
- exact files changed;
- type-safety changes and confirmation of zero unnecessary `any` in `src/`;
- CommonJS regression test and result;
- encoding/BOM cleanup result;
- typecheck result;
- build result;
- exact test result/count;
- confirmation of preserved BAREA-002 invariants;
- confirmation that no BAREA-003+ implementation was added;
- final working-tree status.

Do not fabricate any SHA/result.

## GIT / PR

Stay on `barea-ts-migration`.
Use a focused Conventional Commit.
Push the corrective changes to PR #3.
Leave PR #3 OPEN and UNMERGED.

STOP after completion. The next step is independent review of PR #3.
