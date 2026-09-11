# AGY PROMPT — BAREA-006 EXACT-ROOM ABUSE-CONTROL CORRECTION

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
PR: `#8`
Current application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Current correction head: `d43ef0f`

## CURRENT DECISION

ChatGPT independently reviewed PR #8 at `d43ef0f` and found a remaining release blocker.

**MERGE: NO-GO FOR NOW.**

The previous correction correctly removed the fabricated `127.0.0.1` client identity and the shared per-room failure bucket. However, that correction now leaves unauthenticated public room lookup without a meaningful pre-deployment abuse-control mechanism when client-IP provenance is unavailable.

The next correction must address that gap without restoring either of the two rejected designs:

- no fake universal IP identity;
- no shared per-room failure budget.

## PRIMARY OBJECTIVE

Design and implement the **smallest defensible pre-deployment abuse-control mechanism** for unauthenticated public room lookup that:

1. does not invent a client IP;
2. does not trust caller-supplied forwarding headers;
3. does not use the target room code as a shared limiter key;
4. cannot be exhausted by one attacker to block legitimate access to the targeted room;
5. cannot be exhausted by one attacker to create a congregation-wide denial of service;
6. remains bounded in memory/resource use;
7. preserves 50+ church-NAT participation;
8. preserves authenticated `userId` throttling;
9. remains compatible with future Cloudflare client-IP provenance;
10. does not introduce BAREA-007 behavior.

## NON-NEGOTIABLE RULES

1. Do NOT provision Cloudflare, Cloudflare Tunnel, Workers, DNS, or production infrastructure now.
2. Do NOT restore a caller-supplied `clientIp` parameter.
3. Do NOT trust `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, `X-Barea-*`, or arbitrary forwarding headers in the current deployment.
4. Do NOT use `127.0.0.1` or another constant as the identity of all remote callers.
5. Do NOT restore `roomCodeFailedLookups` or any equivalent target-room shared failure bucket.
6. Do NOT create a new global unauthenticated bucket shared across the congregation/deployment.
7. Do NOT create a limiter keyed solely by room/session code.
8. Do NOT impose a successful-participant-per-IP quota.
9. Do NOT weaken authenticated join throttling keyed by server-authoritative `userId`.
10. Do NOT add HMAC, custom attestation, static secret headers, Workers, or deployment-specific cryptographic machinery solely to solve this pre-deployment issue.
11. Do NOT implement BAREA-007.
12. Preserve tenant isolation, authorization, admission policy enforcement, session expiry, error sanitization, persistence integrity, and unrelated BAREA-006 functionality.

## REQUIRED INVESTIGATION BEFORE EDITING

Inspect the actual current implementation and trace:

`lookupRoomAction -> resolveServerClientIp -> SessionService.getPublicInfo -> RateLimiter -> repository`

Inspect:

- `src/app/session/actions.ts`
- `src/app/teacher/review/db.ts`
- `src/service/session-service.ts`
- `src/service/rate-limiter.ts`
- `test/session-share-join.test.ts`

Also inspect the actual browser `/join` entry flow and determine whether BAREA already has an appropriate server-issued session/device identifier that can be used as an abuse-control identity.

Do not assume a cookie, token, or session identifier exists. Verify it.

## DESIGN REQUIREMENTS

The selected mechanism must distinguish **abuse-control identity** from **authentication identity**.

It must NOT become authentication or authorization.

A promising direction, if supported by the actual application flow, is a **server-issued ephemeral anonymous abuse-control token**:

```text
/join page request
   -> server creates random opaque anti-abuse identifier
   -> identifier stored in server-set cookie
   -> public room lookup keyed by that server-issued identifier
   -> identifier expires and is bounded/evicted
```

But this is only a candidate. Do not implement it blindly.

Before choosing any design, explicitly analyze:

- attacker clearing/replacing cookies;
- attacker opening many tabs/devices;
- attacker creating unlimited fresh identities;
- token theft/replay;
- shared church devices;
- multiple people sharing a NAT;
- memory exhaustion;
- state eviction;
- anonymous identity rotation;
- whether authenticated users should stop using anonymous abuse controls after authentication;
- failure behavior when the limiter store is full/unavailable;
- whether a bounded secondary control is possible without creating a global congregation-wide kill switch.

If you conclude that no safe pre-deployment mechanism can be implemented without a trusted network identity or equivalent server-authoritative caller identity, **STOP and report that conclusion**. Do not manufacture a false guarantee.

## CORE SECURITY PROPERTY

The security property is NOT merely “room A does not block room B.”

The required property is:

> **An attacker who knows a legitimate room code must not be able to consume a shared abuse-control budget and thereby prevent a legitimate participant from accessing that same room.**

Therefore, the attack scenario must be explicitly tested:

```text
attacker knows LEGITIMATE_ROOM_CODE
        |
        +--> repeated failed/abusive lookup requests
        |
        +--> legitimate participant then looks up LEGITIMATE_ROOM_CODE

REQUIRED: legitimate lookup remains available.
```

## RATE-LIMITER REQUIREMENTS

### Client IP semantics

Keep:

```ts
resolveServerClientIp(): Promise<string | null>
```

where:

- `string` means genuinely trusted server-derived provenance;
- `null` means unavailable/untrusted provenance.

Normal MVP runtime must resolve to `null` until the future Cloudflare deployment proves a trusted client-IP path.

### Authenticated path

Keep authenticated join throttling isolated by server-authoritative user identity:

- `checkJoinMutation(userId)` = existing approved `1 / 5s` (or explicitly documented equivalent).

### Unauthenticated lookup path

The pre-deployment mechanism must:

- not use fake IP identity;
- not use target room code as a shared budget;
- not use a global anonymous bucket;
- prevent one attacker from consuming the same budget as a legitimate unrelated caller/session;
- remain bounded and evictable;
- clearly document what abuse protection is deferred to the future Cloudflare deployment.

## BOUNDED RESOURCE REQUIREMENTS

If you introduce anonymous abuse-control state, define exact limits.

For example, document:

- maximum active identities;
- maximum entries per identity;
- expiry duration;
- cleanup/eviction policy;
- behavior when capacity is reached;
- whether requests without an abuse-control token are allowed, throttled, or rejected;
- why capacity exhaustion cannot become a global denial-of-service primitive.

Do not implement unbounded `Map` growth.

## TESTS REQUIRED

Add/update focused adversarial tests using the actual production services.

At minimum:

### `ADV-SJ-NEW-01` — Exact-room DoS isolation

An attacker repeatedly targets the **exact room code of a legitimate active session**.

Prove that legitimate lookup/access to that same session remains available.

### `ADV-SJ-NEW-02` — Cross-room isolation

Attack room A repeatedly.

Prove legitimate room B remains available.

### `ADV-SJ-NEW-03` — No fake IP

Without trusted provenance, `resolveServerClientIp()` returns `null`, never `127.0.0.1`.

### `ADV-SJ-NEW-04` — Header spoof resistance

Caller-controlled `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, `X-Barea-*` cannot establish or rotate abuse-control identity.

### `ADV-SJ-NEW-05` — Identity rotation resistance

A caller must not be able to trivially create unlimited fresh abuse-control identities to bypass every limit.

Test cookie clearing/replacement or equivalent identity rotation as applicable to the chosen mechanism.

### `ADV-SJ-NEW-06` — Bounded memory/state

Repeated anonymous activity cannot grow the limiter state without bound.

Verify eviction/expiry and a defined capacity limit.

### `ADV-SJ-NEW-07` — Church NAT scalability

At least 50 legitimate participants using one church NAT must be able to use the designed flow without a successful-participant-per-IP quota.

### `ADV-SJ-NEW-08` — Authenticated user throttling

Two different authenticated users remain independently throttled by `userId`.

### `ADV-SJ-NEW-09` — Limiter exhaustion behavior

Force the anonymous limiter to its capacity and prove it does not create a hidden congregation-wide kill switch or block unrelated legitimate sessions.

### `ADV-SJ-NEW-10` — Existing security regressions

Tenant isolation, restricted admission, session expiry, error sanitization, room-code validation, and BAREA-007 quarantine all remain intact.

The exact-room DoS test is mandatory. A random/nonexistent room test alone is insufficient.

## IMPORTANT TEST QUALITY RULE

Do not build a test around an invented cookie/token abstraction that is not present in the real application path.

If a server-issued anonymous identity is selected, the test must exercise the actual mechanism through the real `/join`/Server Action flow or an explicitly documented equivalent server entry point.

Do not claim production-path coverage if the test bypasses the mechanism under review.

## IMPLEMENTATION SCOPE

Keep changes narrow and type-safe.

Likely files:

- `src/app/teacher/review/db.ts`
- `src/app/session/actions.ts`
- `src/service/session-service.ts`
- `src/service/rate-limiter.ts`
- focused BAREA-006 tests
- relevant security documentation/report

Do not modify unrelated BAREA-001 through BAREA-005 application behavior.

## FUTURE CLOUDFLARE BOUNDARY

Keep the deployment distinction explicit:

```text
CURRENT MVP
public request
    -> BAREA application
    -> client-IP provenance unavailable
    -> bounded pre-deployment abuse-control identity

FUTURE MVP DEPLOYMENT
real client
    -> Cloudflare Edge
    -> trusted deployment boundary
    -> experimentally verified client-IP metadata
    -> resolveServerClientIp()
    -> IP/subnet rate limiting
```

Do not implement the future Cloudflare path now.

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

Report exact test counts and explicitly name the new adversarial tests.

## TWO FRESH INDEPENDENT REVIEWERS

After implementation, invoke **exactly two** fresh independent subagents.

### Agent 1 — Security Red Team

Attack:

- exact-room DoS;
- cross-room DoS;
- fake IP identity;
- forwarding-header spoofing;
- cookie/token rotation;
- unlimited anonymous identity creation;
- memory/state exhaustion;
- church NAT behavior;
- authenticated user throttling;
- tenant isolation;
- BAREA-007 boundary.

### Agent 2 — QA / Architecture Reviewer

Verify:

- actual lookup-path integration;
- bounded state and eviction;
- deterministic tests;
- exact-room isolation;
- 50+ participant behavior;
- type safety;
- future Cloudflare compatibility;
- absence of unrelated changes.

Both reviewers must give explicit GO/NO-GO findings with concrete evidence.

## GIT RULES

Remain on `barea-006-share-join`.

Update PR #8.

Do NOT create a new PR.
Do NOT merge PR #8 yourself.
Do NOT start BAREA-007.
Do NOT provision Cloudflare.
Do NOT commit secrets.
Do NOT modify unrelated milestones.

Commit and push the correction, then report:

- new commit SHA;
- changed files;
- exact design selected;
- exact security rationale;
- exact-room adversarial result;
- bounded-state/eviction evidence;
- full verification results;
- two fresh reviewer verdicts;
- PR #8 updated HEAD.

## STOP CONDITION

After completing the correction:

**DO NOT MERGE. DO NOT START BAREA-007. DO NOT PROVISION CLOUDFLARE.**

Stop and wait for ChatGPT's independent review of the updated PR.

ChatGPT will independently inspect the actual implementation and decide whether BAREA-006 is safe to merge.