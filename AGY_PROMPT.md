# AGY PROMPT — BAREA-006 FINAL RATE-LIMIT IDENTITY ARCHITECTURE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Current head under review: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`

## Current authorization

**NO-GO — DO NOT MERGE `eb8d416`.**

The previous IP-provenance blocker was correctly fixed by completely ignoring caller-controlled forwarding headers. However, the resulting hard-coded `127.0.0.1` identity collapses all unauthenticated clients into one global rate-limit bucket.

This is now the SINGLE remaining architectural blocker.

## Architectural finding

`resolveServerClientIp()` currently returns `127.0.0.1` for production requests and therefore all unauthenticated clients share the same IP bucket.

That defeats BAREA's church-scale requirement. One attacker can exhaust the IP-based room-lookup/unauthenticated request limits for the entire congregation.

Do NOT solve this by restoring blind trust in:

- `CF-Connecting-IP`
- `X-Forwarded-For`
- `X-Real-IP`
- `BAREA_TRUSTED_PROXY` alone
- any client-supplied `clientIp` parameter

## Architectural decision

**PREFERRED PRODUCTION ARCHITECTURE: OPTION 1 — ENFORCED EDGE/REVERSE-PROXY TRUST BOUNDARY.**

BAREA should establish a real deployment boundary in which the public application is reachable only through a trusted edge/reverse proxy and the origin is not directly reachable by untrusted clients.

The preferred design is:

```text
Internet client
      |
      v
Trusted edge / reverse proxy
      |
      |  strips/replaces client-IP headers
      |  adds authenticated proxy attestation
      v
BAREA origin / Next.js
```

The proxy-to-origin connection must be protected by an independently managed secret or mTLS/network isolation. The application must accept forwarded client identity ONLY after authenticating the proxy boundary.

### IMPORTANT

A shared secret header is useful only if the deployment actually prevents an attacker from reaching the origin and supplying that header themselves.

Therefore:

**Proxy secret alone is NOT sufficient if the Next.js origin remains publicly reachable.**

The implementation must document and test the actual deployment invariant:

> An untrusted Internet client cannot reach the BAREA origin directly; only the trusted proxy can reach it.

If this invariant cannot be guaranteed by the current deployment, do NOT pretend Option 1 is implemented in application code.

## Option 2 assessment

Do NOT replace the IP identity with only a signed client cookie as the primary abuse-control solution.

A cryptographically signed cookie is server-authoritative, but an attacker can clear/reject/reset cookies and obtain another identity. It is useful as an additional abuse-control signal, but it does not by itself provide the same network-level boundary as a protected origin.

It may be considered as a SECONDARY layer later, but it is not the required fix for this milestone unless a complete abuse-control design is explicitly justified and reviewed.

## Option 3 assessment

Do not simply declare the IP-based lookup protection out of scope.

The room lookup endpoint is the unauthenticated attack surface that needs abuse control. The six-character room code space does not eliminate the need for throttling.

Keep the existing lookup throttling, but give it a trustworthy per-client identity.

## Required implementation path

### Step 1 — Inspect deployment/runtime configuration

Inspect the repository for:

- deployment configuration
- Docker/container configuration
- hosting configuration
- reverse proxy configuration
- nginx/Caddy/Traefik configuration if present
- Vercel/Cloudflare/AWS/GCP configuration if present
- environment variable documentation
- Next.js runtime configuration
- CI/CD deployment configuration

Determine whether BAREA currently has an enforceable trusted edge/origin boundary.

### Step 2 — If a real boundary already exists

Use the authoritative platform/runtime identity exposed by that boundary.

The application may consume a proxy-provided client IP only after the proxy boundary has been authenticated and direct origin access is prevented.

Prefer a framework/platform-provided authoritative request identity when available.

Do not infer provenance from a header merely because its syntax is valid.

### Step 3 — If no real boundary exists

STOP before implementing a fake one.

Report exactly what deployment infrastructure is missing.

Do NOT restore forwarding-header trust.

Do NOT use `127.0.0.1` as though it were a real per-client identity and claim that church-scale IP throttling is preserved.

Do NOT invent socket APIs that Next.js Server Actions do not expose.

In this case, propose the smallest deployment-level change required to create the trusted boundary and STOP for ChatGPT review before changing application behavior.

## Option 1 concrete security requirements

If implementation is authorized after inspecting the repository:

1. Public traffic reaches the trusted edge.
2. Edge strips any incoming client-IP/proxy-attestation headers from the Internet client.
3. Edge derives the real client address from its own connection context.
4. Edge writes the canonical client-IP header.
5. Edge authenticates itself to the origin using mTLS, a secret unavailable to Internet clients, or equivalent enforced network identity.
6. Origin accepts the canonical client-IP header only after authenticating the proxy boundary.
7. Direct Internet access to the origin is blocked by firewall/security-group/network policy or equivalent platform enforcement.
8. Requests failing the proxy boundary are rejected or assigned a quarantined identity that cannot collide with authenticated proxy traffic.
9. The application never accepts a caller-selected IP parameter.

If a proxy secret is used, compare it using a constant-time mechanism where practical and keep it server-side only.

## Do not over-engineer

Do not introduce cryptographic protocol machinery inside BAREA if the hosting platform already provides a secure trusted proxy boundary.

Do not build a custom proxy server inside the application.

Do not modify unrelated BAREA features.

## Rate-limit requirements

After the correction:

- independent legitimate clients must receive independent rate-limit identities;
- rotating spoofed forwarding headers must not create new identities;
- direct origin attackers must not impersonate proxied clients;
- church NAT must NOT create a participant seat quota;
- authenticated participant join throttling remains keyed by authenticated `userId`;
- room lookup throttling remains enabled;
- subnet containment remains enabled where applicable;
- one attacker must not be able to exhaust the global lookup bucket for the congregation merely because the fallback is `127.0.0.1`.

## Mandatory adversarial tests

If Option 1 is implemented, tests must demonstrate:

### Direct attacker

A direct origin request containing arbitrary:

- `CF-Connecting-IP`
- `X-Forwarded-For`
- `X-Real-IP`
- proxy secret/attestation

cannot select an arbitrary client identity.

### Spoofed proxy secret

A caller who does not possess the real proxy credential cannot enter the trusted-proxy path.

### Trusted proxy

A request arriving through the authenticated proxy boundary resolves to the client identity supplied by the trusted proxy.

### Header replacement

A client-supplied forwarding header reaching the edge is stripped/replaced rather than preserved.

### Bucket isolation

Two legitimate proxied client identities produce separate rate-limit buckets.

### Bucket hopping

One attacker changing forwarding headers cannot hop buckets.

### Origin bypass

A direct request to the origin is blocked/rejected by the documented deployment boundary. This test must be deployment/integration-level where practical; a unit test that merely sets an environment variable is insufficient.

### NAT scalability

At least 50 legitimate participants behind one church NAT can participate without per-IP participant seat quotas or accidental participant-wide throttling.

## If deployment boundary cannot be implemented now

The correct result is **STOP / NO-GO**, with an explicit infrastructure requirement for the production deployment.

Do not manufacture an application-only solution and do not weaken the security invariant merely to obtain a passing test suite.

## Preserve existing protections

Do not regress:

- generic unexpected-error response and server-side error logging;
- tenant isolation and authorization;
- personal workspace Option A isolated tenant mapping;
- authenticated participant rate limiting;
- room lookup throttling;
- BAREA-006 admission boundaries;
- lazy session expiry protections;
- SQLite transaction/tenant protections;
- BAREA-007 quarantine.

Do NOT:

- restore client-supplied `clientIp`;
- trust forwarding headers without an authenticated deployment boundary;
- trust `BAREA_TRUSTED_PROXY` merely because it is configured;
- remove rate limiting;
- reintroduce anonymous nickname admission;
- introduce client-selected tenant identity;
- weaken authentication or authorization;
- start BAREA-007;
- make unrelated changes;
- self-merge.

## Verification

After any authorized implementation run:

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

Report actual results only.

## Two-agent review

Only after implementation, run exactly two fresh independent reviewers:

### Agent 1 — Security + Architecture Red Team

Verify:

- actual proxy/origin trust boundary;
- direct-origin bypass resistance;
- proxy authentication;
- forwarding-header replacement;
- client identity provenance;
- bucket hopping resistance;
- NAT scalability;
- test-hook isolation;
- error sanitization;
- tenant/authorization boundaries;
- BAREA-007 quarantine.

### Agent 2 — Persistence + QA / Implementability Reviewer

Verify:

- action → identity resolution → service → rate limiter integration;
- realistic deployment behavior;
- legitimate proxied clients receive distinct identities;
- direct attackers cannot choose identities;
- NAT scalability;
- authenticated rate limiting;
- session persistence/expiry;
- error sanitization;
- complete tests/typecheck/builds.

Both must issue explicit GO/NO-GO verdicts. Never manufacture unanimous approval.

## Git / merge rules

Remain on:

`barea-006-share-join`

Commit only the required correction with a clear security-focused message and push to:

`origin/barea-006-share-join`

**DO NOT MERGE.**
**DO NOT SELF-MERGE.**
**DO NOT START BAREA-007.**

After implementation and fresh two-agent review, STOP and wait for ChatGPT's independent security re-review and explicit merge authorization.

## Final report

Report:

### Architecture decision
- current deployment model
- whether an actual trusted edge/origin boundary exists
- chosen architecture
- why it establishes provenance
- exact infrastructure assumptions

### Remediation
- previous commit
- new commit
- exact files changed
- actual client-identity resolution path

### Security
- direct origin spoofing: PASS/FAIL
- proxy authentication: PASS/FAIL
- header replacement: PASS/FAIL
- trusted proxy identity: PASS/FAIL
- bucket hopping: PASS/FAIL
- independent client bucket isolation: PASS/FAIL
- origin bypass: PASS/FAIL
- NAT scalability: PASS/FAIL

### Existing protections
- authenticated participant rate limiting: PASS/FAIL
- room lookup throttling: PASS/FAIL
- Finding 2 error disclosure: PASS/FAIL
- tenant/authorization regression: PASS/FAIL
- BAREA-007 quarantine: PASS/FAIL

### Verification
- targeted security tests: PASS/FAIL
- full suite: PASS/FAIL
- typecheck: PASS/FAIL
- build: PASS/FAIL
- build:next: PASS/FAIL
- `git grep ": any" -- src/`: PASS/FAIL
- `git diff --check`: PASS/FAIL

### Two-agent review
- Agent 1 Security + Architecture Red Team: GO/NO-GO + findings
- Agent 2 Persistence + QA / Implementability Reviewer: GO/NO-GO + findings

### Git
- branch
- previous commit
- new commit
- push result
- remote verification

**Completion does NOT authorize merge. Wait for ChatGPT's independent security re-review.**
