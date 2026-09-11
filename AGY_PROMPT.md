# AGY PROMPT — BAREA-006 FINAL APPLICATION CORRECTION BEFORE MERGE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Current application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Current branch HEAD before this prompt: `45766c1fc7c686c4952e2ef7e97e8715066fbeeb`
PR: #8

## CURRENT DECISION

ChatGPT independently reviewed PR #8 and the actual changed application code.

**Merge: NO-GO for now.**

The BAREA-006 application implementation is substantial and the reported automated verification is strong, but one architectural/security issue remains unresolved:

`resolveServerClientIp()` currently returns the deterministic fallback `127.0.0.1` because real network provenance has intentionally not yet been established. The rate limiter then treats that value as the real client IP. Consequently, all unauthenticated clients can share the same IP bucket. This can create a congregation-wide denial of service against IP-based lookup/flood controls.

This is not acceptable as the final BAREA-006 application behavior.

At the same time, the earlier Cloudflare provisioning requirement is now explicitly DEFERRED. We are finishing the MVP application first and will perform the real Cloudflare deployment/provenance integration later in a fresh environment.

Therefore, **do not provision Cloudflare now** and **do not pretend `127.0.0.1` is a real client IP**.

## PRIMARY OBJECTIVE

Make the smallest secure application-level correction that allows BAREA-006 to be merged without falsely claiming client-IP provenance that has not yet been established.

The implementation must remain compatible with the later Cloudflare integration.

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
10. Do NOT add HMAC, static secret headers, custom edge attestation, Workers, or other cryptographic infrastructure merely to work around the deferred deployment boundary.
11. Do NOT implement BAREA-007.
12. Preserve tenant isolation, authorization, admission policy enforcement, session expiry, error sanitization, persistence integrity, and all existing BAREA-006 behavior unrelated to this correction.

## REQUIRED DESIGN CORRECTION

Redesign the pre-deployment unauthenticated rate-limit identity so that the application does NOT manufacture a false client IP.

The correct behavior before trusted edge provenance exists is:

- A missing/untrusted client-IP signal must be represented explicitly as unavailable/unknown, not as `127.0.0.1`.
- IP-specific rate limits must NOT be applied to an invented shared identity.
- Authenticated user-based limits must continue to operate normally because authenticated `userId` is server-authoritative.
- Room-code validation and collision resistance remain mandatory.
- The public room lookup path must retain a meaningful abuse-control mechanism that does not depend on pretending every caller has the same IP and does not create a congregation-wide kill switch.

### IMPORTANT: choose the simplest defensible mechanism

Inspect the existing BAREA-006 code and tests and select the smallest safe mechanism for pre-deployment MVP operation.

Possible mechanisms may include, if technically appropriate after inspection:

- rate limiting by validated room-code/keyed request characteristics rather than a fabricated IP;
- a narrowly scoped server-side limiter that cannot be exhausted by one caller to block unrelated sessions;
- separating public lookup throttling from authenticated join throttling so authenticated participants do not consume an unsafe shared bucket;
- another simple server-authoritative mechanism that demonstrably avoids the current `127.0.0.1` global-bucket flaw.

Do NOT blindly implement one of these suggestions. Analyze the actual code and choose the minimal mechanism that preserves legitimate church use and materially limits abuse.

If you determine that a safe unauthenticated abuse-control mechanism cannot be implemented without a trusted network identity, **STOP and report that conclusion instead of inventing one**. In that case, document the exact deployment dependency and do not claim merge readiness.

## SERVER CLIENT-IP API

Correct the semantics of `resolveServerClientIp()`.

It must no longer return `127.0.0.1` as if it were a remote caller identity.

Use an explicit representation such as `string | null` (or an equivalent type-safe design) where:

- `string` means an actually trusted server-derived client identity;
- `null` means client IP provenance is not available/trusted in the current deployment.

The current MVP deployment intentionally has no trusted proxy boundary, so normal application requests should resolve to **unknown**, not to a shared fake IP.

Test/development fixtures may continue to provide explicit test values, but they must remain strictly guarded from production and must never be sourced from incoming request headers.

## RATE LIMITER REQUIREMENTS

Preserve the authenticated user limit:

- authenticated join mutation: `1 / 5s / authenticated userId`.

Do NOT preserve the old IP-specific limits merely by feeding them `127.0.0.1`.

For the unauthenticated room lookup/flood path, implement the selected safe pre-deployment mechanism and document precisely:

- what key is used;
- why the key is server-authoritative or otherwise cannot be rotated by a caller to evade the control;
- how legitimate 50+ participant church NAT usage remains possible;
- how one attacker cannot exhaust the mechanism for unrelated legitimate sessions;
- what protection remains deferred until trusted edge provenance exists.

The future Cloudflare deployment will restore true client-IP partitioning once the real trusted edge-to-origin path has been experimentally proven.

## CLOUDflare FUTURE INTEGRATION BOUNDARY

Document this clearly:

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

Do not implement the future path now.

## TESTS REQUIRED

Add or update focused tests for the correction.

At minimum verify:

1. Normal application request without trusted provenance does NOT resolve to `127.0.0.1` as a remote caller identity.
2. Caller-supplied forwarding headers cannot establish client identity.
3. Test-only client-IP overrides remain unavailable in production.
4. Authenticated join throttling remains isolated by authenticated `userId`.
5. The new unauthenticated abuse-control mechanism cannot be exhausted by one caller to block unrelated legitimate sessions.
6. 50+ legitimate participants behind one church NAT can still participate as designed.
7. Room-code validation/collision resistance remains intact.
8. Existing tenant isolation and authorization tests continue to pass.
9. Existing error sanitization and expiry protections continue to pass.
10. No BAREA-007 live state, answer submission, scoring, WebSocket, or SSE behavior is introduced.

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

Do not report only aggregate test counts. Identify the new/changed security tests explicitly.

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

Update the BAREA-006 security report so it no longer claims that `127.0.0.1` is a safe substitute for a real remote client IP.

State explicitly:

- Cloudflare is deferred until MVP completion.
- Real client-IP provenance is not yet available in the current deployment.
- The application does not trust forwarding headers.
- The pre-deployment abuse-control mechanism is intentionally different from the future IP-partitioned mechanism.
- True per-client IP throttling is a deployment integration concern to be verified later.

Do not mark Cloudflare as provisioned, operational, or experimentally verified.

## TWO FRESH REVIEWERS

After implementing the correction and passing all automated checks, ask two fresh independent reviewers to inspect the actual changed code:

### Agent 1 — Security Red Team

Specifically attack:

- fake `127.0.0.1` identity;
- caller-controlled IP/forwarding headers;
- rate-limit bucket hopping;
- one-attacker congregation-wide denial of service;
- church NAT scalability;
- authenticated userId throttling;
- tenant/authorization regressions;
- BAREA-007 boundary.

### Agent 2 — QA / Architecture Reviewer

Verify:

- the new rate-limit semantics;
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
- reviewer verdicts;
- PR #8 updated HEAD.

## STOP CONDITION

After completing the correction:

**DO NOT MERGE. DO NOT START BAREA-007.**

Stop and wait for ChatGPT's independent review of the updated PR.

ChatGPT will decide whether BAREA-006 is safe to merge and, if approved, will authorize the merge.
