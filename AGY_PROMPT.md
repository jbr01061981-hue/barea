# AGY PROMPT — BAREA-007 FINAL SSE AUTHORIZATION REMEDIATION

Repository: `jbr01061981-hue/barea`
Target PR: #11
Branch: `barea-007-live-quiz`

## OBJECTIVE

Apply the final security remediation identified by the independent review of BAREA-007 PR #11.

The canonical event projection/history replay remediation is already implemented. Do **not** undo it.

The remaining issue is the SSE authorization contract: the caller must never be able to influence privileged host projection merely by supplying `?role=host`. The effective realtime role must be derived from authenticated, server-authorized session context.

## REQUIRED REMEDIATION

### 1. SSE role must be server-derived

Inspect:

`src/app/api/session/[id]/live/route.ts`

The request may contain a role query parameter for compatibility/diagnostics, but it MUST NOT be trusted as authorization input.

Do not allow code equivalent to:

```ts
const role = request.nextUrl.searchParams.get('role') === 'host'
  ? 'host'
  : 'participant';
```

to determine privileged projection.

Instead:

1. Authenticate the caller using the existing BAREA authentication/session mechanisms.
2. Load the requested session authoritatively.
3. Determine whether the authenticated actor is the session's `hostUserId`.
4. Derive the effective subscription role on the server.
5. Only the server-derived host role may receive host projection.
6. A non-host authenticated user MUST receive participant projection or be rejected according to the existing participation/transport contract.
7. An unauthenticated caller MUST NOT obtain host projection.
8. Knowing the session ID, room code, or adding `?role=host` MUST never grant host access.

Do not create a new identity/authentication system. Reuse the existing BAREA authorization/context mechanisms.

### 2. Participant subscription must be authorized too

Do not solve only the host branch.

The SSE subscription must establish that the caller is actually entitled to receive events for that session.

For individual-authenticated participation, validate the authenticated participant/session membership using existing BAREA mechanisms.

For teacher-group participation, preserve the existing teacher-controlled model and its authorized access path.

Do not make the public room code or arbitrary session ID sufficient for a protected realtime subscription.

### 3. Preserve canonical projection filtering

The recently implemented canonical `projectEventForRole()` behavior and role-aware `getHistory()` must remain intact.

All realtime paths must continue to use the canonical projection filter:

- live SSE events;
- SSE history replay;
- service reconnect/history replay;
- direct transport history where role is supplied.

A participant/projector must never receive:

- `correctOptionIndices`;
- `explanation`;
- `correctOptionIndex`;
- `correctAnswer`;
- equivalent sensitive answer-key data.

A legitimate host may receive the host projection where the existing contract requires it.

### 4. Do not reintroduce client-authoritative fields

Do not trust client-supplied:

- role;
- host flag;
- user ID as authorization;
- tenant ID;
- session ownership;
- IP address;
- question position;
- timer/deadline;
- correctness/score.

### 5. Regression tests — mandatory

Add or update deterministic tests proving all of the following:

#### SSE authorization

1. Unauthenticated request with `?role=host` cannot receive host projection.
2. Non-host authenticated user with `?role=host` cannot receive host projection.
3. Authenticated host receives host projection without needing a trusted client role claim.
4. A non-host participant receives participant projection even if `?role=host` is supplied.
5. Session A credentials cannot subscribe to Session B's live stream.
6. Invalid/missing participant credentials cannot subscribe to a protected participant stream.

#### Projection/replay

7. Participant live events contain no answer keys.
8. Participant SSE history replay contains no answer keys.
9. Participant service reconnect history contains no answer keys.
10. Host history replay remains unredacted only for an actually authorized host.

#### Timing/current-question

Preserve the previously required BAREA-007 tests:

11. Non-current question submission is rejected.
12. Submission after authoritative deadline is rejected.
13. `clientTimestamp` cannot extend the deadline.
14. Valid current-question submission before deadline is accepted.
15. Failed authorization/timing submissions create no persisted answer.

### 6. Verify the actual authorization boundary

Do not merely test that the output happens to be redacted.

The implementation must establish the correct role **before** invoking the transport/subscription projection path.

A test should make it impossible for a non-host request to cause `role: 'host'` to reach the transport merely through query parameters.

### 7. Scope restrictions

This remediation is BAREA-007 only.

Do NOT:

- implement BAREA-008 UI;
- implement scoring or leaderboard logic;
- implement BAREA-010/011/012/013;
- provision Cloudflare or deployment infrastructure;
- redesign BAREA-006 authentication/admission/tenant boundaries;
- introduce a new external auth provider;
- weaken existing security controls.

### 8. Documentation

Update `AGY-REPORT.md` with a new section documenting:

- the remaining SSE authorization issue;
- root cause;
- exact server-derived-role remediation;
- participant subscription authorization;
- regression tests;
- final verification results.

Do not rewrite or truncate historical report sections.

Ensure `docs/DECISIONS.md` accurately states that host projection is available only after server-side authentication and authorization as the session host. Do not document a client-supplied role as authoritative.

Do not mark BAREA-007 as fully completed merely because tests pass. It remains pending independent review until this remediation is implemented and verified.

## REQUIRED VERIFICATION

Run all applicable repository checks, including:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
```

Also run the focused BAREA-007 live-quiz test suite.

Report:

- exact commit SHA;
- files changed;
- tests and results;
- authorization behavior;
- projection/replay behavior;
- confirmation that no out-of-scope milestone was implemented.

## GIT RULES

- Work only on `barea-007-live-quiz`.
- Do not force-push.
- Do not rewrite history.
- Do not use `git reset --hard` while work exists.
- Commit the remediation with a descriptive message.
- Push to `origin/barea-007-live-quiz`.
- Keep PR #11 open.
- Stop after the remediation and verification; wait for independent review.
