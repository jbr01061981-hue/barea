# AGY PROMPT — BAREA ADR-012 CLOUDFLARE TUNNEL DEPLOYMENT

Repository: `jbr01061981-hue/barea`

## EXECUTION AUTHORITY

You are authorized to directly inspect, modify, test, document, and commit the repository as required for this deployment task.

Phase 7 is COMPLETED and MERGED into `main`.

Work from the CURRENT `main` state. GitHub/repository state is the source of truth.

This task is now explicitly an **ADR-012 deployment task**.

The selected architecture is:

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE (DNS / HTTPS / TLS)
      |
      v
CLOUDFLARE TUNNEL (`cloudflared`, outbound-only)
      |
      v
127.0.0.1:3000
      |
      v
BAREA NEXT.JS / NODE.JS ORIGIN
      |
      v
LOCAL SQLITE (`node:sqlite` / `DatabaseSync`)
```

## 1. NON-NEGOTIABLE ARCHITECTURE DECISION

ADR-012 is the deployment architecture for the CURRENT BAREA application.

**Deploy BAREA through Cloudflare Tunnel to a private Node.js origin.**

Do NOT deploy the current BAREA application directly to Cloudflare Workers.

The current application uses Node.js-native persistence/runtime facilities including `node:sqlite` / `DatabaseSync` and local filesystem/path APIs. The current application therefore remains on a Node.js runtime.

Cloudflare is the public edge and ingress layer; it is NOT the application runtime for the current BAREA deployment.

Do NOT:

- migrate SQLite to Cloudflare D1;
- migrate to PostgreSQL/external SQL as part of this task;
- add Durable Objects, KV, R2, Queues, or other storage merely to enable Workers;
- convert the root repository to ESM;
- use vinext/OpenNext to force the application onto Workers;
- create a Worker wrapper that attempts to execute the Node.js application;
- redesign persistence or backend architecture;
- start a new BAREA product phase.

A future Worker/D1 or other persistence-port milestone may be proposed separately, but it is OUT OF SCOPE here.

## 2. VERIFY CURRENT BASELINE FIRST

Run and record:

```text
git status
git branch --show-current
git log -10 --oneline
git remote -v
```

Confirm:

- branch is `main`;
- Phase 7 is merged;
- working tree state;
- current HEAD;
- current application structure.

Do not rely on old frontend branches or historical deployment configuration.

## 3. READ THE AUTHORITATIVE ARCHITECTURE

Read the current:

```text
README.md
docs/DECISIONS.md
docs/ROADMAP.md
package.json
package-lock.json
```

and relevant deployment/application source.

Locate and read **ADR-012: Edge Reverse Proxy and Origin Ingress Trust Boundary**.

Treat ADR-012 as the governing deployment decision unless current repository evidence proves it has been formally superseded.

Do not silently reinterpret ADR-012 as a Worker deployment.

## 4. RUNTIME FINDING — ALREADY ESTABLISHED

The prior runtime audit identified a genuine:

**CLOUDFLARE RUNTIME / DEPLOYMENT ARCHITECTURE GAP**

because the current application depends on Node.js-native SQLite and local filesystem behavior that cannot be supplied by the Cloudflare Workers runtime.

This finding is accepted for this task.

Do not spend this task trying alternative Worker adapters to defeat that finding.

The correct resolution is deployment topology, not application migration.

## 5. PRESERVE THE ROOT MODULE CONTRACT

The root repository remains CommonJS-compatible.

Preserve:

```text
package.json without root "type": "module"
TypeScript Node16 module/moduleResolution contract
CommonJS test execution
`dist/index.js` public CommonJS contract
```

Do NOT perform a repository-wide ESM migration.

Do NOT rewrite imports solely for deployment.

## 6. REMOVE/REJECT WORKER DEPLOYMENT ARTIFACTS

Inspect the current repository for Worker-specific deployment artifacts introduced by previous failed experiments, including:

```text
wrangler.jsonc
wrangler.toml
vite.config.*
open-next.config.*
vinext configuration
Worker deployment scripts
@opennextjs/* dependencies
```

Determine whether each artifact is still required.

Remove obsolete Worker/OpenNext/vinext deployment configuration ONLY if it is clearly an artifact of the failed Worker deployment and removal is safe.

Do not remove unrelated or required application configuration.

If uncertain, report the item rather than guessing.

Preserve the historical record of the failed Worker/OpenNext attempt in documentation.

## 7. NODE ORIGIN REQUIREMENTS

The BAREA origin must run using the native Node.js runtime supported by the application.

Verify the supported Node.js version from the repository and deployment documentation. Do not invent a version requirement.

The production-style origin must bind only to loopback:

```text
127.0.0.1:3000
```

Use an explicit host/port configuration such as:

```text
next start -H 127.0.0.1 -p 3000
```

or the repository's verified equivalent.

Do not expose port 3000 directly to the public Internet.

## 8. CLOUDFLARE TUNNEL IMPLEMENTATION

Implement/document the ADR-012 topology using `cloudflared`.

The intended ingress is:

```text
hostname -> http://127.0.0.1:3000
```

Use the current authoritative Cloudflare Tunnel documentation to verify exact commands/configuration.

A typical topology is:

```yaml
 tunnel: <TUNNEL_UUID>
 credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
 ingress:
   - hostname: <BAREA_HOSTNAME>
     service: http://127.0.0.1:3000
   - service: http_status:404
```

Do NOT invent the tunnel UUID, hostname, credentials, DNS record, or deployment result.

Use placeholders in committed documentation where physical provisioning has not yet occurred.

## 9. ORIGIN NETWORK ISOLATION

The deployment must preserve the ADR-012 trust boundary:

- Next.js listens on `127.0.0.1:3000` only;
- port 3000 is not publicly exposed;
- `cloudflared` establishes the outbound connection to Cloudflare;
- Cloudflare dispatches requests through the authenticated tunnel to the loopback origin.

Do NOT document or implement a fictional Cloudflare source-CIDR allowlist for inbound connections to port 3000.

Do NOT claim that a normal Cloudflare Transform Rule provides cryptographic HMAC authentication.

If `BAREA_EDGE_SECRET` is present in the existing architecture, describe it accurately as a defense-in-depth shared secret only, not an HMAC, unless current code explicitly implements cryptographic signing.

Do not alter the existing security implementation merely for deployment.

## 10. CLOUDFLARE PROVISIONING GATE

Determine whether authenticated Cloudflare access is actually available.

Possible required credentials include a Cloudflare account/API credential or a Tunnel token, depending on the verified current provisioning method.

Never print secret values.
Never commit secrets.
Never fabricate credentials.
Never fabricate tunnel IDs, DNS records, URLs, deployment IDs, or successful live tests.

If credentials/access are unavailable:

1. prepare the repository-side deployment configuration/runbook safely;
2. report physical provisioning as **NOT PROVISIONED**;
3. report live external verification as **NOT RUN**;
4. do not claim the public site is deployed.

## 11. ENVIRONMENT / SECRETS

Do not commit:

```text
CLOUDFLARE_TUNNEL_TOKEN
Cloudflare API tokens
DATABASE_URL
SESSION_SECRET
COMPETITION_HMAC_SECRET
OAuth secrets
private keys
BAREA_EDGE_SECRET values
```

If required variables are missing, report the variable NAME only.

Separate development/staging/production configuration.

Do not modify production infrastructure unless explicitly authorized and credentials/access are genuinely available.

## 12. APPLICATION BUILD CONTRACT

Preserve the existing normal build contract.

If:

```text
npm run build
```

is the TypeScript distribution build, do not change its meaning merely for Cloudflare.

The Node.js deployment should use the repository's verified Next.js production build/start process.

Do not add a fake Worker build command.

If a dedicated deployment command is useful, it must correspond to the actual Node.js + Tunnel architecture and be clearly named/documented.

## 13. VALIDATION

Run the repository's actual quality gates discovered from the current package scripts, including where applicable:

```text
npm test
npm run typecheck
npm run build
npm run build:next
```

Do not claim a check passed unless it was actually run.

Report each as:

```text
PASS
FAIL
NOT RUN — reason
```

## 14. LOCAL NODE ORIGIN TEST

Run the real Next.js production build and local Node.js server where practical.

Verify at minimum:

```text
GET /
```

and the actual landing route reached by `/`.

Verify:

- HTTP status;
- HTML response;
- CSS/assets;
- JavaScript;
- server runtime;
- absence of Node runtime errors;
- API/server-action behavior where applicable.

The test is a Node.js origin test, NOT a Worker test.

## 15. LOCAL CLOUDFLARED TEST

If `cloudflared` is installed and a safe local tunnel/test mode is available, use it only according to current Cloudflare documentation.

Do not fabricate a public tunnel result.

If authenticated Tunnel credentials are unavailable, report the Tunnel integration as NOT RUN / PENDING PHYSICAL PROVISIONING.

## 16. PHYSICAL CLOUDFLARE PROVISIONING

If authorized Cloudflare credentials and infrastructure are genuinely available, provision only the NON-PRODUCTION/staging environment first.

The intended sequence is:

1. prepare/verify Node.js origin;
2. bind origin to `127.0.0.1:3000`;
3. install/configure `cloudflared`;
4. create/configure Tunnel using real Cloudflare credentials;
5. map the real hostname to the Tunnel;
6. start `cloudflared` as a supervised service;
7. verify public HTTPS reaches the loopback origin;
8. verify direct public access to port 3000 is unavailable;
9. verify application behavior through the real Cloudflare path.

Use only real values.

## 17. SIX OPERATIONAL STATES

Keep these states distinct:

1. Architecture Specified
2. Infrastructure Provisioned
3. Infrastructure Operational
4. Client-IP Provenance Experimentally Verified
5. Application Integration Verified
6. Merge Authorized

Never collapse “configuration exists” into “infrastructure is operational.”

If physical Cloudflare infrastructure is unavailable, explicitly report states 2–5 as not yet verified as applicable.

## 18. SECURITY / PROVENANCE

Do not modify the existing BAREA security boundary.

Preserve the established ADR-012 model:

```text
PUBLIC CLIENT
  -> Cloudflare Edge
  -> authenticated outbound-only cloudflared Tunnel
  -> 127.0.0.1:3000
  -> BAREA Node.js application
```

The origin must not trust arbitrary public clients connecting directly to port 3000.

Do not add speculative request-signing systems.
Do not change authentication/authorization/session security.
Do not change BAREA-006 or BAREA-007 security/correctness behavior.

## 19. VISUAL INSPECTION

After a real deployment is available, inspect the actual BAREA homepage through the real public HTTPS hostname on:

- desktop;
- mobile.

Check:

- layout;
- typography;
- spacing;
- navigation;
- CTAs;
- responsive behavior;
- touch targets;
- overflow;
- missing assets;
- hydration/runtime errors;
- accidental debug UI.

Do NOT redesign the UI during deployment work.

Report issues separately as:

`POST-DEPLOYMENT UI OBSERVATIONS`

If no real public deployment exists, state visual inspection as NOT RUN rather than inspecting a fabricated URL.

## 20. DOCUMENTATION

Update the current deployment documentation to clearly state:

- ADR-012 is the current deployment topology;
- Cloudflare Edge/Tunnel is ingress, not the BAREA application runtime;
- BAREA runs on private Node.js;
- SQLite remains local to the Node.js origin;
- origin binds to `127.0.0.1:3000`;
- `cloudflared` provides the outbound-only Tunnel;
- exact verified Node build/start commands;
- Tunnel configuration/runbook;
- secret requirements without secret values;
- staging/production separation;
- provisioning and verification gates;
- known Worker incompatibility of the current persistence/runtime;
- previous OpenNext/Worker failure remains documented historically.

Do not rewrite history to hide previous failed deployment attempts.

## 21. GIT DISCIPLINE

Before modifications:

```text
git status
git diff
```

After modifications:

```text
git diff
git status
```

Review every changed file.

Create one focused deployment commit if repository changes are required.

Suggested commit message:

```text
chore(deploy): align BAREA with ADR-012 Cloudflare Tunnel
```

Do not force-push.
Do not rewrite history.
Do not merge unrelated work.
Do not resurrect obsolete frontend branches.

## 22. HARD STOP CONDITIONS

STOP and report if:

1. ADR-012 cannot be verified in the current repository.
2. The current Node.js runtime requirement cannot be established.
3. The origin cannot be safely bound to loopback.
4. Cloudflare Tunnel configuration cannot be established from authoritative current documentation.
5. Required Cloudflare credentials/access are unavailable for a requested live provisioning step.
6. Deployment would require changing production infrastructure without authorization.
7. Deployment would require migrating SQLite/D1/external SQL.
8. Deployment would require root ESM migration.
9. Deployment would require backend/security/authentication redesign.
10. Any live deployment result cannot be verified honestly.

When a hard stop occurs, report the exact blocker. Do not work around it by silently changing architecture.

## 23. FINAL REPORT

Return exactly:

## CURRENT BASELINE

```text
Branch:
HEAD:
Git status:
Phase 7 status:
```

## APPLICATION ARCHITECTURE

```text
Web application:
Framework:
Version:
Node.js runtime:
Package manager:
API:
Database:
```

## ADR-012 DEPLOYMENT ARCHITECTURE

```text
Edge:
Tunnel:
Origin:
Origin bind:
Origin port:
Public hostname:
```

## WORKER COMPATIBILITY

```text
Current application on Workers: NOT VIABLE / VIABLE
Reason:
Node-only dependencies:
Decision:
```

For the current known architecture, do not claim Worker viability unless new evidence conclusively establishes it.

## MODULE CONTRACT

```text
Root module type:
TypeScript module setting:
Test contract:
Public CommonJS contract:
```

Confirm the CommonJS contract was preserved.

## FILES CHANGED

List every changed file and its purpose.

## QUALITY GATES

```text
Lint: PASS / FAIL / NOT RUN
Typecheck: PASS / FAIL / NOT RUN
Tests: PASS / FAIL / NOT RUN
Normal build: PASS / FAIL / NOT RUN
Next.js production build: PASS / FAIL / NOT RUN
Local Node origin: PASS / FAIL / NOT RUN
Local cloudflared/Tunnel: PASS / FAIL / NOT RUN
```

## CLOUDFLARE PROVISIONING

```text
Infrastructure: PROVISIONED / NOT PROVISIONED
Tunnel: OPERATIONAL / NOT OPERATIONAL / NOT RUN
Hostname/DNS: VERIFIED / NOT VERIFIED / NOT RUN
Public URL: real value or NOT AVAILABLE
HTTP status: real value or NOT RUN
```

## END-TO-END RUNTIME CHECK

```text
Cloudflare Edge -> Tunnel -> Node origin: PASS / FAIL / NOT RUN
Homepage: PASS / FAIL / NOT RUN
Assets: PASS / FAIL / NOT RUN
API/server actions: PASS / FAIL / NOT RUN
Direct origin bypass: PASS / FAIL / NOT RUN
Client-IP provenance: PASS / FAIL / NOT RUN
```

## VISUAL INSPECTION

```text
Desktop: PASS / FAIL / NOT RUN
Mobile: PASS / FAIL / NOT RUN
Major issues:
Minor issues:
```

## SECURITY / ENVIRONMENT

Confirm:

- no secrets committed;
- no credentials exposed;
- no production database modified;
- no unauthorized production infrastructure modified;
- origin is not publicly exposed on port 3000;
- no authentication/authorization/security behavior changed;
- no SQLite-to-D1/external SQL migration performed;
- no root ESM migration performed.

## POST-DEPLOYMENT UI OBSERVATIONS

List observations only. Do not fix them unless separately authorized.

## NEXT STEP

STOP after ADR-012 deployment setup, real verification, and visual inspection.

Do NOT start the next BAREA product phase.
Do NOT migrate BAREA to Workers/D1.
Do NOT migrate the root repository to ESM.
Do NOT make unrelated changes.

## SUCCESS CRITERIA

This task succeeds when the current BAREA application is deployed using the verified ADR-012 topology:

```text
Cloudflare Edge
    -> authenticated Cloudflare Tunnel
    -> private Node.js BAREA origin
    -> local SQLite
```

while preserving application behavior, security boundaries, the root CommonJS contract, and truthful deployment evidence.

If physical Cloudflare provisioning cannot be completed because credentials/infrastructure are unavailable, safely prepare the repository-side deployment/runbook work and report the physical provisioning gate honestly as **NOT PROVISIONED**.

Never fabricate deployment success.