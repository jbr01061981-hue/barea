# AGY PROMPT — BAREA-006 DEPLOYMENT INFRASTRUCTURE GATE

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
Application code baseline: `eb8d4160ec2f0fb99f46ffa5b2153cc477e90976`
Architecture decision commit: `abfd81d`

## CURRENT STATUS — NO-GO / INFRASTRUCTURE REQUIRED

**STOP. DO NOT MODIFY BAREA-006 APPLICATION CODE. DO NOT MERGE. DO NOT START BAREA-007.**

The repository audit established that BAREA currently has no deployed or configured trusted edge/reverse-proxy boundary, origin firewall, private ingress, container deployment contract, or equivalent network control.

The current application safely ignores caller-controlled forwarding headers, but this means the current `127.0.0.1` fallback cannot provide a distinct per-client network identity for IP-based abuse controls.

Do not invent another application-only IP solution.

## AUDITED DECISION

The chosen architecture is **ADR-012 — Enforced Edge/Reverse-Proxy Trust Boundary**.

The required production topology is:

```text
PUBLIC INTERNET
      |
      v
Trusted Edge / Reverse Proxy
      |
      |  strips caller forwarding headers
      |  derives client IP from its own socket
      |  authenticates to origin
      v
Private / Firewalled BAREA Origin
      |
      |  Next.js / Node
      v
Port 3000 (NOT publicly reachable)
```

The architecture is technology-neutral. Cloudflare Tunnel, a private VPC/load balancer, an internal reverse proxy, or another equivalent design may be selected later.

Do NOT lock the product to a specific cloud provider unless the deployment decision is separately made.

## SECURITY INVARIANTS — NON-NEGOTIABLE

1. The BAREA origin MUST NOT be directly reachable by arbitrary Internet clients in production.
2. Only the trusted edge/proxy may reach the origin.
3. Public clients may send arbitrary `X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`, or `X-Barea-*` headers, but the trusted edge must strip/replace them before forwarding.
4. The edge derives the actual client address from its own trusted connection context.
5. The edge authenticates itself to the origin using mTLS, a high-entropy secret protected from public clients, or equivalent network identity.
6. The origin accepts proxy-provided client-IP information only after authenticating the proxy boundary.
7. A direct-origin request must not be able to impersonate the proxy.
8. A valid-looking forwarding header alone is never evidence of provenance.
9. `BAREA_TRUSTED_PROXY` alone is never evidence of provenance.
10. Client-provided `clientIp` values are never accepted as authoritative.
11. IP is an abuse-control signal, not an authentication/authorization identity.
12. Church NAT scalability must remain intact; do not impose successful-participant-per-IP seat limits.

## REQUIRED NEXT TASK — DESIGN THE DEPLOYMENT CONTRACT, NOT APPLICATION CODE

AGY must now document the smallest practical deployment contract needed to satisfy ADR-012.

Do NOT implement it inside `src/` while there is no actual deployment target.

Inspect and document:

- expected production hosting target candidates;
- origin exposure model;
- firewall/security-group/private-network requirement;
- trusted edge behavior;
- header stripping/replacement contract;
- proxy authentication mechanism;
- secret/mTLS lifecycle;
- health checks;
- TLS termination;
- logging/observability expectations;
- local development behavior;
- test environment behavior;
- failure behavior when the proxy credential is missing/invalid;
- how the edge obtains the real client IP;
- how the origin receives the canonical client IP;
- how direct-origin traffic is blocked.

If a concrete hosting provider is selected later, adapt the contract to that provider's documented primitives.

## PROHIBITED SHORTCUTS

Do NOT:

- trust forwarding headers directly in the application;
- add another regex/provenance heuristic;
- use `127.0.0.1` and claim that it is per-client identity;
- use a signed cookie as a substitute for the required production deployment boundary without a separately approved design;
- create a custom proxy implementation inside BAREA;
- add fake infrastructure files that claim a production boundary exists when no deployment actually enforces it;
- modify unrelated application functionality;
- start BAREA-007;
- merge.

## REQUIRED DOCUMENTATION UPDATE

Update only documentation/architecture records as needed to record this gate, using the existing repository documentation conventions.

At minimum keep synchronized:

- `DECISIONS.md` / ADR-012
- `AGY-REPORT.md`
- `ROADMAP.md` if milestone status is represented there

Clearly state:

- BAREA-006 implementation remains blocked for production release by missing deployment infrastructure;
- application code is intentionally fail-closed today;
- the selected deployment architecture is ADR-012;
- infrastructure provisioning is a prerequisite to final IP-based rate-limit identity behavior.

Do not claim infrastructure has been provisioned unless it actually has been provisioned and verified.

## TEST / VERIFICATION RULES

The existing application tests may continue to pass with the current fail-closed fallback. That does NOT constitute proof of production per-client IP differentiation.

Do not report NAT-scale IP bucket isolation as PASS unless there is a real authoritative per-client identity in the tested runtime/deployment.

When deployment infrastructure becomes available, add integration/e2e tests that prove:

### Direct-origin rejection

A direct public connection to the origin is rejected at the network boundary.

### Proxy authentication

A request without the trusted proxy credential cannot enter the trusted path.

### Header normalization

Public caller-supplied forwarding/attestation headers are stripped and replaced by the edge.

### Trusted client identity

Two legitimate clients arriving through the trusted edge receive distinct authoritative client identities where IP-based throttling requires them.

### Header spoofing

Changing `X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`, or `X-Barea-*` at the public edge does not let a caller select the origin's client identity.

### Church NAT

At least 50 legitimate participants behind one church NAT can join without successful-participant-per-IP seat quotas.

### Existing protections

Preserve authenticated-user join throttling, room lookup throttling, tenant isolation, error sanitization, session expiry, and BAREA-007 quarantine.

## TWO-AGENT REVIEW — DOCUMENTATION/ARCHITECTURE ONLY

Use exactly two fresh agents for the deployment architecture review.

### Agent 1 — Security + Deployment Architecture

Independently challenge:

- whether ADR-012 really establishes provenance;
- whether direct origin access is actually blocked;
- whether proxy authentication can be forged;
- whether headers are normalized by the edge;
- whether the design handles attacker-controlled public headers;
- whether the rate-limit identity is actually authoritative;
- whether church NAT remains safe;
- whether infrastructure assumptions are explicit.

### Agent 2 — QA + Operations / Implementability

Independently challenge:

- whether the deployment contract is implementable;
- whether secrets/mTLS can be provisioned and rotated;
- whether health checks and failure modes are defined;
- whether direct-origin negative tests are possible;
- whether deployment and integration tests can prove the invariants;
- whether local/test environments remain practical;
- whether the documentation is honest about what is and is not deployed.

Both agents must issue explicit GO/NO-GO for the **deployment architecture documentation**, not for application merge.

## MERGE RULE

**Never merge BAREA-006 based solely on passing unit tests while the production deployment boundary is not provisioned.**

The application branch remains unmergeable until:

1. the deployment target is selected;
2. the trusted edge/origin boundary is actually provisioned;
3. direct origin access is blocked;
4. the proxy authentication contract is deployed;
5. integration tests prove the client-IP provenance path;
6. the application consumes that authoritative identity safely;
7. the two-agent implementation/security review passes;
8. ChatGPT independently reviews the final implementation and explicitly authorizes merge.

## FINAL REPORT

Report:

### Deployment architecture
- selected hosting/deployment target, or state `NOT YET SELECTED`;
- edge technology, or state `NOT YET SELECTED`;
- origin isolation mechanism;
- proxy authentication mechanism;
- client-IP provenance mechanism;
- exact trust boundary;
- direct-origin protection;
- current infrastructure status.

### Documentation
- files changed;
- ADR changes;
- roadmap/report changes.

### Two-agent review
- Agent 1: GO/NO-GO + findings;
- Agent 2: GO/NO-GO + findings.

### Application code
- confirm **ZERO new application changes** unless a later explicit implementation authorization exists.

## STOP CONDITION

After documenting the deployment architecture gap and required infrastructure contract:

**STOP. DO NOT MERGE. DO NOT START BAREA-007. WAIT FOR A CONCRETE DEPLOYMENT DECISION AND CHATGPT REVIEW.**
