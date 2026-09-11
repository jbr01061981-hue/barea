# AGY PROMPT — BAREA-007 LIVE QUIZ IMPLEMENTATION

Repository: `jbr01061981-hue/barea`
Remote: `origin`
Primary branch: `main`

## OBJECTIVE

Implement **BAREA-007 — Live Quiz** according to `docs/ROADMAP.md` and the existing BAREA architecture.

BAREA-006 (Share/Join) is complete and merged. The current roadmap defines BAREA-007 as:

> **Live Quiz** — Authoritative state machine, timer sync, real-time transport

The purpose of this phase is to build the **authoritative live-session engine and transport contract** required for a synchronized church quiz.

This phase must be implemented without prematurely absorbing BAREA-008 Host/Participant UI, BAREA-009 Scoring, BAREA-010 Results/Leaderboard, BAREA-011 Presentation, BAREA-012 Church Validation, BAREA-013 Pilot, or Cloudflare deployment.

Before changing code, inspect the existing repository and understand the BAREA-004/005/006 architecture. Do not replace working BAREA-006 patterns with a generic realtime architecture.

---

## CURRENT BASELINE

BAREA-006 is merged in GitHub `main`.

Known BAREA-006 merge commit:

`008dc85123d05129ac3154e676369ae39864d005`

The current roadmap has BAREA-006 as **COMPLETED — MERGED** and BAREA-007 as **NOT STARTED**.

Preserve the existing participation model:

- `TEACHER_GROUP`: teacher-controlled groups; pupils do not require individual BAREA accounts/devices.
- `INDIVIDUAL_AUTHENTICATED`: authenticated individual participants.
- `TEACHER_ASSIGNED`, `OPEN`, and `RESTRICTED` admission policies remain authoritative server-side.
- Tenant/workspace isolation remains authoritative.
- Public room-code/share information does not itself grant protected authorization.

Existing session status values include `LOBBY`, `ACTIVE`, `COMPLETED`, and `CLOSED`. BAREA-007 owns the authoritative transition into and through the live `ACTIVE` lifecycle.

---

# NON-NEGOTIABLE BOUNDARIES

1. **Implement BAREA-007 only.**
2. Do not implement BAREA-008 polished Host/Participant UI.
3. Do not implement BAREA-009 scoring algorithms or leaderboard logic.
4. Do not implement BAREA-010 results/leaderboards.
5. Do not implement BAREA-011 presentation/projector mode.
6. Do not implement BAREA-012 church validation workflows.
7. Do not implement BAREA-013 pilot infrastructure.
8. Do not provision Cloudflare, Workers, Tunnel, DNS, production realtime infrastructure, or deployment resources.
9. Do not redesign or weaken BAREA-006 authorization, admission, tenant isolation, participant identity, or rate-limiting boundaries.
10. Do not trust client-supplied session state, question numbers, timer values, deadlines, scores, roles, tenant IDs, or authorization claims.
11. Do not make the browser authoritative for time or live state.
12. Do not use a client-provided IP address as a security identity.
13. Do not introduce `127.0.0.1` or another fabricated identity as a production security boundary.
14. Do not trust forwarding headers without a genuine deployment trust boundary.
15. Do not use a room code as authorization for host mutations.
16. Do not allow one session's live state or events to affect another session.
17. Do not silently discard existing local work.
18. Do not force-push or rewrite Git history.
19. Do not use `git reset --hard` while uncommitted work exists.
20. Do not change unrelated frontend work being developed separately unless an explicit BAREA-007 integration contract requires it.

If an architectural decision would cross these boundaries, stop and report it before implementing it.

---

# STEP 1 — INSPECT BEFORE IMPLEMENTING

First inspect:

```text
git status --short --branch
git branch --show-current
git log --oneline --decorate -15
```

Then inspect the relevant existing files, including at minimum:

```text
src/domain/session.ts
src/domain/value-objects.ts
src/domain/domain-errors.ts
src/service/session-service.ts
src/service/rate-limiter.ts
src/persistence/sqlite-session-repository.ts
src/app/session/actions.ts
src/index.ts
test/session-share-join.test.ts
docs/ROADMAP.md
docs/DECISIONS.md
AGY-REPORT.md
```

Also inspect package/runtime configuration to determine the current server framework and available realtime primitives before selecting a transport.

Do not assume WebSockets are already supported merely because BAREA ultimately needs realtime behavior.

---

# STEP 2 — DEFINE THE BAREA-007 LIVE STATE MACHINE

Implement a server-authoritative state machine with explicit, validated transitions.

At minimum establish a lifecycle equivalent to:

```text
LOBBY
  ↓ host start
ACTIVE / question lifecycle
  ↓ final question completed
COMPLETED

LOBBY → CLOSED
ACTIVE → CLOSED
```

The exact internal representation may be improved after inspecting the existing model, but transitions must be explicit and deterministic.

For the live question lifecycle, define states sufficient to distinguish at least:

- no active question;
- question presented/open;
- answer window active;
- answer window closed/locked;
- transition to the next question;
- quiz completion.

Do not implement scoring. BAREA-007 may record an authoritative answer submission/event and its timing metadata, but calculation of points belongs to BAREA-009.

Every transition must validate:

- current session state;
- session identity;
- authenticated host authority where required;
- participant admission/identity where required;
- quiz/question existence;
- expected state/version where concurrency protection is required;
- server time/deadline rules.

Invalid transitions must fail safely and leave authoritative state unchanged.

---

# STEP 3 — SERVER-AUTHORITATIVE TIME

The client must never determine the official timer.

Use server-side timestamps/deadlines as the authority.

Requirements:

- store or derive authoritative UTC timestamps;
- establish question-open time and deadline from the server;
- clients receive enough information to render a countdown locally;
- client countdown is display-only;
- answer acceptance is decided by server time;
- late submissions are rejected deterministically;
- deadline races have one defined server-side rule;
- clock skew cannot extend a participant's answer window;
- reconnecting clients receive the current authoritative state/deadline rather than restarting their local timer.

Do not rely on `setTimeout`, browser clocks, client countdown values, or client-provided timestamps for authorization or answer validity.

---

# STEP 4 — CONCURRENCY AND STATE VERSIONING

BAREA-006 already exposes `stateVersion` on the session model. Use an authoritative monotonic version or equivalent concurrency mechanism for live state mutations.

Requirements:

- every authoritative live mutation is serialized or protected against races;
- state versions increase monotonically;
- stale mutations cannot overwrite newer state;
- duplicate requests are handled deterministically;
- two simultaneous host commands cannot both advance the same state incorrectly;
- question transition and deadline closure cannot race into an invalid state;
- cross-session state cannot be shared accidentally.

Prefer a transactional database/state transition where persistence is required.

Do not solve concurrency by trusting the client to retry until something works.

---

# STEP 5 — HOST AUTHORIZATION

Host control operations are privileged mutations.

At minimum define authoritative operations for the live lifecycle such as:

- start live quiz/session;
- open/advance the appropriate live question state;
- close/lock the current answer window when applicable;
- advance according to the state machine;
- complete/end the session.

The exact public API names should follow the existing BAREA conventions.

Every host mutation must verify server-side that the authenticated actor is the session's `hostUserId` and that the actor is operating on the intended session/tenant.

Never accept a client-supplied role such as `isHost: true` as authority.

Never authorize a host mutation using only a room code.

Do not expose a mutation that allows an authenticated user to control another user's session merely by knowing its ID or room code.

---

# STEP 6 — PARTICIPANT ANSWER SUBMISSION

Implement the BAREA-007 answer-submission contract without implementing scoring.

The server must determine:

- participant identity;
- session membership;
- current active question;
- whether the participant is permitted to answer;
- whether the answer window is still open;
- whether the submission is a duplicate or replacement;
- authoritative submission timestamp;
- authoritative state/version context.

Do not trust client-supplied:

- participant identity;
- user ID as a substitute for authenticated context;
- question number;
- server timestamp;
- deadline;
- score;
- correctness.

For duplicate answers, define one deterministic policy. A safe BAREA-007 baseline is **first accepted submission wins and later submissions are rejected/ignored**, unless the existing product requirements explicitly require replacement.

Do not calculate points or rankings in this phase.

For `TEACHER_GROUP`, preserve the account/device-free pupil model. The teacher/group answer flow must not accidentally require pupil authentication.

---

# STEP 7 — REAL-TIME TRANSPORT

Select the realtime transport only after inspecting the existing runtime/deployment architecture.

The transport must provide a clear server-to-client event contract for synchronized live state.

The implementation must address:

- connection/session association;
- authenticated identity where required;
- subscription authorization;
- session isolation;
- initial state synchronization;
- state updates/events;
- reconnect/resume;
- duplicate events;
- out-of-order events;
- stale events;
- connection termination;
- malformed/untrusted messages;
- server-side authorization on mutations.

If WebSockets are selected, implement them behind a clean transport abstraction rather than scattering socket logic through domain services.

If the current runtime cannot safely support the selected transport without deployment infrastructure that does not yet exist, implement the domain/state and transport contract in a testable way and document the deployment dependency rather than provisioning Cloudflare.

Do not couple the core state machine directly to a specific cloud provider.

---

# STEP 8 — RECONNECT / RESUME

A participant or host may disconnect during a live quiz.

Reconnection must not:

- restart the question;
- reset the timer;
- create a second participant identity;
- duplicate an accepted answer;
- bypass admission or authorization;
- expose another session's state.

A reconnecting authorized actor must receive the current authoritative session state and current server-derived timing information.

Use existing BAREA-006 participant/session resume mechanisms where applicable rather than inventing a second identity system.

---

# STEP 9 — EVENT CONTRACT

Create a typed internal/public event contract appropriate for the current architecture.

Events should contain enough information for a future BAREA-008 client to render state without becoming authoritative.

A future client should be able to distinguish events such as:

- session entered live state;
- question opened;
- timer/deadline established;
- answer window closed;
- next question/state transition;
- participant joined/left where product requirements permit exposure;
- quiz completed;
- session closed.

Do not expose sensitive participant identity attributes unnecessarily.

Do not expose scoring/leaderboard information in BAREA-007.

Every event should have sufficient versioning/order information to allow clients to reject stale state.

---

# STEP 10 — RATE LIMITING / ABUSE CONTROLS

Extend existing BAREA rate limiting only where necessary for live mutations.

Preserve the BAREA-006 security lessons:

- no fake IP identity;
- no client-controlled IP;
- no room-code global failure bucket;
- no global anonymous bucket that can create congregation-wide DoS;
- authenticated controls should use server-authoritative identity;
- do not impose a successful-participant-per-IP quota that breaks church NAT use.

Live mutation limits must be designed around authoritative identities and session context, not around a guessed client IP.

Do not introduce a rate limit that allows one anonymous attacker to exhaust the entire congregation's live-session budget.

---

# STEP 11 — PERSISTENCE / RECOVERY

Determine which live state must survive process restart and which state can safely be ephemeral.

At minimum, do not lose the authoritative session lifecycle, current question/deadline, or accepted participant submission state if the product requirements require recovery after restart.

Use transactions for coupled updates.

Do not introduce a second database or external state service merely to implement BAREA-007 unless the repository architecture demonstrates that it is necessary and it can remain deployment-independent.

If an ephemeral transport connection disappears, authoritative state must remain independent of that connection.

---

# STEP 12 — TESTS

Add comprehensive automated tests for BAREA-007.

At minimum test:

### State machine

- valid LOBBY → ACTIVE transition;
- invalid transition attempts;
- ACTIVE → COMPLETED;
- close behavior;
- repeated commands;
- stale state versions;
- concurrent transition behavior.

### Authorization

- correct host can control its session;
- non-host cannot control it;
- authenticated user cannot control another session;
- cross-tenant control fails;
- room code alone is insufficient.

### Timing

- server deadline is authoritative;
- answer before deadline accepted;
- answer after deadline rejected;
- client timestamp cannot extend deadline;
- clock skew cannot extend deadline;
- reconnect receives current deadline.

### Participants

- valid participant can submit during the active window;
- unauthorized participant cannot submit;
- duplicate submission follows deterministic policy;
- participant cannot submit for another participant;
- participant cannot submit to another session;
- teacher-group mode remains account/device-free for pupils.

### Transport

- authorized subscription;
- unauthorized subscription rejected;
- initial state delivery;
- state update delivery;
- reconnect/resume;
- stale event/version handling;
- duplicate/out-of-order event handling;
- malformed messages rejected;
- cross-session isolation.

### Security / abuse

- no client-controlled authorization fields;
- no fabricated IP identity;
- no room-wide anonymous limiter;
- authenticated mutation throttling remains identity-based;
- one session cannot exhaust another session's mutation budget.

Tests must be deterministic and must not depend on real network access or Cloudflare infrastructure.

---

# STEP 13 — CODE QUALITY

Maintain the repository's existing TypeScript standards.

Required checks:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
```

Do not introduce `any` merely to bypass type errors.

Do not suppress compiler errors without a documented architectural reason.

Keep domain logic independent from transport/framework details wherever practical.

---

# STEP 14 — DOCUMENTATION

Update documentation only as necessary to accurately describe BAREA-007.

`docs/ROADMAP.md` must remain:

- BAREA-006 — **COMPLETED — MERGED**
- BAREA-007 — implementation status appropriate to the actual state; do not mark completed until all acceptance criteria pass.

Add/update `docs/DECISIONS.md` for material architecture decisions, particularly:

- chosen live state model;
- authoritative timer model;
- transport choice and rationale;
- reconnect/version semantics;
- concurrency model;
- persistence/recovery boundary.

Preserve historical documentation.

Do not rewrite or truncate `AGY-REPORT.md`.

Append a BAREA-007 implementation report when the milestone is genuinely complete, including:

- files changed;
- architecture decisions;
- state-machine behavior;
- transport choice;
- authorization model;
- timing model;
- reconnect behavior;
- persistence/recovery behavior;
- tests and results;
- security review notes;
- explicit confirmation that BAREA-008/009/010/011 remain outside the implementation.

---

# STEP 15 — GIT WORKFLOW

Create a dedicated implementation branch from current `main` using the repository's normal naming convention, for example:

`barea-007-live-quiz`

Do not implement directly on `main` unless explicitly instructed.

Commit coherent changes with descriptive commit messages.

Do not force-push.

Do not rewrite existing history.

Do not merge the PR automatically.

When implementation is ready, open a PR targeting `main` and report the PR number, branch, head SHA, changed files, tests, and remaining concerns.

---

# BAREA-007 ACCEPTANCE CRITERIA

BAREA-007 is complete only when all of the following are true:

1. A server-authoritative live state machine exists.
2. Host mutations are authenticated and server-authorized.
3. Participant answer submission is authenticated/authorized according to the participation mode.
4. Server time/deadlines determine answer validity.
5. State transitions are concurrency-safe and versioned.
6. A typed realtime transport contract exists and is tested.
7. Reconnect/resume returns authoritative current state without resetting the quiz.
8. Cross-session and cross-tenant isolation is tested.
9. Duplicate/stale/out-of-order requests/events are handled deterministically.
10. BAREA-006 security boundaries remain intact.
11. No scoring/leaderboard implementation has been introduced.
12. No BAREA-008 polished UI has been introduced as part of this milestone.
13. No Cloudflare infrastructure has been provisioned.
14. All required tests/typecheck/build checks pass.
15. Documentation accurately reflects the implementation status.

## FINAL SECURITY REVIEW REQUIREMENT

Before declaring BAREA-007 complete, perform a security-focused self-review specifically looking for:

- IDOR/cross-session authorization;
- cross-tenant access;
- host impersonation;
- participant impersonation;
- replay attacks;
- stale state mutation;
- race conditions;
- timer manipulation;
- client timestamp manipulation;
- unauthorized transport subscriptions;
- event leakage between sessions;
- reconnect authorization bypass;
- duplicate answer acceptance;
- denial-of-service through live mutation flooding;
- client-controlled identity or role fields.

If any such issue is found, fix it before declaring completion.

## STOP CONDITION

When BAREA-007 implementation and tests are complete:

**STOP.**

Do not begin BAREA-008, BAREA-009, BAREA-010, BAREA-011, BAREA-012, or BAREA-013.
Do not provision Cloudflare.
Do not deploy production infrastructure.
Do not merge the PR automatically.

Report the completed implementation and wait for independent ChatGPT review/approval.
