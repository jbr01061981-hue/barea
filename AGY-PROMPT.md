# AGY — BAREA-004 FINAL SECURITY CORRECTION

## STATUS

PR #6 (`barea-004-teacher-review`) is OPEN.

This is a **small final security correction** after independent BAREA review. The original IDOR issue has been remediated. Do NOT redesign BAREA-004.

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

Then inspect the current PR #6 head and `AGY-REPORT.md`.

## REVIEW FINDING — REMAINING BLOCKER

The previous corrective pass successfully removed browser-controlled `organizationId` authority and removed `?org=` as an authorization selector.

However, `getAuthorizedTeacherContext()` currently returns `DEFAULT_DEV_TEACHER_CONTEXT` whenever no test override exists. That default uses `BAREA_DEV_ORG_ID || 'church-berea-default'` and is not explicitly restricted to development execution.

The implementation/report also describes this as failing closed, but the normal path currently falls back to a default teacher context rather than requiring an explicitly authorized development context.

This does not satisfy the required **development-only + fail-closed** boundary.

## REQUIRED FIX — KEEP IT SMALL

Harden the existing teacher-context mechanism only. Do not redesign the application.

### 1. Explicit development-only guard

The default development teacher context may be used **only in an explicitly recognized development/test execution mode**.

Use the existing Next.js/Node environment conventions already present in the repository. Do not invent a production authentication system.

Required behavior:

- explicit development/test mode + valid development organization configuration -> development teacher context is allowed;
- non-development/production mode without a genuine trusted teacher context -> FAIL CLOSED;
- missing/empty/invalid organization identity -> FAIL CLOSED;
- never silently substitute `'church-berea-default'` outside explicitly permitted development/test execution.

Do not make production secure by merely checking a browser-controlled value.

### 2. Test override isolation

The existing `setAuthorizedTeacherContext()` hook is for tests.

Ensure the test override cannot become a browser-controlled authorization mechanism or production bypass.

Keep test-only mechanisms clearly separated from runtime authorization.

### 3. Error semantics

Use a clear unauthorized error type/message where appropriate, consistent with the existing project conventions.

The important invariant is:

`no trusted teacher context -> no Teacher Review data access or mutation`

Do not leak another organization's existence through errors.

### 4. Preserve the already-fixed IDOR boundary

Do NOT restore `organizationId` to public Server Action inputs.

Do NOT restore `?org=` as an authority.

All Teacher Review actions must continue deriving organization identity from the trusted server context.

Question Bank organization isolation and lifecycle protections must remain unchanged.

## REQUIRED REGRESSION TESTS

Add focused tests for the remaining blocker:

1. explicitly permitted development mode with valid configuration returns the expected development teacher context;
2. development configuration with missing/empty organization ID fails closed;
3. non-development/production mode without trusted teacher context fails closed;
4. a browser/query-supplied organization value cannot activate or change the trusted context;
5. test override works only through the test fixture mechanism and cannot be supplied by the client;
6. existing cross-tenant read/edit/approve/batch/archive/regenerate tests remain green;
7. existing BAREA-002 organization-isolation tests remain green;
8. existing BAREA-003 tests remain green.

Tests must exercise the actual server-side context function/actions, not merely UI behavior.

## SECURITY AUDIT

Inspect the final implementation for:

- `BAREA_DEV_ORG_ID` use;
- `NODE_ENV` / runtime-environment checks;
- hard-coded development defaults;
- query parameters and form inputs;
- cookies/headers if used;
- test hooks;
- client bundles;
- server-only imports;
- accidental exposure of trusted context or credentials.

Specifically prove that an ordinary browser cannot select another organization and cannot turn on the development identity mechanism.

## VERIFICATION

Run:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run build:next`
- `git diff --check`
- dependency/security audit appropriate to the repository;
- BOM check;
- secret scan;
- check for new `any` in `src/`;
- verify no server-only credentials/trusted authorization mechanism is bundled client-side.

Re-run L2 browser verification and L3 responsive verification.

For L2 specifically verify:

- authorized development teacher can complete the existing Teacher Review workflow;
- `?org=foreign-org` has no authorization effect;
- direct foreign question-ID attacks fail closed;
- no victim-organization data is rendered.

For L3 re-check desktop, tablet, and mobile behavior at the established BAREA-004 viewport ranges.

## MULTI-AGENT REVIEW

Use available specialized agents for this focused correction:

1. Security/Backend — attack the environment guard and teacher-context boundary.
2. Testing — validate production/non-development fail-closed behavior and existing cross-tenant tests.
3. Frontend/Next.js — verify no browser-controlled value can influence authorization.
4. Independent Review — attempt to find a bypass after the fix.

Record actual participation and evidence in `AGY-REPORT.md`. Do not claim an agent performed work merely because it was invoked.

## REPORT

Update `AGY-REPORT.md` with:

- remaining blocker;
- exact fix;
- environment/fail-closed behavior;
- focused regression results;
- security audit results;
- sub-agent evidence;
- L2/L3 evidence;
- final test/typecheck/build results;
- explicit statement that development teacher context is development/test-only.

## STOP CONDITION

When complete:

- keep PR #6 OPEN;
- do not merge;
- do not close the PR;
- do not start BAREA-005;
- leave a clean working tree;
- stop for fresh independent BAREA review and GO/NO-GO decision.
