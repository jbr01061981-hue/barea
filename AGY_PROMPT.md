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

---

# BAREA-006 — REMEDIATION REQUIRED AFTER INDEPENDENT SECURITY REVIEW

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Implementation commit under review: `1f1ee3fd0768c36187f3ae1ea42afbc8ff505c37`

## Current authorization status

**NO-GO — DO NOT MERGE `1f1ee3f` yet.**

An independent review of the actual implementation identified TWO release-blocking security defects that must be fixed before merge authorization.

Do not treat AGY's existing post-implementation GO report as sufficient. Reproduce the findings against the actual code, fix the root causes, add regression/adversarial tests, and obtain the required two-agent re-review.

## Finding 1 — Client-controlled IP must not be trusted

In the current implementation, public Server Actions including:

- `lookupRoomAction(roomCode: string, clientIp?: string)`
- `joinSessionAction(roomCode: string, clientIp?: string)`

accept `clientIp` as a direct caller-supplied Server Action argument and pass it into the service/rate-limiting path.

This is not an authoritative client IP. A malicious caller can submit arbitrary IP values and potentially evade per-IP/subnet throttling by rotating/spoofing the supplied value.

### Required invariant

**NO CLIENT-SUPPLIED VALUE may be treated as the authoritative source of network client IP.**

The server must derive the effective client IP from a trusted server/deployment boundary.

Requirements:

1. Remove `clientIp` as an authoritative input from public Server Action APIs.
2. Do not accept a hidden/browser/form/query/body parameter as a substitute.
3. Derive the IP server-side using the actual hosting/runtime request metadata available to this application.
4. If a reverse proxy is involved, trust forwarding headers only according to an explicit trusted-proxy/deployment model. Do not blindly trust arbitrary `X-Forwarded-For` values supplied by an untrusted client.
5. If a trusted IP cannot be established, fail closed for the IP-based protection or use a safe server-side fallback that cannot be selected by the caller.
6. Preserve the existing NAT/subnet anti-abuse objective; do not remove rate limiting merely to eliminate the vulnerability.
7. Keep authentication/authorization independent of the IP value. IP is an abuse-control signal, not an identity signal.

Inspect the complete path, not only the Server Action signatures:

`lookupRoomAction` / `joinSessionAction` → `session-service` → rate limiter → request/IP source.

Also inspect all callers and tests to ensure no browser-controlled value remains an authoritative IP input.

### Mandatory adversarial tests for Finding 1

Add genuine tests proving at minimum:

- supplying a forged `clientIp` cannot select the rate-limit bucket;
- changing a caller-supplied IP cannot bypass the intended per-IP/subnet protection;
- the effective IP comes from the trusted server-side source;
- arbitrary forwarding headers cannot manufacture a trusted IP when the deployment configuration does not trust that proxy/header;
- legitimate trusted proxy handling, if used, still works under the configured deployment model;
- existing NAT/subnet anti-abuse behavior remains intact;
- authenticated participant rate limiting remains intact.

Do not merely test that a parameter was renamed. Test the actual security boundary.

## Finding 2 — Unexpected internal errors must not leak raw messages

In the current `src/app/session/actions.ts`, `errorResponse(err)` returns `err.message` for unexpected/non-domain exceptions through the `INTERNAL_ERROR` response path.

This can expose database, implementation, infrastructure, or other internal details to an untrusted client.

### Required invariant

**Unexpected internal exceptions must never expose their raw message to the client.**

Requirements:

1. Preserve deliberate, safe `BareaDomainError` public messages where the application explicitly defines them as client-safe.
2. For unexpected/non-domain exceptions, return a generic public error such as `INTERNAL_ERROR` with a safe generic message.
3. Log the detailed exception server-side using the repository's existing logging/error-reporting mechanism, without exposing it to the caller.
4. Do not put stack traces, SQL/database errors, provider errors, filesystem paths, environment values, secrets, or implementation details into the public response.
5. Ensure the fix applies consistently across the relevant Server Actions, not just one test case.

### Mandatory adversarial tests for Finding 2

Add tests that force representative unexpected failures, for example:

- database/repository exception;
- generic `Error('secret internal implementation detail')`;
- error containing a SQL/table/path/provider message.

Prove that:

- the client receives only the approved generic public error;
- the sensitive/raw internal message is absent from the response;
- domain errors that are intentionally client-safe still preserve their expected public message;
- detailed error information is logged server-side according to the repository's existing logging approach.

## Scope preservation

Do NOT redesign BAREA-006 or reopen already-approved architecture unless the security fix genuinely requires it.

Preserve:

- teacher-controlled `TEACHER_GROUP` participation;
- authenticated individual participation;
- `OPEN` and `RESTRICTED` admission policies;
- verified provider identity / stable provider `sub` mapping;
- personal workspace Option A isolated tenant mapping;
- server-derived ownership and authorization;
- existing IDOR/cross-tenant protections;
- NAT/subnet anti-abuse controls;
- BAREA-007 authoritative start-time/transition boundary and quarantine.

Do not introduce anonymous nickname admission, client-selected tenant/organization identity, or any browser-controlled authorization mechanism.

## Required inspection before editing

Inspect the actual commit and current branch state before making changes:

- `1f1ee3fd0768c36187f3ae1ea42afbc8ff505c37`
- `src/app/session/actions.ts`
- `src/service/session-service.ts`
- all session lookup/join callers
- rate-limiter implementation
- request/IP extraction utilities or deployment configuration
- relevant BAREA-006 tests
- existing error-handling/logging utilities
- package/test configuration
- complete BAREA-006 diff

Reproduce both findings independently before fixing them.

## Testing requirements

Add focused regression/adversarial tests for BOTH findings.

Then run:

1. targeted BAREA-006/security tests;
2. complete test suite;
3. `npm run typecheck`;
4. `npm run build`;
5. `npm run build:next`;
6. `git grep ": any" -- src/`;
7. `git diff --check`;
8. final `git status` and complete diff review.

Record actual commands and actual results. Never claim a test count or PASS unless it was actually executed.

## Two-agent re-review — REQUIRED

After implementation, perform a fresh review using exactly these two reviewer roles:

### Agent 1 — Security + Architecture Red Team

Independently inspect the actual remediation and determine whether:

- client-controlled IP can still influence rate limiting;
- proxy/header handling has a trusted deployment boundary;
- IP spoofing/rate-limit bypass remains possible;
- unexpected internal error messages can leak to clients;
- any alternate public action exposes the same vulnerabilities;
- BAREA-006 authorization/tenant boundaries remain secure;
- BAREA-007 remains quarantined.

### Agent 2 — Persistence + QA / Implementability Reviewer

Independently inspect the actual remediation and determine whether:

- the fix is correctly implemented across action/service/persistence boundaries;
- tests exercise the real security boundary rather than mocks that merely prove the implementation's assumptions;
- legitimate behavior remains intact;
- NAT/subnet anti-abuse behavior remains functional;
- error logging is appropriate and does not itself expose secrets;
- typecheck/build/full suite pass;
- the remediation is complete and implementable.

Both agents must provide explicit GO/NO-GO findings and identify any remaining blocker.

Do not manufacture unanimous approval. If either reviewer identifies a credible blocker, report NO-GO and fix it before requesting final authorization.

## Do not cheat

Do NOT:

- remove or weaken rate limiting;
- trust a renamed client parameter;
- blindly trust arbitrary `X-Forwarded-For`/forwarded headers;
- add a client-visible switch for trusted IP selection;
- return raw unexpected `err.message`;
- swallow errors without appropriate server-side logging;
- delete or weaken adversarial tests;
- change expected security behavior merely to make tests pass;
- claim tests passed without executing them;
- rely only on the previous AGY audit;
- self-merge.

## Git requirements

Remain on `barea-006-share-join`.

Commit the remediation and tests with a clear security-focused message.

Push the resulting commit to:

`origin/barea-006-share-join`

Verify the remote branch contains the new commit.

**DO NOT merge the branch.**
**DO NOT self-merge.**
**DO NOT start BAREA-007.**

## Final report to ChatGPT

Report exactly:

### Remediation
- previous implementation commit
- new commit
- exact files changed
- Finding 1 root cause
- Finding 1 fix
- Finding 2 root cause
- Finding 2 fix

### Security verification
- client-supplied IP influence: PASS/FAIL
- spoofed IP rate-limit bypass: PASS/FAIL
- trusted proxy handling: PASS/FAIL/NOT USED
- NAT/subnet anti-abuse: PASS/FAIL
- authenticated participant rate limiting: PASS/FAIL
- unexpected error disclosure: PASS/FAIL
- safe domain-error disclosure: PASS/FAIL
- server-side error logging: PASS/FAIL
- BAREA-006 tenant/authorization regression: PASS/FAIL
- BAREA-007 quarantine: PASS/FAIL

### Tests and verification
- targeted security tests: PASS/FAIL
- full suite: PASS/FAIL
- typecheck: PASS/FAIL
- build: PASS/FAIL
- build:next: PASS/FAIL
- `git grep ": any" -- src/`: PASS/FAIL
- `git diff --check`: PASS/FAIL
- actual commands executed

### Two-agent re-review
- Agent 1 Security + Architecture Red Team: GO/NO-GO + findings
- Agent 2 Persistence + QA / Implementability Reviewer: GO/NO-GO + findings

### Git
- branch
- previous commit
- new commit
- push result
- remote verification

Completion of this task does NOT authorize merge. After the remediation and two-agent re-review are complete, stop and wait for **ChatGPT's independent security re-review and explicit merge authorization**.
