# BAREA-008 HOMEPAGE — FIX THE NEXT.JS PRODUCTION BUILD GATE

## OBJECTIVE

Work directly on the existing BAREA-008 homepage branch/PR and resolve the production build failure reported during independent local verification.

This is a **focused correction task**. Do not start the next frontend/product phase. Do not redesign the homepage broadly. Do not change backend/security behavior.

Repository: `jbr01061981-hue/barea`
Current frontend work: PR #12 / branch `barea-008-homepage`
Base: `main`

## VERIFIED FAILURE

Local verification on the BAREA-008 branch produced:

- `npm run typecheck` — PASS
- `npm test` — PASS, 149/149
- `npm run build` — PASS
- `npm run build:next` — FAIL

Build-stopping error:

```text
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
digest: '3248022719'
Next.js build worker exited with code: 1
```

The build also emitted repeated React warnings about children lacking unique `key` props in generated viewport/meta/head/html/header/a/span structures. Treat those warnings as a separate quality issue and identify their source, but do not confuse them with the build-stopping failure.

The local verification also reported a warning that `NODE_ENV` was set to a non-standard value. Do not introduce or depend on a non-standard `NODE_ENV`; determine whether this is only a local-shell artifact and document it if relevant.

## REQUIRED WORKFLOW

1. Inspect the current `barea-008-homepage` branch and PR #12.
2. Read the actual current homepage/layout/global CSS and any related config before changing anything.
3. Reproduce the failure with the supported production build command.
4. Trace the `/ _global-error` prerender failure to its real source. Do not guess and do not paper over it with unrelated changes.
5. Fix the smallest correct root cause.
6. Investigate the React `key` warnings and fix them if they originate from BAREA-owned code introduced by this branch. If they originate from framework-generated internals or dependencies and cannot correctly be fixed in BAREA code, document that fact rather than adding hacks.
7. Do not weaken authentication, authorization, security boundaries, database behavior, or server-side contracts.
8. Do not add a fake production teacher identity, change production to development, or bypass the existing production authentication guard.
9. Do not introduce new dependencies unless absolutely necessary and justified.
10. Do not change the ADR-012 deployment architecture.
11. Do not start BAREA-009 or any later frontend/product phase.

## QUALITY GATES

After the fix, run all of:

```text
npm run typecheck
npm test
npm run build
npm run build:next
```

Expected:

- Typecheck PASS
- 149/149 existing tests PASS, or a clearly explained legitimate test-count change caused by the fix
- normal TypeScript build PASS
- Next.js production build PASS
- no build-stopping prerender error
- no new warnings attributable to the BAREA-008 implementation

Then run the homepage locally in development mode for visual verification and confirm the homepage still renders correctly at `/`.

## VISUAL / FUNCTIONAL SCOPE

Verify:

- `/` renders the BAREA homepage instead of redirecting to `/teacher/review`
- desktop layout remains intact
- mobile/narrow layout remains intact
- navigation/CTAs still point to the intended existing routes
- no horizontal overflow
- accessibility/focus behavior remains intact

Do not expand the visual design scope beyond correcting regressions caused by the build fix.

## GIT DISCIPLINE

- Work on the existing `barea-008-homepage` branch.
- Preserve the existing PR #12 scope.
- Make a focused correction commit with a clear message.
- Do not merge PR #12.
- Do not create another PR.
- Do not modify `main`.
- Do not modify unrelated historical commits.
- Do not push secrets or environment credentials.

## FINAL REPORT

Report:

1. exact root cause of the `_global-error` `useContext` failure;
2. exact files changed;
3. exact fix;
4. source/cause of the React `key` warnings and whether they were fixed;
5. results of all four quality gates;
6. local homepage visual verification result;
7. branch and final commit SHA;
8. confirmation that PR #12 remains open/unmerged;
9. any remaining blocker, with evidence.

**STOP after this focused correction and verification. Do not begin the next frontend phase.**
