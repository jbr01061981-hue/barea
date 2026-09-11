# AGY PROMPT — BAREA-006 DEPLOYMENT TARGET SELECTION & PROVISIONING GATE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Current application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Architecture decision: ADR-012

## CURRENT STATUS

**NO-GO FOR MERGE — PRODUCTION INFRASTRUCTURE IS NOT PROVISIONED.**

The application-level IP provenance issue is intentionally paused. Do not create another application-only workaround.

The next task is to turn ADR-012 from a technology-neutral contract into a concrete deployment decision and, only after explicit user authorization, provision the actual hosting/edge boundary.

## PRODUCT / SECURITY OBJECTIVE

BAREA needs a production deployment in which:

```text
Public Internet
      |
      v
Trusted Edge / Reverse Proxy
      |
      | authenticated edge -> origin
      | strips caller forwarding headers
      | derives client IP from edge connection context
      v
Private / Firewalled BAREA Origin
      |
      v
Next.js / Node :3000
```

This boundary is required because Next.js 16.3.4 Server Actions do not expose the raw Node socket peer address to action code, and caller-visible forwarding headers are forgeable when the origin is directly reachable.

## MANDATORY SECURITY INVARIANTS

1. Arbitrary Internet clients cannot directly reach the BAREA origin in production.
2. Only the trusted edge can reach the origin.
3. The edge strips/replaces public caller-controlled `X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`, and `X-Barea-*` headers.
4. The edge derives the client IP from its own connection context.
5. The edge authenticates to the origin through mTLS, a secret unavailable to Internet clients, or equivalent network identity.
6. The origin consumes canonical client-IP data only after validating the trusted edge boundary.
7. `BAREA_TRUSTED_PROXY` by itself is never treated as provenance.
8. A valid-looking forwarding header by itself is never treated as provenance.
9. A client-supplied Server Action parameter is never treated as authoritative IP identity.
10. Direct-origin traffic is blocked at the network layer.
11. IP is an anti-abuse signal, not authentication/authorization identity.
12. Church NAT scalability remains intact; no successful-participant-per-IP seat quota.

## PHASE 1 — PRODUCTION HOSTING DECISION

The repository currently does NOT select a production provider.

The next decision must explicitly choose ONE target architecture. Do not leave the selection ambiguous once the user makes a choice.

Supported candidate families include:

### A. Cloudflare Tunnel + Cloudflare edge

Suitable when the origin should not have public inbound access and Cloudflare terminates public TLS and forwards privately through the tunnel.

### B. Private cloud load balancer / private VPC deployment

Examples include AWS ALB/CloudFront plus private compute/security groups, or GCP Load Balancer/Cloud Armor plus private compute/network controls.

### C. Private Linux VM / container + Nginx/Caddy reverse proxy

The proxy is the only Internet-facing component and the Next.js origin is bound to a private interface or localhost with host firewall rules preventing direct public access.

Do not recommend one merely because it is familiar. Evaluate the actual BAREA constraints:

- cost;
- simplicity;
- operational burden;
- church-scale usage;
- TLS;
- domain/DNS;
- secret management;
- logs/monitoring;
- origin isolation;
- deployment/rollback;
- future WebSocket/SSE support for BAREA-007;
- future scheduled/live workloads;
- ability to preserve client-IP provenance;
- ability to support development/staging separately.

## TASK 1 — COMPARE CANDIDATES

Before provisioning anything, inspect current repository requirements and produce a concise decision matrix for the three candidate families.

At minimum compare:

- monthly baseline cost;
- complexity;
- origin isolation strength;
- IP provenance reliability;
- TLS/DNS setup;
- secret/mTLS management;
- observability;
- deployment simplicity;
- fit for Next.js App Router;
- fit for future BAREA live transport;
- fit for a small church/startup-scale project.

Do not fabricate exact pricing if current evidence is unavailable. Mark estimates as estimates.

Then select the recommended target and record WHY.

## TASK 2 — USER DECISION GATE

If the user has NOT yet selected a hosting target, STOP after the comparison and explicitly report:

`HOSTING TARGET NOT YET SELECTED — NO INFRASTRUCTURE PROVISIONING AUTHORIZED.`

Do not create fake infrastructure files merely to represent a choice.

If the user HAS explicitly selected a target in a subsequent instruction, continue to provisioning under the rules below.

## TASK 3 — PROVISIONING PLAN

Once a concrete target is selected and the user explicitly authorizes provisioning, define:

- DNS/domain routing;
- public edge endpoint;
- private origin endpoint;
- firewall/security-group rules;
- TLS termination;
- edge -> origin authentication;
- forwarding-header stripping/replacement;
- canonical internal client-IP header;
- secret generation/storage/rotation;
- health-check path;
- logs/metrics;
- environment separation for local/staging/production;
- backup/recovery expectations;
- deployment and rollback procedure.

Do not put real secrets in Git.

Do not put secret values in AGY-REPORT.md, DECISIONS.md, PR descriptions, or source files.

## EDGE ATTESTATION

If a shared secret is selected:

- use a high-entropy secret;
- keep it outside Git;
- compare it in constant time at the application boundary;
- support a safe rotation strategy;
- ensure the edge strips any caller-supplied copy before inserting its own credential;
- ensure direct origin access is impossible, so knowledge of the header format does not defeat the trust model.

If mTLS is selected, document certificate issuance, trust roots, rotation, and failure behavior.

## ORIGIN NETWORK BOUNDARY

The BAREA origin MUST NOT be directly exposed to the public Internet.

Preferred patterns:

- private subnet + security group/firewall;
- localhost/private interface + host firewall;
- Cloudflare Tunnel/private connector with no public origin listener;
- equivalent network isolation.

Do not treat application code as a substitute for firewall/network isolation.

## HEALTH CHECKS

Health checks must be designed so the load balancer/proxy can determine service health without creating an authorization bypass.

Define whether `/api/health` is edge-bypassable, internally reachable only, or otherwise separately protected.

Health checks must not expose tenant data, authentication secrets, provider identities, or quiz content.

## APPLICATION CHANGE AUTHORIZATION

Do NOT modify `src/` merely to document the deployment target.

Only after the user selects the deployment target and authorizes implementation may AGY update the application to consume the trusted edge identity.

When authorized, keep the change minimal and confined to:

- trusted edge attestation verification;
- canonical client-IP extraction after attestation;
- fail-closed handling;
- tests proving the actual trust boundary.

Do not modify unrelated BAREA-006 behavior.

## FUTURE BAREA-007 COMPATIBILITY

The chosen deployment architecture should not prevent future BAREA-007 requirements such as persistent live sessions, WebSockets/SSE, synchronized gameplay, and projector/client traffic.

However, do NOT implement BAREA-007 now.

## REQUIRED DEPLOYMENT TESTS

Once infrastructure is actually provisioned:

### 1. Direct-origin rejection

A public Internet client attempting to access origin port 3000 directly is rejected before application-level trust is established.

### 2. Public header spoofing

Public clients can send arbitrary:

- `X-Forwarded-For`
- `CF-Connecting-IP`
- `X-Real-IP`
- `X-Barea-*`

without influencing the trusted identity seen by the origin.

### 3. Header normalization

The edge strips caller-supplied copies and writes canonical values.

### 4. Proxy authentication

A request not originating from the trusted edge cannot pass the edge-attestation check.

### 5. Distinct client identities

Two legitimate clients through the edge receive distinct client identities where rate limiting requires them.

### 6. Bucket hopping

Changing public forwarding headers cannot move an attacker into another rate-limit bucket.

### 7. Church NAT

At least 50 legitimate users behind one shared church NAT can participate without successful-participant-per-IP seat quotas.

### 8. Failure mode

If the edge is unavailable or attestation is invalid, BAREA fails safely without granting trust or exposing internal data.

## TWO-AGENT REVIEW

Use exactly two fresh agents once the concrete deployment design is documented or provisioned.

### Agent 1 — Security + Deployment Architecture

Challenge:

- network isolation;
- origin exposure;
- edge authentication;
- header spoofing;
- client-IP provenance;
- secret/mTLS handling;
- direct-origin bypass;
- NAT/rate-limit impact.

### Agent 2 — QA + Operations / Implementability

Challenge:

- deployment reproducibility;
- DNS/TLS;
- health checks;
- secret rotation;
- logs/observability;
- rollback;
- direct-origin testing;
- integration testing;
- future BAREA-007 compatibility;
- local/CI developer experience.

Both agents must issue explicit GO/NO-GO and must distinguish:

- documentation/design readiness;
- actual infrastructure readiness;
- application merge readiness.

Do not manufacture approval.

## DOCUMENTATION

Synchronize only the appropriate existing documentation:

- `DECISIONS.md` / ADR-012
- `ROADMAP.md`
- `AGY-REPORT.md`

Record actual selected target and actual provisioning state.

Never state that infrastructure is provisioned until it has been deployed and independently verified.

## GIT / MERGE RULES

Remain on `barea-006-share-join`.

Do not merge to `main`.
Do not start BAREA-007.
Do not add unrelated changes.
Do not commit secrets.

If only documentation changed, commit it clearly as documentation.
If infrastructure/application code is later explicitly authorized, commit the smallest possible scoped change.

## FINAL REPORT

Return:

### Hosting decision
- candidates considered;
- selected target or `NOT YET SELECTED`;
- rationale;
- major operational assumptions.

### Infrastructure
- provisioned / not provisioned;
- origin isolation;
- proxy authentication;
- TLS/DNS;
- client-IP provenance;
- direct-origin protection;
- health checks;
- secret lifecycle.

### Code
- application code changed: YES/NO;
- exact files;
- exact security boundary implemented, if authorized.

### Verification
- direct-origin test;
- spoofed-header test;
- proxy-auth test;
- distinct-client bucket test;
- bucket-hopping test;
- NAT-scale test;
- full test suite;
- typecheck;
- build;
- build:next;
- git diff --check.

### Two-agent review
- Agent 1: GO/NO-GO + findings;
- Agent 2: GO/NO-GO + findings.

## STOP CONDITIONS

### If hosting is not selected:
**STOP — NO PROVISIONING, NO APPLICATION CHANGES, NO MERGE.**

### If hosting is selected but not provisioned:
**STOP — NO CLAIM OF PRODUCTION READINESS.**

### If infrastructure is provisioned but integration tests are not complete:
**STOP — NO MERGE.**

### Only after infrastructure, integration tests, two-agent review, and ChatGPT independent review all pass:
**ChatGPT may issue explicit merge authorization.**
