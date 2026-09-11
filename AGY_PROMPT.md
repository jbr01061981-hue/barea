# AGY PROMPT — BAREA-006 CLOUDFLARE DEPLOYMENT GATE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Architecture decision: ADR-012

## CURRENT DECISION

**PRODUCTION DEPLOYMENT TARGET SELECTED: CLOUDFLARE.**

The user has explicitly selected Cloudflare for BAREA production deployment.

ADR-012 remains the platform-neutral security architecture contract, but the concrete implementation target for the current deployment work is now:

**Cloudflare Edge + Cloudflare Tunnel (`cloudflared`) + private BAREA origin.**

Do not continue asking the user to choose between Cloudflare, AWS/GCP, or a Linux reverse proxy. That decision has been made.

This does NOT authorize merge. It authorizes AGY to proceed with the concrete Cloudflare deployment-boundary design and, where explicitly permitted below, implementation.

## SECURITY OBJECTIVE

Required production topology:

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE / DNS / TLS
      |
      v
CLOUDFLARE TUNNEL
      |
      | private outbound connector
      v
PRIVATE BAREA ORIGIN
      |
      v
Next.js / Node :3000
```

The origin must not be directly reachable from the public Internet.

## NON-NEGOTIABLE SECURITY INVARIANTS

1. BAREA production origin port 3000 MUST NOT be publicly reachable.
2. Cloudflare Tunnel must be the intended inbound application path.
3. Public callers may send arbitrary forwarding and identity headers; those caller values must never be accepted as authoritative merely because they exist.
4. The trusted Cloudflare path must provide the authoritative client-IP signal used by BAREA's abuse controls.
5. If application-level attestation is retained, it is meaningful only because the origin is private/unreachable by arbitrary callers and the credential is injected only by the trusted deployment path.
6. Never expose `BAREA_EDGE_SECRET`, tunnel credentials, private keys, or equivalent secrets to browsers or commit them to Git.
7. Never restore a client-supplied `clientIp` parameter.
8. Never use `BAREA_TRUSTED_PROXY` alone as proof of provenance.
9. IP is an anti-abuse signal, not an authentication or authorization identity.
10. Authenticated participant join throttling remains keyed by authenticated `userId`.
11. Church NAT scalability must remain intact; no successful-participant-per-IP seat quota.
12. BAREA-007 remains out of scope.

## IMPORTANT — VERIFY CLOUDFLARE'S ACTUAL TRUST MODEL FIRST

Before changing `src/`, determine from current official Cloudflare documentation and the actual deployment configuration:

- how Cloudflare Tunnel reaches the origin;
- how the origin is made unreachable from arbitrary Internet clients;
- which Cloudflare request metadata represents the connecting client IP;
- whether that metadata is guaranteed by the selected Tunnel/origin topology;
- how caller-supplied `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, and `X-Barea-*` values are handled;
- whether Cloudflare overwrites or preserves each relevant header;
- whether a Worker is necessary or unnecessary;
- whether an additional origin attestation is actually required;
- how the selected mechanism behaves for direct origin attempts;
- what configuration is needed for DNS, TLS, tunnel ingress, and origin service routing.

Do not rely on assumptions from the earlier technology-neutral ADR when Cloudflare-specific behavior can be verified.

Prefer Cloudflare's native trusted mechanism over custom cryptographic machinery when it provides the required provenance guarantees.

Do NOT automatically implement `X-Barea-Edge-Attestation` + `X-Barea-Client-IP` merely because the generic ADR mentions those names. First verify whether they are necessary for Cloudflare.

## CLOUDFLARE DEPLOYMENT MODEL

Use the simplest secure model that satisfies ADR-012:

- Cloudflare-managed DNS for the BAREA hostname;
- Cloudflare TLS at the public edge;
- `cloudflared` connector running on the private origin host/network;
- Tunnel ingress routing the BAREA hostname to the local/private Next.js service;
- no public application ingress to port 3000;
- origin firewall/host configuration consistent with the Tunnel deployment;
- secrets and tunnel credentials stored outside Git.

Do not introduce a Cloudflare Worker unless the verified design requires one.

## ORIGIN HOST REQUIREMENTS

Document and implement, where the environment permits:

- production Next.js process;
- process supervision/restart;
- port 3000 binding;
- firewall rules;
- public-IP exposure status;
- local/private service target used by `cloudflared`;
- operating-system hardening relevant to origin isolation.

If the chosen hosting environment makes a specific control unnecessary, document why rather than fabricating it.

## CLIENT-IP PROVENANCE

The critical BAREA-006 problem is trustworthy per-client abuse-control identity.

The final implementation must establish a chain equivalent to:

```text
real client connection
      -> Cloudflare edge
      -> authenticated/private Tunnel path
      -> trusted request metadata
      -> BAREA server-side identity resolution
      -> rate limiter
```

A public caller's arbitrary header must not be able to break that chain.

If Cloudflare's trusted request metadata is consumed directly by the application, document the exact trust assumption and the reason the private Tunnel/origin boundary prevents direct spoofing.

If custom attestation is required, document why Cloudflare's native mechanism is insufficient and implement the smallest secure addition.

## RATE-LIMIT REQUIREMENTS

Preserve:

- failed room lookup throttling;
- subnet containment where applicable;
- authenticated `userId` join throttling;
- no successful-participant-per-IP quota;
- church NAT scalability;
- independent rate-limit identities for independent legitimate clients where IP throttling requires them.

The solution must prevent one unauthenticated attacker from collapsing all public clients into the same `127.0.0.1` bucket.

## APPLICATION CHANGE AUTHORIZATION

Application changes are now authorized **only for the verified Cloudflare integration required to resolve the BAREA-006 provenance blocker**.

Keep changes minimal and security-focused.

Likely scope is limited to:

- `resolveServerClientIp()` or its direct supporting code;
- trusted Cloudflare request metadata handling;
- required environment configuration;
- focused security/integration tests.

Do not modify unrelated session, tenant, authorization, admission, persistence, or quiz behavior.

Do not weaken the existing fail-closed behavior until the Cloudflare trust path is actually established.

## DEPLOYMENT SECRETS

Never commit secret values.

Potential production secrets include tunnel credentials and, only if genuinely required, an application edge-attestation secret.

Requirements:

- generate high-entropy credentials;
- store them in the deployment environment/secret manager;
- never place them in source, reports, tests, or Git history;
- document rotation;
- revoke old credentials after rotation;
- use least privilege;
- ensure browser/client code cannot read them.

## DNS / TLS

Document the actual Cloudflare configuration required for:

- BAREA production hostname;
- DNS routing;
- TLS mode;
- Tunnel ingress hostname/service mapping;
- certificate behavior;
- redirect/HTTPS behavior;
- origin connection encryption where applicable.

Do not claim configuration is active until it has actually been provisioned and verified.

## HEALTH CHECKS

Health checks must not become an authorization bypass.

If `/api/health` is exposed for Cloudflare/origin monitoring, verify that it returns only safe operational information and does not expose tenant data, secrets, provider identities, or quiz content.

Document whether the health path is public, tunnel-only, or separately protected and why.

## REQUIRED DEPLOYMENT TESTS

Once the actual Cloudflare environment is provisioned, prove:

### 1. Direct-origin bypass

A public Internet client cannot reach the Next.js origin directly on port 3000.

### 2. Public header spoofing

A public caller sending arbitrary:

- `CF-Connecting-IP`
- `X-Forwarded-For`
- `X-Real-IP`
- `X-Barea-Client-IP`
- `X-Barea-Edge-Attestation`

cannot choose the authoritative identity used by BAREA.

### 3. Legitimate Cloudflare path

Two legitimate clients arriving through Cloudflare receive distinct authoritative identities where IP-based abuse controls require them.

### 4. Bucket hopping

Changing public forwarding headers cannot move an attacker between rate-limit identities.

### 5. Church NAT

At least 50 legitimate participants behind one church NAT remain compatible with BAREA and do not hit a successful-participant-per-IP seat quota.

### 6. Authenticated join throttling

Authenticated join mutations remain keyed by authenticated `userId`.

### 7. Failure behavior

Missing/invalid trusted metadata cannot grant arbitrary client identity and fails safely.

### 8. Tunnel/origin isolation

Stopping/bypassing the Cloudflare Tunnel does not create an alternate public path to the origin.

## VERIFICATION COMMANDS

Run after implementation:

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

Also run the actual Cloudflare deployment/integration tests. Unit tests alone do not prove the network trust boundary.

## TWO FRESH INDEPENDENT REVIEWERS

After implementation, invoke exactly two fresh independent reviewers.

### Agent 1 — Security + Cloudflare Red Team

Challenge:

- Cloudflare/Tunnel trust boundary;
- origin isolation;
- direct-origin bypass;
- header spoofing;
- client-IP provenance;
- tunnel credential security;
- application attestation if present;
- rate-limit bucket hopping;
- church NAT scalability;
- tenant/authentication/authorization regressions;
- BAREA-007 quarantine.

### Agent 2 — Deployment QA + Operations

Challenge:

- Cloudflare DNS/TLS correctness;
- Tunnel configuration;
- origin process/restart behavior;
- firewall/private ingress;
- health checks;
- observability;
- secret rotation;
- failure/recovery behavior;
- reproducibility;
- integration tests;
- future BAREA-007 compatibility.

Both must issue explicit GO/NO-GO verdicts.

Their verdicts do not authorize merge.

## DOCUMENTATION

Update only relevant documentation:

- `DECISIONS.md` / ADR-012;
- `ROADMAP.md`;
- `AGY-REPORT.md`;
- deployment documentation/configuration where actually required.

Record that Cloudflare is now the selected production target.

Distinguish clearly between:

- architecture specified;
- infrastructure provisioned;
- infrastructure verified;
- application implementation verified;
- merge authorized.

## GIT / MERGE RULES

Remain on `barea-006-share-join`.

Do not merge to `main`.
Do not self-merge.
Do not start BAREA-007.
Do not commit secrets.
Do not make unrelated changes.

## FINAL REPORT

### Cloudflare deployment
- Cloudflare deployment model;
- origin hosting model;
- Tunnel configuration;
- DNS/TLS;
- origin exposure;
- firewall/private ingress;
- client-IP provenance;
- header handling;
- application attestation, if any;
- secret lifecycle;
- health checks;
- observability.

### Application
- exact files changed;
- exact client-IP resolution path;
- security rationale for each change;
- unrelated functionality confirmed unchanged.

### Deployment verification
- direct-origin bypass: PASS/FAIL;
- public header spoofing: PASS/FAIL;
- legitimate Cloudflare identity: PASS/FAIL;
- bucket hopping: PASS/FAIL;
- NAT scalability: PASS/FAIL;
- authenticated join throttling: PASS/FAIL;
- failure behavior: PASS/FAIL;
- tunnel/origin isolation: PASS/FAIL.

### Existing protections
- tenant isolation: PASS/FAIL;
- authorization: PASS/FAIL;
- error sanitization: PASS/FAIL;
- session expiry: PASS/FAIL;
- BAREA-007 quarantine: PASS/FAIL.

### Automated verification
- npm test: PASS/FAIL;
- typecheck: PASS/FAIL;
- build: PASS/FAIL;
- build:next: PASS/FAIL;
- no `any`: PASS/FAIL;
- diff check: PASS/FAIL.

### Two-agent review
- Agent 1: GO/NO-GO + findings;
- Agent 2: GO/NO-GO + findings.

### Git
- branch;
- previous commit;
- new commit;
- push result;
- remote verification.

## FINAL STOP CONDITION

Cloudflare is selected and deployment implementation is authorized within the scope above.

**Completion does NOT authorize merge.**

After Cloudflare infrastructure is actually provisioned, integration tests pass, and the two fresh reviewers complete:

**STOP. DO NOT MERGE. DO NOT START BAREA-007. WAIT FOR CHATGPT'S INDEPENDENT SECURITY RE-REVIEW AND EXPLICIT MERGE AUTHORIZATION.**
