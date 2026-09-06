# AGY TASK — BAREA-002A TypeScript Migration Gate

## IMPORTANT

This is a **pre-BAREA-003 migration task**.

Do **NOT** start BAREA-003.
Do **NOT** implement AI/LLM functionality.
Do **NOT** add UI, HTTP APIs, authentication, WebSockets, real-time transport, quiz authoring, or other future-milestone functionality.
Do **NOT** merge the PR.

The purpose of this task is to migrate the already-approved BAREA-002 implementation from JavaScript to TypeScript while preserving its behavior and contracts.

## 1. SOURCE OF TRUTH

Before changing anything:

1. Read `AGENTS.md`.
2. Read `docs/ROADMAP.md`.
3. Read `docs/DECISIONS.md`.
4. Inspect the current `main` baseline and the existing BAREA-002 implementation.
5. Treat the current repository as the implementation source of truth. Do not copy code from the legacy `project-berea` repository.

BAREA-002 is already completed and merged. BAREA-002A is the only active task.

## 2. OBJECTIVE

Establish TypeScript as the BAREA application language and migrate the current BAREA-002 implementation to TypeScript before any BAREA-003 implementation begins.

The migration must be behavior-preserving. The existing Question Bank functionality and approval-gate invariants must remain intact.

## 3. REQUIRED SCOPE

### A. TypeScript tooling

Add the minimum reproducible tooling required for a clean TypeScript project:

- `typescript` as a development dependency.
- `@types/node` at a version compatible with the Node.js runtime used by this repository, including typings needed by `node:sqlite`.
- A root `tsconfig.json` with strict type checking enabled.
- Keep the runtime model simple and CommonJS-compatible unless a concrete compatibility issue requires a documented change.
- Compile source from `src/` to `dist/`.
- Keep generated `dist/` output out of source control unless the repository's existing policy requires otherwise.
- Update `package.json` scripts so a clean install can type-check/build and run the full test suite reproducibly.

Do not introduce a frontend framework, backend framework, ORM, test framework, bundler, or runtime replacement.

### B. Migrate application source

Migrate the existing BAREA-002 source files from `.js` to `.ts`, including at minimum:

- `src/domain/question.js` -> TypeScript
- `src/persistence/sqlite-question-repository.js` -> TypeScript
- `src/service/question-bank-service.js` -> TypeScript
- `src/index.js` -> TypeScript

Use explicit, maintainable types for:

- Question difficulty
- Question type
- Question status
- Question entity
- Question creation/update payloads
- Question filters
- Lifecycle transition contracts
- Repository interface/contract
- Question Bank service dependencies and public methods
- Domain errors
- SQLite row mapping where useful

Prefer straightforward types over elaborate generic abstractions.

### C. Migrate tests

Migrate the BAREA-002 test suite to TypeScript while retaining the same behavioral coverage.

The test suite must continue to verify at least:

- valid MULTIPLE_CHOICE questions;
- valid TRUE_FALSE questions;
- valid MULTI_SELECT questions;
- required-field/domain validation;
- duplicate MULTI_SELECT correct-index rejection;
- DRAFT -> PENDING_REVIEW -> APPROVED lifecycle;
- invalid lifecycle transitions;
- direct APPROVED creation rejection;
- approved-content modification demotion to PENDING_REVIEW;
- explicit archiving/restore behavior;
- approved-only retrieval;
- filtering/search;
- strict organization isolation;
- file-backed persistence across repository close/reopen;
- public exports.

Do not weaken tests merely to make TypeScript compilation easier.

## 4. BEHAVIORAL INVARIANTS — MUST NOT CHANGE

The migration must preserve these approved BAREA-002 rules:

1. New questions default to `DRAFT`.
2. Questions cannot be created directly as `APPROVED`.
3. `APPROVED` can only be reached through the legitimate review lifecycle.
4. Editing content on an `APPROVED` question demotes it to `PENDING_REVIEW` unless an explicitly valid lifecycle operation such as archiving is requested.
5. Archived questions are soft-deleted and can return to `DRAFT`, not directly to `APPROVED`.
6. Organization isolation is mandatory for repository operations.
7. Approved-only retrieval must return only `APPROVED` questions.
8. Question-level difficulty remains `Easy`, `Medium`, or `Hard`.
9. Supported question types remain `MULTIPLE_CHOICE`, `TRUE_FALSE`, and `MULTI_SELECT`.
10. Parameterized SQL and the existing SQLite persistence approach remain intact.
11. No AI-generated question may bypass the future human review gate.

Do not change these rules as part of the TypeScript migration.

## 5. NODE / SQLITE REQUIREMENT

Retain the existing Node.js built-in SQLite implementation using `node:sqlite` / `DatabaseSync` unless the installed Node/type-definition combination creates a genuine blocking compatibility problem.

If compatibility requires a change:

- stop and document the problem;
- do not silently replace SQLite with another database;
- do not introduce an ORM;
- record the architectural change in `docs/DECISIONS.md`.

The migration is not permission to redesign the persistence layer.

## 6. MODULE / BUILD CONTRACT

Keep the runtime behavior straightforward:

- TypeScript source under `src/`.
- Compiled JavaScript under `dist/`.
- Runtime entry point should resolve to the compiled application entry point.
- Tests must execute reliably from a clean checkout after installation and build.
- Do not require a global TypeScript installation.

Choose the simplest configuration that preserves the current CommonJS-style implementation and allows Node built-ins to type-check correctly.

## 7. CLEANUP

After migration:

- Remove the migrated `.js` source/test files so there is one authoritative implementation.
- Remove obsolete CommonJS-only patterns where TypeScript provides a clearer equivalent, but do not perform unrelated refactoring.
- Do not leave duplicate `.js` and `.ts` implementations under `src/`.
- Keep public exports stable unless TypeScript requires a clearly documented equivalent.

## 8. VALIDATION

Run all relevant checks and report exact results:

1. Clean dependency installation using the repository's package manager.
2. TypeScript compilation/type-check with strict mode.
3. Full automated test suite.
4. Verify there are no remaining BAREA-002 application/test `.js` sources that should have been migrated.
5. Verify `dist/` is generated correctly and is ignored if appropriate.
6. Verify the package scripts work from a clean checkout.

Do not claim success without actually running the commands.

## 9. DOCUMENTATION

Update documentation only for this migration:

- `docs/DECISIONS.md` must retain ADR-008 recording TypeScript as the accepted BAREA application language.
- `docs/ROADMAP.md` must accurately show BAREA-002A as the active milestone and BAREA-003 as NOT STARTED until this task is completed and reviewed.
- `AGENTS.md` must remain synchronized with the active milestone.

Do not mark BAREA-002A completed yourself unless the repository's established workflow explicitly requires the implementation agent to do so after successful validation. The user/reviewer will decide completion after independent review.

## 10. GIT / PR WORKFLOW

Use the existing branch:

`barea-ts-migration`

If it does not exist locally, create it from the current `main` baseline. Do not base the work on an old branch.

Use Conventional Commits.

Keep the changes focused on BAREA-002A.

Push the branch and open/update a PR against `main` titled approximately:

`chore: migrate BAREA application to TypeScript (BAREA-002A)`

Do **NOT** merge the PR.

Do **NOT** start BAREA-003.

## 11. AGY-REPORT.md

At the end, write the complete execution report to `AGY-REPORT.md` so the reviewer does not need terminal output pasted into chat.

The report must include:

- baseline commit inspected;
- final commit SHA;
- branch name;
- PR number and URL;
- files added/removed/changed;
- TypeScript/tooling decisions;
- module/build configuration;
- Node version used;
- package-manager/install result;
- type-check/build result;
- exact test result/count;
- confirmation that BAREA-002 behavioral invariants remain intact;
- confirmation that no BAREA-003 functionality was implemented;
- known limitations or follow-up concerns;
- working-tree status.

Do not fabricate any result or SHA.

## 12. STOP CONDITION

When the TypeScript migration is implemented, tested, documented, pushed, and the PR is open:

**STOP.**

Do not merge.
Do not begin BAREA-003.
Do not add AI generation.
Do not add UI.
Do not add APIs or real-time functionality.

The next action is independent review of BAREA-002A.
