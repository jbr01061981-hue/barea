# AGY PROMPT — BAREA-006 CLOUDFLARE PROVISIONING GATE — FINAL PRE-INTEGRATION

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Current documentation checkpoint: `c7a7af0`
Architecture decision: ADR-012

## CURRENT SECURITY DECISION

ChatGPT independent security re-review of the latest AGY deployment report:

- Cloudflare architecture: **GO**
- Documentation / gate discipline: **GO**
- Current application safety: **GO**
- Cloudflare infrastructure: **NOT PROVISIONED**
- Live client-IP provenance: **NOT PROVEN**
- Production integration: **NOT PROVEN**
- Merge: **NO-GO**
- BAREA-007: **BLOCKED**

The latest report correctly confirms that no Cloudflare credentials are available, no live deployment tests were performed, and `src/` remains unchanged at `eb8d416`. Do not represent this state as production-secure or merge-ready.

Cloudflare is the final production target. Do not ask the user to choose another hosting platform.

## PRIMARY OBJECTIVE NOW

Complete the **actual Cloudflare provisioning and live trust-boundary verification** if and only if AGY has genuine access to the required Cloudflare account/zone and a reachable private origin host.

If AGY does not have that access, STOP after documenting the exact human/operator actions required. Do not simulate, fabricate, or infer live provisioning.

Do not change `src/` until the real Cloudflare request path has been experimentally established.

## SIX STATES — NEVER CONFLATE THEM

Reports MUST distinguish:

1. Architecture specified.
2. Infrastructure provisioned.
3. Infrastructure operational.
4. End-to-end client-IP provenance experimentally verified.
5. Application integration verified.
6. Merge authorized.

Only ChatGPT can authorize state 6.

## REQUIRED TOPOLOGY

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE / DNS / TLS
      |
      | Cloudflare Tunnel
      | outbound connector connection
      v
cloudflared ON PRIVATE ORIGIN HOST
      |
      | local/private connection
      v
NEXT.JS / NODE :3000
      |
      v
SQLITE
```

The origin must not have a public application ingress path.

## NON-NEGOTIABLE INVARIANTS

1. Public Internet MUST NOT reach origin port `3000`.
2. Tunnel is the intended public application path.
3. Never restore a client-controlled `clientIp` parameter.
4. Never trust caller-supplied `X-Forwarded-For`, `X-Real-IP`, `X-Barea-*`, or `CF-Connecting-IP` merely because the header exists.
5. Never use `BAREA_TRUSTED_PROXY` alone as provenance proof.
6. IP is anti-abuse identity only; never authentication/authorization identity.
7. Authenticated join throttling remains keyed by authenticated `userId`.
8. No successful-participant-per-IP seat quota; church NAT scalability must remain intact.
9. No secrets in browser code, tests, reports, screenshots, or Git.
10. BAREA-007 remains out of scope.
11. Preserve tenant isolation, authorization, error sanitization, session expiry, and previously reviewed security behavior.

## PHASE 1 — REAL CLOUDFLARE PROVISIONING

If authenticated Cloudflare access and a real origin host are available, provision the selected production topology.

Required controls:

- Cloudflare DNS hostname.
- Cloudflare Tunnel.
- `cloudflared` on the private origin host.
- Tunnel ingress to the actual private/local Next.js service.
- HTTPS/TLS at the public edge.
- Next.js bound to `127.0.0.1:3000` or another explicitly isolated private interface.
- Host/network controls preventing public access to `3000`.
- Process supervision and connector restart behavior.
- Tunnel credentials stored outside Git.

If credentials/access are unavailable:

- mark provisioning **NOT PROVISIONED**;
- list the exact commands/configuration/operator steps still required;
- list exactly which credential/access values are missing;
- do not create fake IDs, records, credentials, IPs, or test results;
- do not modify `src/`.

## PHASE 2 — VERIFY ACTUAL CLOUDFLARE PROVENANCE

Use current official Cloudflare documentation AND the actual deployed configuration.

Determine exactly:

1. Public hostname and DNS routing.
2. Tunnel identity/authentication.
3. Actual origin service target.
4. Actual origin exposure/binding.
5. Which request metadata reaches Next.js as the candidate authoritative client IP.
6. Exact behavior of `CF-Connecting-IP` on this deployed path.
7. Exact behavior of caller-supplied `CF-Connecting-IP`.
8. Exact behavior of XFF and X-Real-IP.
9. Whether any `X-Barea-*` headers are accepted or ignored.
10. Whether Transform Rules or Workers are configured.
11. Whether any custom attestation is necessary.

### IMPORTANT

Do not state that Cloudflare behavior is proven merely because documentation says it should work.

Do not state that a healthy Tunnel proves local origin health or application provenance.

Do not introduce HMAC, Worker, custom signatures, `X-Barea-Edge-Attestation`, or other cryptographic machinery unless a concrete tested requirement demonstrates native Cloudflare provenance is insufficient.

A static secret header is not an HMAC.

## PHASE 3 — LIVE ORIGIN ISOLATION TEST

From a genuinely external network, test the real deployed origin.

Required evidence:

- public DNS does not reveal a usable application origin address;
- external access to origin `:3000` fails;
- bypassing Cloudflare cannot reach Next.js;
- stopping `cloudflared` does not create an alternate public route;
- Next.js remains bound only to the intended local/private interface.

Record actual target, command, timestamp/result, and PASS/FAIL/NOT RUN.

Architecture documentation is not live evidence.

## PHASE 4 — LIVE CLIENT-IP PROVENANCE TESTS

This is the central BAREA-006 acceptance gate.

Use the real public Cloudflare hostname and, where possible, at least two genuinely separate external networks.

### Test A — Legitimate clients

Two legitimate clients from distinct external networks must produce the expected distinct authoritative client identities for IP-based abuse controls.

### Test B — Spoof `CF-Connecting-IP`

Send a caller-selected value. Prove it cannot replace the authoritative client IP used by BAREA.

### Test C — Spoof XFF

Send arbitrary XFF chains. Prove they cannot select the BAREA rate-limit identity.

### Test D — Spoof X-Real-IP

Prove it cannot select the BAREA rate-limit identity.

### Test E — Spoof X-Barea-Client-IP

Prove it cannot select the BAREA rate-limit identity.

### Test F — Spoof X-Barea-Edge-Attestation

If unused, prove it has no privileged effect. If used, prove caller-supplied values cannot satisfy the trust check.

### Test G — Bucket hopping

Rotate all public forwarding/identity headers repeatedly. Prove the attacker cannot move between rate-limit buckets.

### Test H — Failure path

A missing/invalid trusted signal must not grant arbitrary client identity. It must fail safely according to the established design.

## PHASE 5 — ONLY AFTER LIVE PROVENANCE IS PROVEN, MODIFY APPLICATION

Do not modify `src/` before Phases 1–4 establish the real trusted request path.

Once proven, make the **smallest possible** application change to consume the verified Cloudflare client-IP signal.

Expected scope:

- `resolveServerClientIp()` and direct supporting code;
- trusted Cloudflare request metadata handling;
- required environment/configuration;
- focused security/integration tests.

Do not modify unrelated session, tenant, authorization, admission, persistence, quiz, or UI behavior.

The intended chain is:

```text
real client
  -> Cloudflare Edge
  -> Cloudflare Tunnel
  -> private origin
  -> verified trusted client-IP metadata
  -> resolveServerClientIp()
  -> rate limiter
```

Untrusted/direct requests must not be able to choose that identity.

## RATE-LIMIT ACCEPTANCE

Preserve:

- failed room lookup: 15/min per IP;
- existing /24 or /48 subnet containment;
- unauthenticated flood protection: 30/10s per IP;
- authenticated join mutation: 1/5s per authenticated `userId`;
- zero successful-participant-per-IP seat quota.

Prove:

- 50+ legitimate participants behind one church NAT remain supported;
- independent legitimate clients receive independent IP buckets where applicable;
- attacker header rotation cannot hop buckets;
- authenticated userId throttling remains isolated.

## SECRETS

Never commit or expose:

- Cloudflare API tokens;
- Tunnel tokens/credentials;
- private keys;
- origin secrets;
- `BAREA_EDGE_SECRET` unless separately proven necessary.

Document generation, storage, least privilege, rotation, revocation, and browser exclusion without exposing real values.

## DNS / TLS / TUNNEL / OPERATIONS

Verify actual configuration, not intended configuration:

- hostname;
- DNS route;
- HTTPS/TLS;
- Tunnel ingress;
- origin service health;
- connector health;
- restart/recovery;
- process supervision;
- host binding/firewall.

Do not mark anything active/verified without actual evidence.

## HEALTH / OBSERVABILITY

Health endpoints must not expose secrets, tenant data, quiz content, authentication data, or provider credentials.

Record useful Cloudflare, `cloudflared`, host, and application evidence without leaking secrets.

## BAREA-007

Do not implement BAREA-007.

Do not add WebSocket/SSE/live quiz state or answer-submission transport.

Only record deployment compatibility if it is incidental to this work.

## AUTOMATED VERIFICATION AFTER ANY APPLICATION CHANGE

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

Remember: these tests validate application behavior; they do NOT prove the network trust boundary.

## TWO FRESH INDEPENDENT REVIEWERS

Only after actual provisioning, live integration testing, and any authorized application change:

### Agent 1 — Security + Cloudflare Red Team

Attack:

- direct-origin bypass;
- Tunnel provenance;
- CF-Connecting-IP spoofing;
- XFF/X-Real-IP spoofing;
- X-Barea spoofing;
- bucket hopping;
- secret exposure;
- tunnel credential misuse;
- church NAT scalability;
- tenant/authentication/authorization regressions;
- BAREA-007 boundary.

### Agent 2 — Deployment QA + Operations

Verify:

- DNS/TLS;
- Tunnel configuration;
- connector startup/restart;
- origin isolation;
- service binding;
- firewall/network behavior;
- health checks;
- observability;
- secret lifecycle;
- failure/recovery;
- reproducibility;
- actual end-to-end integration.

Both must issue explicit GO/NO-GO verdicts with concrete evidence.

Their verdicts do not authorize merge.

## DOCUMENTATION RULE

Update only relevant documentation/configuration.

Every report must distinguish:

- specified;
- provisioned;
- operational;
- experimentally verified;
- application verified;
- merge authorized.

Never label architecture-only evidence as a live deployment PASS.

## GIT RULES

Remain on `barea-006-share-join`.

Do not merge to `main`.
Do not self-merge.
Do not start BAREA-007.
Do not commit secrets.
Do not make unrelated changes.
Do not modify `src/` until the live Cloudflare provenance gate is satisfied.

## FINAL REPORT REQUIRED

Report:

### Infrastructure
- Cloudflare hostname/DNS;
- Tunnel configuration;
- connector status;
- origin host/service;
- port/interface binding;
- public exposure result;
- TLS result.

### Provenance
- exact authoritative client-IP mechanism;
- exact reason it is trusted;
- actual header behavior;
- direct-origin behavior;
- spoofing evidence;
- bucket-hopping evidence.

### Application
- exact files changed;
- exact client-IP resolution path;
- security rationale;
- confirmation unrelated behavior is unchanged.

### Deployment tests
For every item report **PASS / FAIL / NOT RUN** and evidence:

- direct-origin bypass;
- spoofed CF-Connecting-IP;
- spoofed XFF;
- spoofed X-Real-IP;
- spoofed X-Barea-Client-IP;
- spoofed X-Barea-Edge-Attestation;
- legitimate Cloudflare identity;
- bucket hopping;
- 50+ church NAT participants;
- authenticated userId throttling;
- missing/invalid trusted metadata;
- Tunnel/origin isolation;
- connector restart/recovery.

### Existing protections
- tenant isolation;
- authorization;
- error sanitization;
- session expiry;
- BAREA-007 quarantine.

### Automated verification
- npm test;
- typecheck;
- build;
- build:next;
- no `any`;
- diff check.

### Reviewers
- Agent 1: GO/NO-GO + evidence;
- Agent 2: GO/NO-GO + evidence.

### Git
- branch;
- previous commit;
- new commit;
- push result;
- remote verification.

## ABSOLUTE STOP CONDITION

Even if all automated tests and both independent reviewers return GO:

**DO NOT MERGE. DO NOT START BAREA-007. DO NOT CLAIM PRODUCTION SECURITY COMPLETE.**

Stop after the actual Cloudflare deployment/integration state is complete and wait for **ChatGPT's independent security re-review and explicit merge authorization**.
