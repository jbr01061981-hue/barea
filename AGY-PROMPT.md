# AGY TASK — BAREA-002A Final TypeScript Review Corrections

## IMPORTANT

This is a **final corrective pass for BAREA-002A** on the existing `barea-ts-migration` branch and PR #3.

Do **NOT** start BAREA-003.
Do **NOT** implement AI/LLM functionality.
Do **NOT** add UI, HTTP APIs, authentication, WebSockets, real-time transport, quiz authoring, or other future-milestone functionality.
Do **NOT** merge PR #3.

The independent review identified three blocking issues that must be corrected before BAREA-002A can be approved.

## 1. REMOVE UNNECESSARY `any`

Strengthen the TypeScript migration so it is genuinely type-safe.

Remove unnecessary `any` usages, especially from:

- `src/domain/question.ts`
- `src/persistence/sqlite-question-repository.ts`

In particular, eliminate patterns such as:

- `data: any`
- `type: any`
- `payload: any`
- `updatesObj: any`
- `as any`

Use the existing domain interfaces/types and `unknown` with explicit narrowing where necessary.

Do not introduce elaborate generic abstractions. Keep the types straightforward and maintainable.

Do not weaken domain validation or change BAREA-002 behavior.

## 2. PROVE THE COMMONJS RUNTIME CONTRACT

The migration must preserve the existing CommonJS runtime/package contract.

Keep:

- no `"type": "module"` in `package.json`;
- compiled runtime under `dist/`;
- `main: dist/index.js`.

Add an automated regression check that actually loads the compiled package through CommonJS, equivalent to:

`require('./dist/index.js')`

The regression test must verify that the expected public BAREA exports are available.

Do not merely report that this was checked manually. Make the compatibility check reproducible by the test suite or an explicitly invoked automated check.

Do NOT convert BAREA to ESM.

## 3. REMOVE ENCODING ARTIFACTS

Remove unnecessary UTF-8 BOM characters from migrated/configuration files.

Files should be normal UTF-8 without BOM unless there is a specific repository requirement otherwise.

Check the migrated TypeScript/configuration files and remove BOM artifacts wherever present.

## 4. PRESERVE APPROVED BAREA-002 BEHAVIOR

Do not change the already-approved Question Bank behavior.

The following invariants must remain intact:

- default DRAFT creation;
- direct APPROVED creation rejection;
- DRAFT -> PENDING_REVIEW -> APPROVED;
- invalid lifecycle transition rejection;
- APPROVED content-edit demotion to PENDING_REVIEW;
- ARCHIVED soft-delete;
- ARCHIVED -> DRAFT restore;
- approved-only retrieval;
- search/filtering;
- organization isolation;
- MULTIPLE_CHOICE;
- TRUE_FALSE;
- MULTI_SELECT;
- duplicate correct-index rejection;
- Easy/Medium/Hard difficulty;
- durable SQLite persistence across close/reopen;
- parameterized SQL;
- `node:sqlite` / `DatabaseSync`;
- public exports.

Do not redesign the domain or persistence layer.

## 5. SCOPE BOUNDARY

Absolutely NO:

- BAREA-003 implementation;
- AI/LLM integration;
- prompt-generation pipeline;
- AI schemas;
- UI/frontend;
- HTTP API;
- authentication;
- WebSockets;
- real-time quiz functionality;
- quiz authoring;
- ORM;
- database replacement;
- unrelated refactoring.

## 6. VALIDATION

Actually run all of the following after the corrections:

1. clean dependency installation using the repository package manager;
2. `npm run typecheck`;
3. `npm run build`;
4. `npm test`;
5. the CommonJS `require()` compatibility regression check;
6. verify no migrated `.js` source/test files remain;
7. verify `dist/` is generated and ignored.

Do not claim a result unless the command was actually executed.

## 7. REPORT

Update `AGY-REPORT.md` with the final corrective-pass results, including:

- baseline commit;
- final commit SHA;
- Node version;
- npm version;
- TypeScript version;
- exact files changed;
- `any` removals/type-safety changes;
- CommonJS compatibility test and result;
- encoding cleanup;
- typecheck result;
- build result;
- exact test count/result;
- confirmation of all BAREA-002 invariants;
- confirmation that no BAREA-003 functionality was added;
- final working-tree status.

Do not fabricate any result or SHA.

## 8. GIT / PR

Stay on:

`barea-ts-migration`

Use a focused Conventional Commit.

Push the changes to PR #3.

PR #3 must remain **OPEN and UNMERGED**.

Do NOT merge.

Do NOT begin BAREA-003.

## 9. STOP CONDITION

When the corrective work is complete, validated, committed, pushed, and documented:

**STOP.**

The next action is independent review of PR #3.