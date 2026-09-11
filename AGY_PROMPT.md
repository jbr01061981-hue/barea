# AGY PROMPT — BAREA-006 FINAL CORRECTION BEFORE MERGE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
PR: `#8`

## CURRENT DECISION

**MERGE: NO-GO until this final narrow correction is completed and independently reviewed.**

The exact-room DoS caused by the shared room-code failure bucket has been correctly removed. Do not reintroduce it.

The remaining issue is that the current pre-deployment application has no trusted client-IP provenance. Do not invent one. Do not add another shared anonymous limiter that can become a denial-of-service mechanism.

## OBJECTIVE — KEEP THIS SIMPLE

Make the **smallest defensible final BAREA-006 design** for unauthenticated public room lookup.

Preferred outcome if the existing application cannot provide a trustworthy per-caller anonymous identity:

- `resolveServerClientIp()` remains `string | null` and returns `null` in normal MVP runtime.
- No IP-based anonymous limiter runs when IP is `null`.
- No room-code failure bucket.
- No global anonymous bucket.
- No fake `127.0.0.1` identity.
- No caller-supplied identity.
- No HMAC/custom attestation/Workers/Cloudflare now.
- Keep authenticated join throttling by server-authoritative `userId`.
- Keep room-code validation, session expiry, admission authorization, tenant isolation and error sanitization.
- Document honestly that broad anonymous flood protection is a deployment concern to be enabled only after trusted Cloudflare client-IP provenance is verified.

**Do NOT invent a cookie/token system unless the actual `/join` flow already has a server-issued identity that can safely support this.** A cookie that an attacker can freely clear/replace is not a trustworthy per-caller identity and must not be presented as solving the threat.

If the existing code has no trustworthy anonymous per-caller identity, STOP trying to manufacture one. The secure answer is to leave IP-specific anonymous limiting disabled until deployment provides trusted provenance, while preserving authenticated/user-level controls and all other BAREA-006 protections.

## NON-NEGOTIABLE

1. No Cloudflare/Tunnel/Workers/DNS provisioning now.
2. No forwarding-header trust: `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, `X-Barea-*`, etc.
3. No fake IP or constant fallback identity.
4. No room-code keyed failure bucket.
5. No global unauthenticated bucket.
6. No successful-participant-per-IP quota.
7. No client-controlled limiter key.
8. Authenticated join throttling remains server-authoritative `userId` based.
9. Church NAT with 50+ legitimate participants must remain viable.
10. No BAREA-007 functionality.
11. Do not weaken authorization, admission policy, tenant isolation, expiry or error sanitization.

## REQUIRED INSPECTION

Inspect the actual current code before changing anything:

- `src/app/session/actions.ts`
- `src/app/teacher/review/db.ts`
- `src/service/session-service.ts`
- `src/service/rate-limiter.ts`
- `test/session-share-join.test.ts`

Trace the real lookup and join path.

Determine whether an existing server-issued, non-user-controlled anonymous identity actually exists. If not, do not create a fake security boundary. Keep anonymous IP limiting disabled for `null` and document the limitation.

## REQUIRED SECURITY TESTS

Ensure tests prove:

1. `resolveServerClientIp()` returns `null` without trusted provenance, never `127.0.0.1`.
2. Forwarding headers cannot establish client identity.
3. Test-only IP overrides remain production-guarded.
4. Exact-room attack cannot block legitimate lookup of that same room.
5. Cross-room attack cannot block another room.
6. There is no global unauthenticated limiter.
7. There is no room-code shared failure bucket.
8. 50+ church-NAT participants can perform the designed flow without a successful-participant-per-IP quota.
9. Authenticated users remain independently throttled by `userId`.
10. Tenant isolation, restricted admission, expiry, error sanitization and room-code validation remain intact.
11. No BAREA-007 live transport/state/answer/scoring behavior exists.

If anonymous limiting is disabled because provenance is unavailable, test that behavior explicitly. Do not manufacture an artificial DoS test around a limiter that should not exist.

## REQUIRED VERIFICATION

Run:

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

## DOCUMENTATION

Update the BAREA-006 report accurately:

- Cloudflare is deferred until MVP completion.
- Current deployment has no trusted client-IP provenance.
- Forwarding headers are untrusted.
- No fabricated IP identity is used.
- No room-code or global anonymous failure bucket exists.
- Authenticated abuse control remains userId based.
- Broad per-client IP/subnet anonymous flood protection is intentionally deferred until the real deployment boundary is established and experimentally verified.

Do not claim Cloudflare is provisioned or verified.

## TWO FRESH REVIEWERS

Use exactly two fresh independent reviewers after the correction:

### Security Red Team

Focus on exact-room DoS, cross-room DoS, fake IP, forwarding headers, client-controlled keys, global buckets, church NAT, authenticated userId throttling, tenant isolation and BAREA-007 quarantine.

### QA / Architecture

Verify actual production lookup-path behavior, tests, type safety, absence of unrelated changes, church-NAT scalability and future Cloudflare compatibility.

Both must provide explicit GO/NO-GO findings with concrete evidence.

## GIT / STOP

Remain on `barea-006-share-join` and update PR #8. Do not create another PR. Do not merge. Do not start BAREA-007. Do not provision Cloudflare.

Report the commit SHA, changed files, final design, tests, reviewer verdicts and PR HEAD.

**STOP after the report. ChatGPT will independently inspect the actual PR and give the final merge decision.**
