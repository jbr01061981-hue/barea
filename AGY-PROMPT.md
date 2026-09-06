# AGY CORRECTIVE TASK — BAREA-004 SECURITY AUTHORIZATION BOUNDARY

## STATUS

BAREA-004 PR #6 is OPEN and must remain OPEN.

**This is a corrective pass for a release-blocking security defect found during independent BAREA review.**

Do NOT merge the PR.
Do NOT close the PR.
Do NOT start BAREA-005 or any later milestone.
Do NOT broaden this into a production authentication project.

## SOURCE OF TRUTH — READ FIRST

Repository: `jbr01061981-hue/barea`

Read the current `main` versions of:

- `AGENTS.md`
- `docs/BAREA-004-DESIGN-GATE.md`
- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md`
- `docs/VERIFICATION-GATES.md`

Then inspect the current PR #6 implementation and existing BAREA-002 Question Bank and BAREA-003 generation boundaries.

GitHub is authoritative. Preserve the approved BAREA-004 scope and architecture unless a concrete security defect requires a minimal change.

## BLOCKING DEFECT

The current Teacher Review implementation allows the browser to influence the organization context used by server actions.

Specifically, the current review page accepts an `org` URL search parameter/default and the server actions accept `organizationId` from the caller. That means a caller can potentially select another organization's ID instead of having the server determine the authorized teacher's organization.

This is a **server-side authorization boundary defect**. Question Bank organization isolation underneath is not sufficient if the Teacher Review server-action boundary trusts browser input.

The browser must never be the authority for organization identity or authorization.

## REQUIRED SECURITY FIX

Implement the **minimum server-side development teacher identity/context boundary required for BAREA-004**.

### 1. Trusted server-side teacher context

Create a small, explicit server-only mechanism that represents the current development teacher identity and authorized organization for the local BAREA-004 workflow.

Requirements:

- organization context used for Teacher Review reads and mutations MUST be derived server-side;
- do not accept `organizationId` from a browser action argument as an authority;
- do not use a URL query parameter as the authorization source;
- any URL `org` value may be retained only as a navigation/display aid if genuinely useful, but it MUST NOT determine authorization or data access;
- keep the development identity/context isolated and clearly documented as development-only;
- do not expose secrets or trusted authorization state to browser JavaScript;
- do not implement a broad production authentication/authorization system in this corrective pass;
- fail closed when trusted teacher context is unavailable or unauthorized.

Use the simplest secure design compatible with the existing local Next.js architecture. Do not invent unnecessary infrastructure.

### 2. Server actions

Audit every Teacher Review server action in the current implementation.

For every read or mutation involving questions, the organization must come from the trusted server-side teacher context.

This includes, as applicable:

- review queue reads;
- question retrieval;
- question edits/saves;
- single approval;
- batch approval;
- archive/discard;
- regeneration.

A direct invocation of an action MUST NOT be able to select another organization merely by supplying a forged `organizationId`.

Prefer removing organization identity from public action inputs entirely. If an input must remain for compatibility, it must be treated as untrusted and must never override the trusted server context.

Do not rely on hidden form fields, disabled controls, query parameters, client state, or TypeScript types as authorization mechanisms.

### 3. Review page / client

Remove the current pattern in which the page uses `?org=...` as the authoritative organization selector.

The rendered review experience should obtain its data from the server-side authorized context.

Client components may display organization-related information returned by the server, but must not choose the organization on which mutations operate.

### 4. Preserve existing isolation

Do NOT weaken or bypass the existing BAREA-002 Question Bank organization isolation.

The intended boundary is:

`trusted server teacher context -> authorized organization -> Question Bank service/repository organization isolation`

not:

`browser organizationId -> server action -> database`

Keep the existing domain/lifecycle protections intact.

## REQUIRED REGRESSION TESTS

Add automated tests that actively attempt to break the new boundary.

At minimum prove:

1. authorized development teacher can read questions for their own organization;
2. authorized development teacher can edit/save their own organization's pending question;
3. authorized development teacher can approve their own organization's question;
4. authorized development teacher can archive/regenerate within their organization where supported;
5. a forged organization ID cannot read another organization's review queue;
6. a forged organization ID cannot retrieve another organization's question;
7. a forged organization ID cannot edit another organization's question;
8. a forged organization ID cannot approve another organization's question;
9. a forged organization ID cannot archive another organization's question;
10. a forged organization ID cannot regenerate another organization's question;
11. forged organization input cannot affect batch approval authorization;
12. missing/invalid trusted teacher context fails closed;
13. the existing BAREA-002 organization-isolation tests remain green;
14. the existing BAREA-003 tests remain green.

Tests must exercise the actual server-side action/context boundary, not merely assert that a UI control is hidden.

## SECURITY AUDIT

Actively inspect the implementation for equivalent authorization bypasses, including:

- query parameters;
- form fields;
- client component props;
- server action arguments;
- cookies/headers if used;
- direct imports of server-only context into client code;
- accidental browser bundling of server credentials or trusted context;
- error messages that leak another organization's data.

If a mechanism is used to represent development identity, ensure it cannot be changed by ordinary browser-controlled organization input.

Do not add credentials, API keys, or secrets to the repository.

## MULTI-AGENT CORRECTIVE REVIEW — REQUIRED

Use available specialized sub-agents rather than treating this as a single-agent fix.

At minimum, where capabilities exist, obtain focused input from:

1. **Security / Backend** — attack the server-side identity and organization authorization boundary.
2. **Testing** — design and execute cross-organization and forged-input regression tests.
3. **Frontend / Next.js** — verify that client routing/query state cannot influence authorization and that server/client boundaries remain correct.
4. **Accessibility / Responsive QA** — confirm the security fix did not break the existing Teacher Review interaction at L2/L3.
5. **Independent Code Review** — actively attempt to find another authorization or scope defect after the fix.

Record actual sub-agent participation and evidence in `AGY-REPORT.md`. Do not claim a role was performed merely because an agent was invoked.

## REQUIRED VERIFICATION

After implementing the fix, run the complete relevant verification suite, including:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- appropriate dependency/security audit checks;
- no new critical `any`;
- no BOM artifacts;
- no committed secrets;
- no server-only credentials/trusted authorization state in browser bundles.

Re-run the existing Teacher Review workflow in an actual local browser.

### L2 browser verification

Verify the real rendered Teacher Review flow still works for the authorized development teacher:

`queue -> open -> edit -> save -> approve -> batch approval -> archive -> regenerate`

Also test an attempted cross-organization access path using a forged URL/query value or other browser-controlled input and verify that it cannot change the authorized organization.

### L3 responsive verification

Re-check desktop, tablet, and mobile Teacher Review behavior after the security change. Use actual viewport sizes and record them.

Do not claim L2/L3 based only on automated DOM tests.

## REPORT

Update `AGY-REPORT.md` with:

- the original security defect;
- the attack path that was possible;
- the exact server-side authorization boundary implemented;
- how browser-controlled organization input is prevented from overriding it;
- cross-organization regression test evidence;
- sub-agent roles actually performed and their findings;
- `npm test` result;
- typecheck/build results;
- security/audit results;
- L2 browser observations and viewport(s);
- L3 responsive observations and viewport(s);
- any limitations, especially the fact that the identity mechanism is development-only;
- final corrective-pass status.

Do not mark BAREA-004 COMPLETED unless all required gates pass.

## STRICT SCOPE

Allowed:

- minimal server-side development teacher identity/context;
- secure organization derivation;
- server-action authorization changes;
- removal/neutralization of browser-controlled organization authority;
- focused regression/security tests;
- required documentation/report updates;
- fixes directly required to preserve BAREA-004 behavior after the security change.

Not allowed:

- full production authentication;
- user accounts/roles beyond the minimum development teacher context;
- participant authentication;
- BAREA-005 Quiz Authoring;
- BAREA-006 Share/Join;
- BAREA-007 Live Quiz/realtime;
- BAREA-008 Participant UI;
- BAREA-009 Scoring;
- BAREA-010 Results/Leaderboard;
- BAREA-011 Projector;
- BAREA-012 Church Validation;
- BAREA-013 Pilot;
- production deployment;
- new AI providers;
- unrelated refactoring.

## STOP CONDITION

When the corrective implementation and verification are complete:

- keep PR #6 OPEN;
- do not merge;
- do not self-declare merge GO;
- leave the repository in a clean, reviewable state;
- update `AGY-REPORT.md` with actual evidence;
- stop for independent BAREA review and user acceptance.
