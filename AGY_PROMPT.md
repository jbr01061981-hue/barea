# BAREA-004 — CRITICAL SECURITY FIX

Repository: `jbr01061981-hue/barea`
PR: `#6 — feat(review): implement BAREA-004 Teacher Review & Approval foundation`
Branch: `barea-004-teacher-review`

## Mission

Work locally on the PC on the existing `barea-004-teacher-review` branch. Inspect the actual code and PR diff, fix the release-blocking authorization vulnerability described below, add genuine security tests, run tests, review the final diff, commit, and push the changes to the SAME branch.

DO NOT merge PR #6. DO NOT create another PR. DO NOT start BAREA-005. DO NOT modify unrelated functionality.

## Critical security defect

In `src/app/teacher/review/db.ts`, `isTestEnvironment()` currently treats arbitrary `process.execArgv` values beginning with `--test-` or `--test=` as proof of trusted test execution. This is unsafe because `isTestEnvironment()` gates `setAuthorizedTeacherContext()` and `getAuthorizedTeacherContext()`.

The current dangerous logic is conceptually:

```ts
arg === '--test' || arg.startsWith('--test-') || arg.startsWith('--test=')
```

An attacker-controlled runtime argument such as `--test-evil` can therefore activate the test authorization path.

## Required security invariant

NO UNTRUSTED RUNTIME INPUT may ever establish an authorized teacher context.

The implementation MUST NOT use arbitrary `process.argv`/`process.execArgv` strings as sufficient proof of trusted test execution.

In particular, these MUST NOT activate test authorization:

- `--arg-with-test`
- `contest`
- `testing-suite`
- `--test-evil`
- `--test-attacker`
- `--test-not-real`
- `--test=attacker`
- `--test-fake`
- `--test-anything`

Do not merely patch the tests. Fix the actual authorization boundary.

## Inspect first

Before editing, inspect:

- `src/app/teacher/review/db.ts`
- `src/app/teacher/review/actions.ts`
- `src/app/teacher/review/page.tsx`
- `test/teacher-review.test.ts`
- `package.json`
- test scripts/configuration
- Node version requirements
- CI configuration
- complete PR #6 diff

Understand the complete flow:

`isTestEnvironment()` → `setAuthorizedTeacherContext()` → `mockTeacherContext` → `getAuthorizedTeacherContext()` → authorized teacher context.

## Correct implementation

Design a robust trusted mechanism appropriate to this repository for allowing genuine automated tests to establish their fixture context.

Do NOT replace one string-prefix heuristic with another.
Do NOT treat arbitrary `--test-*` or `--test=` strings as trusted proof.
Do NOT introduce a browser/API parameter that enables test mode.
Do NOT allow browser input to establish teacher identity or organization identity.
Do NOT restore any hard-coded organization fallback.

If the architecture cannot safely distinguish genuine test execution from arbitrary runtime arguments, redesign the test authorization boundary rather than adding another CLI string heuristic.

## Environment rules

Preserve these fail-closed requirements:

1. `NODE_ENV=production` → production teacher authentication required; no fixture authorization.
2. Unset `NODE_ENV` → fail closed unless using the repository's genuinely trusted test mechanism.
3. Unknown/staging `NODE_ENV` → fail closed unless using the repository's genuinely trusted test mechanism.
4. `NODE_ENV=development` → development teacher context allowed ONLY with explicit non-empty `BAREA_DEV_ORG_ID`.
5. Whitespace-only `BAREA_DEV_ORG_ID` → fail closed.
6. No hard-coded organization fallback such as `church-berea-default`.

## Test fixture hook

Audit `setAuthorizedTeacherContext()` as a security-sensitive function.

It must not be callable successfully in production or an untrusted runtime merely because process arguments contain test-looking strings.

Explicitly test an attacker context such as:

```ts
{
  userId: 'attacker',
  organizationId: 'org-attacker',
  displayName: 'Attacker',
  role: 'teacher'
}
```

and prove that arbitrary runtime arguments cannot establish this context.

## Tests 21 and 22

Rewrite/extend `test/teacher-review.test.ts`.

### Test 21

It must test the REAL authorization boundary, not merely `isTestEnvironment()`.

Cover arbitrary values in both `process.argv` and `process.execArgv` where applicable, including:

- `--arg-with-test`
- `contest`
- `testing-suite`
- `--test-evil`
- `--test-attacker`
- `--test-not-real`
- `--test=attacker`

Prove these cannot cause `setAuthorizedTeacherContext(attackerContext)` to establish authorization.

### Test 22

It must prove that the legitimate test execution mechanism still works.

Do NOT simply assign:

```ts
process.execArgv = ['--test-isolation=process', '--test-concurrency=0'];
```

and call that proof of genuine Node test execution. That only proves the current predicate accepts `--test-*` strings.

Test the actual trusted mechanism used by the corrected implementation.

The tests must distinguish genuine trusted test execution from fake test-looking arguments.

## Tenant security

Preserve server-derived:

- `teacherContext.userId`
- `teacherContext.organizationId`
- `teacherContext.role`

Browser query parameters such as `?org=` or `?id=` must not become authorization inputs.

Preserve and run existing cross-tenant tests for:

- read
- update
- approval
- batch approval
- archive
- regeneration

## BAREA-002 / BAREA-003 regression

Do not break existing BAREA-002 or BAREA-003 behavior or service/repository boundaries. Run the relevant existing tests and the complete test suite. Do not start BAREA-005.

## Adversarial testing

Actively test combinations such as:

- production + `--test`
- production + `--test-evil`
- production + `--test=evil`
- unset NODE_ENV + `--test-evil`
- unset NODE_ENV + `--test-attacker`
- staging + `--test-evil`
- staging + `--test=attacker`
- arbitrary `process.execArgv` test-looking values

The objective is to prove an attacker cannot manufacture trusted teacher authorization.

## Do not cheat

Do NOT:

- delete security tests;
- weaken assertions;
- skip failing tests;
- change expected security behavior merely to make tests pass;
- add production bypasses;
- rely on AGY-REPORT.md;
- claim tests passed without actually running them.

## Final repository audit

Search the final repository for:

- `includes('test')`
- `includes("test")`
- `startsWith('--test-')`
- `startsWith("--test-")`
- `startsWith('--test=')`
- `startsWith("--test=")`
- `BAREA_DEV_ORG_ID`
- `church-berea-default`
- `setAuthorizedTeacherContext`
- `isTestEnvironment`
- `mockTeacherContext`

Confirm there is no alternate authorization path.

## Test execution

Run targeted Teacher Review/security tests first, then the full existing test suite.

Record the actual commands and results. Do not report 81/81 or any other number unless actually executed locally.

Also run:

```text
git status
git diff
git diff --check
```

Review the complete final diff for unrelated changes.

## Git requirements

Remain on:

`barea-004-teacher-review`

Commit the implementation and test changes with a clear security-focused commit message, e.g.:

`fix(review): harden test authorization boundary`

Then push to:

`origin/barea-004-teacher-review`

After pushing, verify the remote branch contains the new commit.

DO NOT merge PR #6.
DO NOT close PR #6.
DO NOT create PR #7.
DO NOT start BAREA-005.

## Final report

Report:

### Implementation
- exact files changed
- what was unsafe
- how the trusted test mechanism now works

### Security
Explicit PASS/FAIL for:
- arbitrary CLI substring
- `--arg-with-test`
- `contest`
- `testing-suite`
- `--test-evil`
- `--test-attacker`
- `--test=attacker`
- production
- unset NODE_ENV
- staging/unknown NODE_ENV
- development without BAREA_DEV_ORG_ID
- development with BAREA_DEV_ORG_ID
- browser tenant manipulation
- teacher identity manipulation
- cross-tenant access
- test fixture abuse

### Tests
- targeted tests: PASS/FAIL
- full suite: PASS/FAIL
- security tests: PASS/FAIL
- actual commands executed

### Git
- branch
- previous commit
- new commit
- push result
- remote verification

Completion requires the implementation fix, genuine security tests, successful targeted/full test execution, final diff review, commit, and push to `barea-004-teacher-review`.
