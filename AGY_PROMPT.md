# AGY PROMPT — BAREA-006 DEPLOYMENT DECISION GATE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Current application checkpoint: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Architecture decision record: ADR-012

## CURRENT STATUS

**NO-GO FOR MERGE — INFRASTRUCTURE IS NOT PROVISIONED.**

The repository has correctly stopped application-code changes after determining that a standalone Next.js 16.3.4 Server Action runtime cannot establish trustworthy per-client IP provenance from caller-visible forwarding headers.

The current application fallback to `127.0.0.1` is intentionally fail-closed, but it must NOT be represented as a real per-client identity because that would collapse all unauthenticated clients into one global rate-limit bucket.

Do not attempt another application-only workaround.

## ARCHITECTURE DECISION

ADR-012 selects an **enforced edge/reverse-proxy trust boundary**.

Required production topology:

```text
PUBLIC INTERNET
      |
      v
TRUSTED EDGE / REVERSE PROXY
      |
      |  strips caller-controlled forwarding headers
      |  derives client IP from its own connection context
      |  authenticates to origin
      v
PRIVATE / FIREWALLED BAREA ORIGIN
      |
      v
NEXT.JS / NODE :3000
```

Technology remains intentionally unselected. Valid implementations may include Cloudflare Tunnel, private VPC/load balancer, or a private reverse proxy such as Nginx/Caddy, provided the same security invariants are actually enforced.

## NON-NEGOTIABLE INVARIANTS

1. Public Internet clients MUST NOT be able to reach the BAREA origin directly.
2. Only the trusted edge/proxy can reach the origin.
3. Public caller-supplied `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP`, and `X-Barea-*` values cannot establish provenance.
4. The edge derives the client address from its own connection context.
5. The edge-to-origin channel is authenticated using mTLS, a secret unavailable to public callers, or equivalent enforced network identity.
6. The edge strips caller-supplied forwarding and attestation headers and writes canonical internal values.
7. The origin consumes the canonical client-IP value only after authenticating the trusted edge boundary.
8. Direct-origin requests cannot impersonate the edge.
9. `BAREA_TRUSTED_PROXY` alone is never proof of provenance.
10. IP is an abuse-control signal only, never an authentication/authorization identity.
11. No successful-participant-per-IP seat quota may be introduced; church NAT scalability must remain intact.

## WHAT HAS ALREADY BEEN ESTABLISHED

The previous audit established that, in the current repository:

- there is no Docker/deployment manifest;
- there is no Nginx/Caddy/Traefik configuration;
- there is no Cloudflare Tunnel or equivalent edge configuration;
- production hosting is still an open technical decision;
- Next.js Server Actions do not expose the raw Node socket to action code;
- caller-supplied forwarding headers are forgeable when the origin is directly reachable.

Do not dispute or bypass these findings without concrete repository/runtime evidence.

## TASK A — DOCUMENT THE DEPLOYMENT CONTRACT

Update the architecture documentation so ADR-012 records the minimum production contract.

At minimum document:

- production hosting target as `NOT YET SELECTED` until the user selects one;
- edge technology as `NOT YET SELECTED` until selected;
- origin isolation/private ingress requirements;
- exact port 3000 exposure rule;
- firewall/security-group/private-network requirement;
- edge header stripping/replacement behavior;
- authoritative client-IP extraction at the edge;
- edge-to-origin authentication;
- secret/mTLS rotation;
- TLS termination;
- health checks;
- logging/observability;
- failure behavior;
- local development/test behavior;
- direct-origin attack behavior.

Keep the contract technology-neutral unless a concrete hosting decision has been made.

## TASK B — DOCUMENT THE IMPLEMENTATION CHECKPOINT

Make it explicit that the application currently remains safely anchored at `eb8d416` with forwarding headers ignored.

Do not claim that the application currently has real per-client IP differentiation.

Do not claim that infrastructure is provisioned.

Do not claim that BAREA is production-release-ready.

## TASK C — OPTIONAL FUTURE DEPLOYMENT IMPLEMENTATION

Do NOT implement deployment infrastructure or application proxy-attestation code now unless the user separately selects a concrete hosting target and explicitly authorizes deployment implementation.

Do NOT create fake Nginx/Cloudflare/AWS/GCP configuration merely to make the repository look deployment-ready.

## APPLICATION CODE RULE

**ZERO NEW BAREA-006 APPLICATION CODE in `src/`.**

The current application implementation must remain fail-closed until a real deployment boundary exists.

Do not modify:

- session authorization semantics;
- rate-limiter semantics solely to hide the infrastructure gap;
- tenant security;
- authentication;
- admission policies;
- BAREA-007 behavior.

## TWO-AGENT REVIEW

Use exactly two fresh agents to review the deployment architecture documentation.

### Agent 1 — Security + Deployment Architecture

Challenge:

- provenance guarantees;
- direct-origin isolation;
- proxy authentication;
- header stripping/normalization;
- public-header spoofing;
- client-IP authority;
- NAT scalability;
- secret/mTLS security;
- failure modes.

### Agent 2 — QA + Operations / Implementability

Challenge:

- operational feasibility;
- secret rotation;
- TLS/health checks;
- deployment testing;
- direct-origin negative testing;
- local/CI practicality;
- observability;
- documentation accuracy.

Both agents issue GO/NO-GO for the **architecture documentation only**.

Do NOT use these documentation-review verdicts as application merge authorization.

## MERGE GATE

BAREA-006 cannot be merged into `main` until all of the following are true:

1. A concrete production hosting/deployment target is selected.
2. The edge/origin boundary is actually provisioned.
3. The origin cannot be reached directly by arbitrary Internet clients.
4. Proxy authentication is actually deployed.
5. The edge strips/rewrites client-controlled forwarding headers.
6. Integration/deployment tests prove direct-origin rejection and client-IP provenance.
7. Application code consumes the authoritative identity only after verifying the trusted edge.
8. Two fresh implementation/security reviewers pass.
9. ChatGPT independently reviews the final code and explicitly authorizes merge.

Passing the existing 134 unit tests does not satisfy this deployment gate.

## REQUIRED DOCUMENTATION SYNCHRONIZATION

Keep synchronized as appropriate:

- `DECISIONS.md` / ADR-012
- `ROADMAP.md`
- `AGY-REPORT.md`

State clearly:

**BAREA-006 — BLOCKED FOR PRODUCTION RELEASE: INFRASTRUCTURE REQUIRED.**

## FINAL REPORT

Return:

### Deployment status
- production target: `SELECTED` or `NOT YET SELECTED`;
- edge technology: `SELECTED` or `NOT YET SELECTED`;
- origin isolation status;
- proxy authentication status;
- client-IP provenance status;
- direct-origin protection status.

### Documentation
- exact files changed;
- ADR changes;
- roadmap/report changes.

### Two-agent architecture review
- Agent 1: GO/NO-GO + findings;
- Agent 2: GO/NO-GO + findings.

### Application
- confirm whether any `src/` files changed;
- if none, explicitly report `ZERO APPLICATION CODE CHANGED`.

## STOP CONDITION

After the deployment contract is documented and two-agent architecture review is complete:

**STOP. DO NOT MERGE. DO NOT START BAREA-007. DO NOT INVENT A PROXY. WAIT FOR THE USER TO SELECT A PRODUCTION DEPLOYMENT TARGET AND FOR CHATGPT TO REVIEW THAT DECISION.**
