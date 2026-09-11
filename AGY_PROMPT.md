# AGY PROMPT — BAREA-006 CLOUDFLARE PROVISIONING + PROVENANCE VERIFICATION GATE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Current documentation checkpoint: `52ee878`
Architecture decision: ADR-012

## CURRENT DECISION

**PRODUCTION TARGET: CLOUDFLARE EDGE + CLOUDFLARE TUNNEL (`cloudflared`) + PRIVATE BAREA ORIGIN.**

This decision is final. Do not ask the user to choose AWS/GCP/Linux reverse proxy alternatives.

The prior ChatGPT independent review gives:

- Cloudflare architecture direction: GO.
- Documentation corrections: resolved.
- Merge authorization: NO-GO until actual Cloudflare infrastructure is provisioned and verified.
- BAREA-007: remains blocked.

This prompt authorizes the next phase: **actual Cloudflare deployment provisioning and end-to-end provenance verification**, followed by the smallest necessary application change. It does NOT authorize merge.

## CRITICAL PRINCIPLE

Do not claim that architecture documentation, unit tests, or theoretical Cloudflare behavior proves a production trust boundary.

The following are separate states and MUST remain separate in all reports:

1. Architecture specified.
2. Cloudflare infrastructure provisioned.
3. Cloudflare infrastructure operational.
4. End-to-end provenance experimentally verified.
5. Application integration verified.
6. Merge authorized.

Only #6 can authorize merge, and **only ChatGPT can authorize #6**.

## REQUIRED PRODUCTION TOPOLOGY

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE / DNS / TLS
      |
      | authenticated outbound Tunnel connection
      v
cloudflared ON PRIVATE ORIGIN HOST
      |
      | local/private service connection
      v
NEXT.JS / NODE :3000
      |
      v
SQLITE / PERSISTENT STORAGE
```

The origin must not have a public application ingress path.

## NON-NEGOTIABLE SECURITY INVARIANTS

1. Port `3000` MUST NOT be publicly reachable.
2. `cloudflared` is the intended public-to-origin application path.
3. Never restore a client-controlled `clientIp` parameter.
4. Never trust `X-Forwarded-For`, `X-Real-IP`, `X-Barea-Client-IP`, or a caller-supplied `CF-Connecting-IP` merely because the header exists.
5. Do not use `BAREA_TRUSTED_PROXY` alone as provenance proof.
6. IP is an anti-abuse signal, never authentication or authorization identity.
7. Authenticated join throttling remains keyed by authenticated `userId`.
8. No successful-participant-per-IP seat quota; church NAT scalability must remain intact.
9. Never expose tunnel credentials or application secrets to browser code.
10. Never commit secrets.
11. BAREA-007 remains completely out of scope.
12. Preserve tenant isolation, authorization, error sanitization, session expiry, and all previously reviewed protections.

## PHASE 1 — PROVISION THE ACTUAL CLOUDFLARE ENVIRONMENT

Use the actual Cloudflare account/zone available to the deployment environment.

Provision, where access permits:

- Cloudflare-managed DNS hostname for BAREA.
- Cloudflare Tunnel.
- `cloudflared` connector on the private origin host.
- Tunnel ingress mapping from the BAREA hostname to the actual local/private Next.js service.
- Production TLS/HTTPS behavior.
- Origin process supervision/restart.
- Origin service binding to `127.0.0.1:3000` or another explicitly isolated private service address.
- Host firewall/network configuration preventing public access to `3000`.
- Tunnel credential/token storage outside Git.

### IMPORTANT: NO FAKE PROVISIONING

If AGY does not have authenticated access to the Cloudflare account, it MUST NOT fabricate provisioning results.

Instead:

- document the exact commands/dashboard/API/Terraform steps required;
- identify exactly which values are still unavailable;
- mark infrastructure as **NOT PROVISIONED / NOT VERIFIED**;
- do not report deployment tests as PASS.

Do not create fake credentials, fake DNS records, fake tunnel IDs, fake IP addresses, or simulated production evidence and label them as real.

## PHASE 2 — VERIFY THE REAL CLOUDFLARE TRUST MODEL

Use current official Cloudflare documentation and the actual deployed configuration.

Determine and record:

1. How the public request reaches Cloudflare Edge.
2. How the Tunnel authenticates `cloudflared`.
3. How the origin remains unreachable from arbitrary Internet clients.
4. Which request metadata represents the real visitor/client IP.
5. Exactly how `CF-Connecting-IP` behaves on the selected proxied/Tunnel path.
6. Exactly how Cloudflare handles caller-supplied `CF-Connecting-IP`, `X-Forwarded-For`, and `X-Real-IP`.
7. Whether any caller-supplied `X-Barea-*` header reaches the origin.
8. Whether Transform Rules are actually configured and what they do.
9. Whether a Worker is necessary.
10. Whether custom application attestation is necessary.

### PREFERRED DESIGN

Prefer the simplest native Cloudflare mechanism that establishes the required provenance.

If the real Cloudflare Tunnel boundary plus `CF-Connecting-IP` is sufficient, use that.

**Do not introduce `X-Barea-Edge-Attestation`, HMAC, a Worker, custom signatures, or cryptographic request signing merely because ADR-012 contains generic platform-neutral language.**

If custom attestation is genuinely required, stop and document the reason before implementing it.

A static secret header is NOT an HMAC.

## PHASE 3 — PROVE ORIGIN ISOLATION

From a genuinely external network, attempt to reach the origin directly.

Prove:

- public DNS does not expose an application origin address;
- port `3000` is not publicly reachable;
- the origin cannot be reached by bypassing Cloudflare;
- stopping `cloudflared` does not create another public route;
- the Next.js service remains bound only to its intended local/private interface.

Record actual commands, targets, timestamps/results, and PASS/FAIL.

Do not mark this PASS from documentation alone.

## PHASE 4 — PROVE CLIENT-IP PROVENANCE END TO END

This is the central BAREA-006 acceptance gate.

Test through the actual public Cloudflare hostname using at least two genuinely separate clients/networks where possible.

### Required tests

#### A. Legitimate Cloudflare identity

Two legitimate external clients must produce the expected distinct authoritative client identities where IP-based abuse controls require them.

#### B. Spoofed `CF-Connecting-IP`

Send a caller-controlled `CF-Connecting-IP` value. Prove it cannot replace the authoritative client IP seen by BAREA.

#### C. Spoofed `X-Forwarded-For`

Send arbitrary XFF chains. Prove they cannot select the BAREA rate-limit identity.

#### D. Spoofed `X-Real-IP`

Prove it cannot select the BAREA rate-limit identity.

#### E. Spoofed `X-Barea-Client-IP`

Prove it cannot select the BAREA rate-limit identity.

#### F. Spoofed `X-Barea-Edge-Attestation`

If the application does not use this header, prove that it is irrelevant/ignored.
If it is used, prove caller-supplied values cannot satisfy the trust check.

#### G. Bucket hopping

Repeatedly vary public forwarding/identity headers and prove the attacker cannot move between rate-limit buckets.

## PHASE 5 — APPLICATION INTEGRATION

Only after the real Cloudflare trust path has been established may AGY modify `src/`.

Expected scope is minimal:

- `resolveServerClientIp()` and direct supporting code;
- trusted Cloudflare request metadata handling;
- required environment configuration;
- focused security/integration tests.

Do not modify unrelated session, tenant, authorization, admission, persistence, quiz, or UI behavior.

### Expected security behavior

```text
Legitimate Cloudflare request
        |
        v
verified trusted Cloudflare path
        |
        v
authoritative client IP
        |
        v
BAREA rate limiter
```

Where the trust condition is absent or invalid:

```text
untrusted/direct request
        |
        v
FAIL CLOSED
        |
        v
127.0.0.1 quarantine bucket
```

Do not weaken the current fail-closed behavior before the actual production path is proven.

## RATE LIMIT ACCEPTANCE

Preserve the existing model:

- failed room lookup throttling: 15/min per IP;
- subnet containment: existing /24 or /48 logic;
- unauthenticated flood protection: 30/10s per IP;
- authenticated join mutation throttling: 1/5s per authenticated `userId`;
- zero successful-participant-per-IP seat quota.

Explicitly test:

- 50+ legitimate participants behind one church NAT;
- independent legitimate clients where IP-based controls apply;
- attacker header rotation;
- authenticated userId isolation.

## SECRETS

Never commit:

- Cloudflare API tokens;
- Tunnel tokens/credentials;
- private keys;
- origin secrets;
- `BAREA_EDGE_SECRET` if ultimately required.

Use environment variables or the appropriate secret manager.

If a secret is required, document:

- generation;
- storage;
- least privilege;
- rotation;
- revocation;
- browser exclusion.

Never place real secret values in tests, reports, documentation, screenshots, or Git history.

## DNS / TLS / TUNNEL VERIFICATION

Verify actual production configuration, not intended configuration:

- BAREA hostname;
- DNS record/tunnel route;
- HTTPS behavior;
- TLS configuration;
- tunnel ingress hostname/service mapping;
- origin service health;
- connector health;
- restart/recovery behavior.

Do not claim "active" or "verified" until experimentally confirmed.

## HEALTH / OBSERVABILITY

Any health endpoint must expose only safe operational information.

Verify it does not expose:

- secrets;
- tenant data;
- quiz content;
- authentication data;
- provider credentials.

Record useful Cloudflare, `cloudflared`, host, and application logs without leaking sensitive values.

## BAREA-007 FUTURE TRANSPORT

Do not implement BAREA-007.

Only verify deployment compatibility if required. Do not add WebSocket/SSE/live-session code.

## REQUIRED AUTOMATED VERIFICATION AFTER APPLICATION CHANGES

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

Also run the real Cloudflare integration tests. Unit tests alone cannot prove the network trust boundary.

## TWO FRESH INDEPENDENT REVIEWERS

After actual provisioning, integration testing, and application changes, invoke exactly two fresh independent reviewers.

### Agent 1 — Security + Cloudflare Red Team

Must attack:

- direct-origin bypass;
- Tunnel trust boundary;
- CF-Connecting-IP provenance;
- XFF/X-Real-IP/header spoofing;
- X-Barea header spoofing;
- rate-limit bucket hopping;
- secret exposure;
- tunnel credential misuse;
- church NAT scalability;
- tenant/authentication/authorization regressions;
- BAREA-007 boundary.

### Agent 2 — Deployment QA + Operations

Must verify:

- DNS/TLS;
- Tunnel configuration;
- connector startup/restart;
- origin isolation;
- service binding;
- firewall/network behavior;
- health checks;
- logs/observability;
- secret lifecycle;
- failure/recovery;
- reproducibility;
- actual end-to-end integration.

Both must provide explicit GO/NO-GO verdicts and concrete findings.

Their verdicts do NOT authorize merge.

## DOCUMENTATION

Update only relevant files:

- `docs/DECISIONS.md` / ADR-012;
- `docs/ROADMAP.md`;
- `AGY-REPORT.md`;
- deployment documentation/configuration where genuinely required.

Every report must distinguish:

- specified;
- provisioned;
- operational;
- experimentally verified;
- application verified;
- merge authorized.

Never report an architecture assumption as a deployment test result.

## GIT RULES

Remain on `barea-006-share-join`.

Do not merge to `main`.
Do not self-merge.
Do not start BAREA-007.
Do not commit secrets.
Do not make unrelated changes.
Preserve the existing application/security behavior outside the narrowly authorized Cloudflare provenance integration.

## FINAL REPORT REQUIRED

### 1. Infrastructure
- Cloudflare zone/hostname configuration (without secrets);
- Tunnel configuration;
- connector status;
- origin host/service;
- port binding;
- public exposure result;
- DNS/TLS result.

### 2. Provenance
- exact authoritative client-IP mechanism;
- why it is trusted;
- header behavior;
- direct-origin behavior;
- spoofing results;
- bucket-hopping results.

### 3. Application
- exact files changed;
- exact client-IP resolution path;
- security rationale;
- confirmation that unrelated behavior is unchanged.

### 4. Deployment tests

Report each individually as PASS/FAIL/NOT RUN:

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
- tunnel/origin isolation;
- connector restart/recovery.

### 5. Existing protections

- tenant isolation;
- authorization;
- error sanitization;
- session expiry;
- BAREA-007 quarantine.

### 6. Automated verification

- npm test;
- typecheck;
- build;
- build:next;
- no `any`;
- diff check.

### 7. Two-agent review

- Agent 1: GO/NO-GO + findings;
- Agent 2: GO/NO-GO + findings.

### 8. Git

- branch;
- previous commit;
- new commit;
- push result;
- remote verification.

## ABSOLUTE STOP CONDITION

Even if every AGY test and both independent reviewers return GO:

**DO NOT MERGE. DO NOT START BAREA-007. DO NOT CLAIM PRODUCTION SECURITY COMPLETE.**

Stop at the completed Cloudflare deployment/integration state and wait for **ChatGPT's independent security re-review and explicit merge authorization**.
