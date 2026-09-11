# AGY PROMPT — BAREA-006 FINAL APPLICATION CORRECTION BEFORE MERGE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
PR: #8

## CURRENT DECISION

ChatGPT independently reviewed the updated BAREA-006 application correction at commit `205868e`.

**Merge: NO-GO for now.**

The previous correction correctly eliminated the fabricated `127.0.0.1` client identity and changed unavailable client IP provenance to `null`. That part is accepted.

However, the new unauthenticated lookup abuse-control mechanism is keyed by the **target room code**. This creates a remaining denial-of-service boundary:

> An attacker who knows the room code of a legitimate active session can deliberately generate failed lookup attempts for that exact room code and exhaust the shared per-room failure bucket, potentially blocking legitimate users from accessing that session.

The current evidence that attacking `222222` does not block an unrelated legitimate room is insufficient. The security property that must be demonstrated is stronger: **an attacker must not be able to exhaust the lookup/admission control for a legitimate room merely by knowing or targeting its room code.**

This is a material BAREA-006 blocker.

Cloudflare remains explicitly deferred until MVP completion. Do not provision infrastructure now.

## PRIMARY OBJECTIVE

Make the smallest secure application-level correction that removes the per-room denial-of-service weakness without restoring fake client IP provenance and without creating a new congregation-wide shared limiter.

Do not redesign unrelated BAREA-006 functionality.

## NON-NEGOTIABLE RULES

1. Do NOT provision Cloudflare, Cloudflare Tunnel, Workers, DNS, or production infrastructure now.
2. Do NOT restore a caller-supplied `clientIp` parameter.
3. Do NOT trust `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, `X-Barea-*`, or any other incoming forwarding header in the current application deployment.
4. Do NOT treat `127.0.0.1` as the actual identity of every remote client.
5. Do NOT claim that environment variables establish network provenance.
6. Do NOT weaken authenticated participant throttling: authenticated join throttling must remain keyed by server-authoritative authenticated `userId`.
7. Do NOT introduce a successful-participant-per-IP quota.
8. Church NAT scalability must remain intact.
9. Do NOT introduce a new global unauthenticated rate-limit bucket that can be exhausted by one attacker and thereby block the entire congregation.
10. Do NOT replace the per-room bucket with another attacker-shareable key that allows one caller to exhaust protection for an unrelated legitimate participant/session.
11. Do NOT add HMAC, static secret headers, custom edge attestation, Workers, or other cryptographic infrastructure merely to work around the deferred deployment boundary.
12. Do NOT implement BAREA-007.
13. Preserve tenant isolation, authorization, admission policy enforcement, session expiry, error sanitization, persistence integrity, and all existing BAREA-006 behavior unrelated to this correction.

## REQUIRED DESIGN CORRECTION

Remove or redesign the current **shared per-room failed-lookup limiter** so that knowledge of a legitimate room code cannot itself become a denial-of-service capability.

The corrected pre-deployment behavior must satisfy all of these properties:

- Missing/untrusted client IP remains explicitly unavailable (`null` or equivalent), never a fabricated address.
- Caller-controlled forwarding headers remain untrusted.
- No global unauthenticated bucket exists.
- No shared per-room failure bucket can be exhausted by an attacker to block legitimate access to that room.
- Authenticated join throttling remains keyed by server-authoritative `userId`.
- 50+ legitimate participants behind one church NAT remain able to participate.
- An attacker targeting one room cannot consume the same abuse-control budget used by unrelated legitimate sessions.
- The mechanism must remain server-authoritative and must not depend on a caller-selected arbitrary identifier.

### IMPORTANT: inspect the actual application flow before choosing the mechanism

Do not blindly implement another guessed key.

Trace the actual BAREA-006 flow through:

- `src/app/session/actions.ts`
- `src/service/session-service.ts`
- `src/service/rate-limiter.ts`
- `src/app/teacher/review/db.ts`
- the existing BAREA-006 tests

Determine exactly what constitutes:

1. room-code validation;
2. failed lookup;
3. successful public session lookup;
4. authenticated join;
5. admission authorization;
6. rate-limit state mutation.

Then choose the **smallest defensible pre-deployment design**.

A viable design may, for example, use a server-generated/request-derived control mechanism that does not create a shared budget for a target room, or may reduce the unauthenticated lookup limiter to a narrowly scoped mechanism that cannot deny legitimate sessions. These are examples only; select the design based on the actual code and threat model.

Do NOT use a room code itself as the shared failure-budget key if doing so permits the exact-room DoS described above.

If no safe unauthenticated abuse-control mechanism can be implemented without a trusted network identity or another server-authoritative per-caller identity, **STOP and report that conclusion instead of inventing a weak substitute**. In that case, document the exact deployment dependency and do not claim merge readiness.

## SERVER CLIENT-IP API

Keep the corrected semantics from the previous task.

`resolveServerClientIp()` must represent unavailable provenance explicitly, such as `Promise<string | null>`:

- `string` means an actually trusted server-derived client identity;
- `null` means client IP provenance is not available/trusted in the current deployment.

Normal MVP requests must resolve to unknown, not `127.0.0.1`.

Test/development fixtures may continue to provide explicit test values, but they must remain strictly guarded from production and must never be sourced from incoming request headers.

## RATE LIMITER REQUIREMENTS

Preserve:

- authenticated join mutation: `1 / 5s / authenticated userId`.

Do NOT feed fake IPs into IP-specific limiters.

For public unauthenticated room lookup, the corrected mechanism must be evaluated against these adversarial cases:

### Exact-room attack

One attacker knows the legitimate room code and repeatedly causes failed lookup attempts against that exact code.

**Required result:** the attacker cannot exhaust a shared budget that prevents legitimate participants from looking up/accessing that session.

### Cross-room attack

One attacker attacks room A repeatedly.

**Required result:** legitimate access to unrelated room B remains unaffected.

### Church NAT

At least 50 legitimate participants share one public NAT address.

**Required result:** legitimate participants remain able to perform the designed lookup/join flow; no successful-participant-per-IP quota is introduced.

### Bucket hopping

An attacker varies any caller-controlled room code, header, query parameter, cookie, or other arbitrary identifier available to evade the selected limiter.

**Required result:** the mechanism is not trivially defeated by attacker-controlled key rotation.

Document precisely:

- what key/state is used;
- where it is generated or derived;
- why the attacker cannot select/rotate it to evade the control;
- why one attacker cannot consume protection for unrelated legitimate sessions;
- what abuse protection remains deferred until trusted edge provenance exists.

## FUTURE CLOUDFLARE BOUNDARY

Keep this architectural boundary unchanged:

```text
CURRENT MVP
public request
    -> Next.js application
    -> no trusted proxy provenance
    -> client IP = unavailable/unknown

FUTURE DEPLOYMENT
real client
    -> Cloudflare Edge
    -> trusted/private origin boundary
    -> experimentally verified client-IP metadata
    -> resolveServerClientIp()
    -> IP-based rate limiter
```

Do not implement the future Cloudflare path now.

## REQUIRED TESTS

Add or update focused adversarial tests. At minimum verify:

1. Normal application request without trusted provenance does NOT resolve to `127.0.0.1` as a remote caller identity.
2. Caller-supplied forwarding headers cannot establish client identity.
3. Test-only client-IP overrides remain unavailable in production.
4. Authenticated join throttling remains isolated by authenticated `userId`.
5. **Exact-room DoS test:** repeated failed lookup attempts targeting the exact legitimate room code cannot exhaust a shared budget that blocks legitimate lookup/access to that same session.
6. Cross-room isolation: attacking room A cannot block legitimate room B.
7. Bucket/key rotation by attacker-controlled input does not trivially evade the selected control.
8. 50+ legitimate participants behind one church NAT can still participate as designed.
9. Room-code validation/collision resistance remains intact.
10. Existing tenant isolation and authorization tests continue to pass.
11. Existing error sanitization and expiry protections continue to pass.
12. No BAREA-007 live state, answer submission, scoring, WebSocket, or SSE behavior is introduced.

The exact-room test is mandatory. A test that only attacks a nonexistent/random room is not sufficient evidence for merge.

## REQUIRED VERIFICATION

Run all of:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
git status
git diff
```

All must pass.

Do not report only aggregate test counts. Identify the exact-room DoS test and other new/changed security tests explicitly.

## CODE SCOPE

Keep the change narrowly focused.

Expected files are likely limited to:

- `src/app/teacher/review/db.ts`
- `src/service/rate-limiter.ts`
- `src/service/session-service.ts`
- `src/app/session/actions.ts`
- focused BAREA-006 tests
- relevant security documentation/report if needed

Do not modify unrelated quiz/question/teacher-authoring code.

## DOCUMENTATION

Update the BAREA-006 security report to describe the final pre-deployment abuse-control model accurately.

State explicitly:

- Cloudflare is deferred until MVP completion.
- Real client-IP provenance is not yet available in the current deployment.
- The application does not trust forwarding headers.
- The pre-deployment abuse-control mechanism does not use a fabricated IP.
- The pre-deployment mechanism cannot be exhausted by one attacker to block a legitimate room.
- True per-client IP throttling remains a later deployment integration concern to be experimentally verified.

Do not mark Cloudflare as provisioned, operational, or experimentally verified.

## TWO FRESH REVIEWERS

After implementing the correction and passing all automated checks, ask two fresh independent reviewers to inspect the actual changed code.

### Agent 1 — Security Red Team

Specifically attack:

- fake `127.0.0.1` identity;
- caller-controlled IP/forwarding headers;
- exact-room denial of service;
- cross-room denial of service;
- rate-limit bucket hopping;
- one-attacker congregation-wide denial of service;
- church NAT scalability;
- authenticated userId throttling;
- tenant/authorization regressions;
- BAREA-007 boundary.

The reviewer must explicitly test or reason about an attacker who knows a legitimate room code and repeatedly submits failed lookup attempts against that exact room.

### Agent 2 — QA / Architecture Reviewer

Verify:

- the new rate-limit semantics;
- exact-room isolation;
- cross-room isolation;
- 50+ participant behavior;
- test coverage;
- type safety;
- compatibility with later Cloudflare integration;
- absence of unrelated changes.

Both reviewers must provide explicit GO/NO-GO findings with concrete evidence.

## GIT RULES

Remain on `barea-006-share-join`.

Do not merge PR #8 yourself.
Do not start BAREA-007.
Do not provision Cloudflare.
Do not commit secrets.
Do not make unrelated changes.

Commit the correction, push it, and report:

- new commit SHA;
- changed files;
- test results;
- exact-room adversarial test result;
- reviewer verdicts;
- PR #8 updated HEAD.

## STOP CONDITION

After completing the correction:

**DO NOT MERGE. DO NOT START BAREA-007.**

Stop and wait for ChatGPT's independent review of the updated PR.

ChatGPT will independently inspect the actual updated code and decide whether BAREA-006 is safe to merge.
