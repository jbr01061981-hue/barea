# AGY — BAREA-004 FINAL MICRO SECURITY CORRECTION

## STATUS

PR #6 (`barea-004-teacher-review`) is OPEN.

This is the **final small security correction** after independent BAREA review. The IDOR/tenant authorization boundary is already fixed. Do NOT redesign BAREA-004.

**DO NOT MERGE.**
**DO NOT START BAREA-005 OR ANY LATER MILESTONE.**

## SOURCE OF TRUTH

Read the current `main` versions of:

- `AGENTS.md`
- `docs/BAREA-004-DESIGN-GATE.md`
- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md`
- `docs/VERIFICATION-GATES.md`

Then inspect the current PR #6 head, `src/app/teacher/review/db.ts`, all Teacher Review server actions, and `AGY-REPORT.md`.

## REMAINING BLOCKER

The latest implementation added a development/test environment guard, but `isDevelopmentOrTestEnvironment()` currently treats an **unset `NODE_ENV`** as authorized development/test execution:

`env === 'development' || env === 'test' || !env`

It also permits a hard-coded development organization fallback (`church-berea-default`) when `BAREA_DEV_ORG_ID` is absent.

This means an ambiguous/unset runtime environment can silently receive a development teacher identity. That does not satisfy the required security invariant:

`no explicit trusted teacher context -> no Teacher Review access`

## REQUIRED FIX — MICRO SCOPE ONLY

Harden only the existing teacher-context resolution.

### 1. Remove implicit authorization for unset NODE_ENV

Do NOT treat an unset/unknown `NODE_ENV` as development.

Required behavior:

- `NODE_ENV=development` -> development context may be used, subject to valid configuration;
- `NODE_ENV=test` -> test execution may use the test fixture mechanism; normal development fallback must not become a production bypass;
- `NODE_ENV=production` -> fail closed without genuine production authentication;
- unset/unknown `NODE_ENV` -> fail closed unless there is an explicitly recognized test harness/context that is already trusted server-side.

Use the repository's existing environment conventions. Do not add a production authentication system.

### 2. Remove implicit organization fallback for development runtime

When the development context is being used, require an explicit valid `BAREA_DEV_ORG_ID` rather than silently substituting `church-berea-default`.

Trim and validate the configured organization ID. Missing, empty, whitespace-only, or invalid values must fail closed.

Do not weaken the existing `BAREA_DEV_USER_ID` / display-name behavior unless required by this correction.

### 3. Preserve the existing IDOR fix

Do NOT restore:

- browser-supplied `organizationId` action arguments;
- `?org=` as an authorization mechanism;
- hidden form fields/client state as authorization;
- any other browser-controlled tenant selector.

Every Teacher Review server action must continue deriving organization identity from trusted server-side context.

### 4. Preserve test isolation

`setAuthorizedTeacherContext()` remains a test fixture hook only.

It must remain unavailable in production and must not be reachable as a browser-controlled authorization mechanism.

Keep the implementation simple and compatible with the current tests.

## REQUIRED FOCUSED TESTS

Add/update tests proving all of the following:

1. `NODE_ENV=development` + explicit valid `BAREA_DEV_ORG_ID` returns the expected development context;
2. `NODE_ENV=development` + missing/empty/whitespace `BAREA_DEV_ORG_ID` fails closed;
3. `NODE_ENV=production` without genuine trusted teacher authentication fails closed;
4. **unset `NODE_ENV` without a trusted test override fails closed**;
5. unknown/non-standard `NODE_ENV` without trusted authentication fails closed;
6. browser/query organization input cannot activate or change the trusted context;
7. existing cross-tenant read/edit/approve/batch/archive/regenerate tests remain green;
8. existing BAREA-002 and BAREA-003 tests remain green.

The tests must exercise the actual server-side context/action boundary.

## SECURITY AUDIT

Specifically inspect for:

- `NODE_ENV` default/fallback behavior;
- `BAREA_DEV_ORG_ID` fallback behavior;
- hard-coded tenant IDs;
- query/form/client tenant inputs;
- test hooks crossing into runtime authorization;
- server-only context/credentials entering client bundles.

The final invariant must be:

`ordinary browser input cannot choose tenant + ambiguous runtime cannot silently activate development tenant identity.`

## VERIFICATION

Run and record actual results for:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run build:next`
- `git diff --check`
- dependency/security audit;
- BOM check;
- secret scan;
- `any` check in `src/`;
- client-bundle/server-only boundary check.

Re-run actual browser verification:

### L2

Verify the authorized development Teacher Review workflow still functions and that:

- `?org=foreign-org` has zero authorization effect;
- foreign question IDs cannot be accessed;
- no victim organization data is rendered.

### L3

Re-check the established desktop, tablet, and mobile BAREA-004 viewports and confirm the correction did not break the experience.

## MULTI-AGENT REVIEW

Use available specialized agents for this micro-correction:

1. Security/Backend — attack unset/unknown environment and organization fallback behavior.
2. Testing — verify the new fail-closed cases and existing cross-tenant suite.
3. Frontend/Next.js — confirm browser input cannot influence authorization.
4. Independent Review — attempt one final bypass after the fix.

Record actual participation and evidence in `AGY-REPORT.md`. Do not fabricate agent participation.

## REPORT

Update `AGY-REPORT.md` with:

- remaining blocker;
- exact micro-fix;
- explicit environment matrix and fail-closed behavior;
- test results;
- security audit results;
- actual sub-agent evidence;
- L2/L3 evidence;
- final status.

## STOP CONDITION

When complete:

- keep PR #6 OPEN;
- do not merge;
- do not close the PR;
- do not start BAREA-005;
- leave a clean working tree;
- stop for fresh independent BAREA review and final GO/NO-GO.
