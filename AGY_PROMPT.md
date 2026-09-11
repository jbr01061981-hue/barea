# AGY PROMPT — BAREA-006 DEPLOYMENT BOUNDARY / FINAL RATE-LIMIT IDENTITY ARCHITECTURE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Current application head under review: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`

## Current authorization

**NO-GO — DO NOT MERGE `eb8d416`.**

The application-only IP-provenance problem has been correctly identified. The current production fallback of `127.0.0.1` prevents spoofing, but collapses all unauthenticated clients into one global rate-limit bucket and therefore does not preserve church-scale abuse-control behavior.

The repository audit also established that BAREA currently contains **no deployment-level trusted edge/reverse-proxy boundary**. No Docker/container deployment, nginx/Caddy/Traefik configuration, Vercel/Cloudflare/AWS/GCP deployment configuration, CI/CD deployment configuration, firewall/security-group policy, private-origin configuration, or equivalent network boundary is currently represented in the repository. `DECISIONS.md` also leaves production hosting/infrastructure intentionally deferred.

This means the remaining blocker is **deployment architecture**, not another application-code trick.

## Mandatory stop condition

**DO NOT modify application client-IP trust behavior until a real deployment boundary is selected and its enforceable invariants are documented.**

Do not:

- restore blind trust in `CF-Connecting-IP`;
- restore blind trust in `X-Forwarded-For`;
- restore blind trust in `X-Real-IP`;
- accept any client-supplied `clientIp` parameter;
- treat `BAREA_TRUSTED_PROXY` as proof of network provenance;
- invent socket APIs unavailable to Next.js Server Actions;
- add a proxy secret check while the origin remains publicly reachable;
- claim that a unit test setting an environment variable proves an origin boundary;
- remove room-lookup throttling;
- use `127.0.0.1` and claim that it represents distinct real clients.

If the selected deployment cannot enforce the required boundary, **STOP / NO-GO and report the infrastructure requirement.**

## Independent security decision

The preferred architecture is:

```text
PUBLIC INTERNET
      |
      v
Trusted Edge / Reverse Proxy
      |
      |  strips/replaces caller forwarding headers
      |  derives client IP from its own connection context
      |  authenticates to origin
      v
PRIVATE / FIREWALLED BAREA ORIGIN
      |
      v
Next.js Server Actions
```

### Core security invariant

> An untrusted Internet client must not be able to reach the BAREA origin directly. Only the trusted edge may reach the origin, and the origin must be able to authenticate that edge before accepting proxy-derived client identity.

**A proxy secret alone is NOT sufficient.** If an attacker can reach the origin directly, the attacker can send the same secret and forge the forwarding headers.

## What is authorized now

AGY is authorized to perform **deployment-boundary architecture work and documentation only**, not to fake the boundary in application code.

### Step 1 — Repository audit

The repository audit has already established:

- BAREA is a self-contained Next.js 16.3.4 App Router application;
- no current reverse-proxy/deployment infrastructure is present in the repository;
- production hosting/infrastructure is intentionally deferred;
- `eb8d416` is therefore correctly stopped at the application layer.

Do not repeat the same audit merely to produce another report.

### Step 2 — Define the smallest production deployment contract

Produce a concise deployment architecture specification for BAREA-006. It must be technology-neutral at the security-invariant level and may name one or more concrete implementation choices.

The contract must require:

1. Public traffic reaches the trusted edge.
2. The origin is private or protected by an enforceable firewall/security-group/network policy.
3. Direct public access to the Next.js origin port is blocked.
4. The edge strips caller-supplied client-IP and proxy-attestation headers.
5. The edge derives the client address from its own connection context.
6. The edge writes the canonical client identity for the origin.
7. The edge authenticates to the origin using mTLS, an equivalently protected secret, or equivalent platform/network identity.
8. The origin accepts proxy-derived client identity only after authenticating the edge.
9. Requests that do not satisfy the proxy boundary cannot enter the trusted identity path.
10. The application never accepts a caller-selected IP parameter.

### Technology choice

Do **not** lock BAREA to Cloudflare, AWS, Vercel, nginx, or another vendor unless the repository/deployment requirements justify it.

A valid implementation may use, for example:

- a managed edge/load balancer with a private origin;
- a reverse proxy on a private network;
- Cloudflare Tunnel or equivalent private-origin connectivity;
- a cloud load balancer/security group arrangement;
- another architecture that demonstrably enforces the same invariants.

The security requirement is the boundary, not the vendor name.

## Step 3 — Deployment artifacts

If the project needs deployment artifacts to make the selected architecture implementable, create **only the minimal non-secret configuration/documentation needed to define the contract**.

Examples may include:

- deployment architecture documentation;
- environment-variable documentation describing required server-side secrets;
- reverse-proxy configuration templates with placeholders, if a concrete proxy is selected;
- container/deployment configuration only if required by the selected architecture.

Do NOT commit real secrets, credentials, private keys, production IP allowlists that have not been verified, or fabricated cloud configuration.

If an actual production deployment target has not been selected, do not pretend that deployment files prove the boundary. In that case document the required infrastructure and STOP.

## Application implementation rule

Do not change `resolveServerClientIp()` to trust a forwarding header until all of the following are true:

- the deployment architecture is explicitly selected;
- the origin ingress restriction is defined;
- the edge-to-origin authentication mechanism is defined;
- header normalization/replacement behavior is defined;
- the exact authoritative client-IP source is defined;
- deployment/integration tests can exercise the boundary or the deployment provider supplies an independently verifiable guarantee.

Once those prerequisites are genuinely available, application implementation can be authorized in a later prompt/review.

Until then, `eb8d416` remains the safe application checkpoint.

## Rate-limit requirements that must remain intact

The eventual solution must preserve:

- independent rate-limit identities for independent legitimate clients;
- resistance to forwarding-header spoofing and bucket hopping;
- room lookup throttling;
- subnet containment where applicable;
- authenticated participant join throttling keyed by authenticated `userId`;
- church NAT scalability — IP throttling must NOT become a participant seat quota;
- protection against one attacker exhausting a global congregation-wide lookup bucket.

The room lookup attack surface remains in scope. Do NOT declare it out of scope merely because participants authenticate at join time.

## Required eventual adversarial tests

When the deployment boundary is actually implemented, verification must cover:

### Direct origin attack

A caller directly reaching the origin, if such reach is technically possible in a test environment, must not be able to select an arbitrary client identity by sending:

- `CF-Connecting-IP`;
- `X-Forwarded-For`;
- `X-Real-IP`;
- proxy attestation/secret.

In production architecture, direct public origin access must be blocked rather than merely handled by application logic.

### Spoofed proxy credential

A caller without the real proxy credential cannot enter the trusted-proxy path.

### Trusted proxy

A request arriving through the authenticated edge resolves to the client identity derived by the trusted edge.

### Header replacement

Caller-supplied forwarding headers are stripped/replaced at the edge.

### Bucket isolation

Two legitimate proxied client identities receive separate rate-limit buckets.

### Bucket hopping

Changing caller-controlled forwarding headers cannot move an attacker between buckets.

### NAT scalability

At least 50 legitimate participants behind one church NAT can participate without an unintended per-IP participant seat quota or participant-wide throttling failure.

### Origin bypass

Deployment/integration verification must demonstrate that public clients cannot bypass the trusted edge and reach the origin directly. A unit test that merely sets an environment variable is insufficient.

## Existing protections — do not regress

Preserve all existing BAREA protections, including:

- generic unexpected-error responses and server-side error logging;
- tenant isolation and authorization;
- personal workspace Option A isolated tenant mapping;
- authenticated participant rate limiting;
- room lookup throttling;
- BAREA-006 admission boundaries;
- lazy session expiry protections;
- SQLite transaction/tenant protections;
- BAREA-007 quarantine.

Do NOT:

- reintroduce anonymous nickname admission;
- introduce client-selected tenant identity;
- weaken authentication or authorization;
- start BAREA-007;
- make unrelated feature changes;
- self-merge.

## Two-agent review rule

Do not run the two implementation reviewers merely for the deployment architecture report if no application implementation has been authorized.

After a later authorized application implementation, run exactly two fresh independent reviewers:

### Agent 1 — Security + Architecture Red Team

Review:

- actual edge/origin trust boundary;
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

Review:

- action → identity resolution → service → rate limiter integration;
- realistic deployment behavior;
- legitimate proxied clients receiving distinct identities;
- direct attackers being unable to choose identities;
- NAT scalability;
- authenticated rate limiting;
- session persistence/expiry;
- error sanitization;
- complete tests/typecheck/builds.

Both must issue explicit GO/NO-GO verdicts. Never manufacture unanimous approval.

## Git rules

Remain on:

`barea-006-share-join`

For this architecture/documentation task:

- commit only the required architecture/deployment documentation or genuinely necessary non-secret deployment templates;
- use a clear security-focused commit message;
- push to `origin/barea-006-share-join`;
- **DO NOT MERGE**;
- **DO NOT START BAREA-007**.

If no repository change is justified, do not create a meaningless commit; report that the repository remains unchanged.

## Verification for any repository change

If files are changed, run:

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

## Required architecture report

Report exactly:

### 1. Current deployment state
- what deployment/infrastructure exists in the repository;
- what does not exist;
- why `eb8d416` remains stopped.

### 2. Selected deployment architecture
- chosen edge/proxy model, if any;
- origin protection mechanism;
- edge-to-origin authentication mechanism;
- client-IP provenance mechanism;
- header normalization mechanism;
- exact security invariants;
- what remains dependent on production infrastructure.

### 3. Repository changes
- exact files changed, or explicitly state none;
- commit;
- push result.

### 4. Security status
- trusted provenance: PASS/FAIL/NOT YET IMPLEMENTED
- direct origin protection: PASS/FAIL/NOT YET IMPLEMENTED
- proxy authentication: PASS/FAIL/NOT YET IMPLEMENTED
- header replacement: PASS/FAIL/NOT YET IMPLEMENTED
- bucket isolation: PASS/FAIL/NOT YET IMPLEMENTED
- bucket hopping resistance: PASS/FAIL/NOT YET IMPLEMENTED
- NAT scalability: PASS/FAIL/NOT YET IMPLEMENTED

### 5. Final decision
If the real deployment boundary does not yet exist:

**NO-GO — INFRASTRUCTURE REQUIRED.**

Do not claim BAREA-006 is fixed merely because an architecture document or application unit tests exist.

If and only if the actual deployment boundary is implemented and independently verified, report the evidence and STOP for ChatGPT's independent security review.

## Final authority

AGY must not self-authorize merge.

**Completion of this task does NOT authorize merge.**

Wait for ChatGPT's independent review and explicit merge authorization.
