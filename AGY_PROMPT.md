# AGY PROMPT — BAREA ADR-012 CLOUDFLARE TUNNEL DEPLOYMENT EXECUTION

Repository: `jbr01061981-hue/barea`

## EXECUTION AUTHORITY

Execute this task directly. Inspect the repository, modify deployment/configuration documentation as necessary, run the available verification commands, and commit focused deployment changes to `main` when appropriate.

Do not merely produce another audit report. Implement the current approved deployment architecture as far as the available environment and credentials permit.

Phase 7 is COMPLETED and MERGED.
GitHub/repository state is the source of truth.

This is a deployment/infrastructure task only.

Do NOT start a new BAREA product phase.
Do NOT redesign the application.
Do NOT modify backend/security behavior unless a genuine deployment compatibility issue is proven and explicitly documented.

---

# 1. APPROVED DEPLOYMENT ARCHITECTURE — ADR-012

The current BAREA application MUST remain on a native Node.js runtime because it depends on Node.js-native persistence/runtime facilities including `node:sqlite` / `DatabaseSync` and local filesystem/path behavior.

The Cloudflare Workers runtime is NOT the application runtime for the current BAREA MVP.

The governing deployment topology is:

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE
DNS / HTTPS / TLS
      |
      v
CLOUDFLARE TUNNEL
cloudflared, outbound-only
      |
      v
127.0.0.1:3000
      |
      v
BAREA NEXT.JS / NODE.JS ORIGIN
      |
      v
LOCAL SQLITE
node:sqlite / DatabaseSync
```

Cloudflare provides the public edge and authenticated ingress path.

Node.js remains the BAREA application runtime.

SQLite remains the current persistence implementation.

## NON-NEGOTIABLE

Do NOT:

- deploy the current BAREA application directly to a Cloudflare Worker;
- migrate SQLite to Cloudflare D1;
- migrate SQLite to PostgreSQL/external SQL as part of this task;
- add Durable Objects, KV, R2, Queues, or other Cloudflare storage merely to enable Workers;
- migrate the root repository to ESM;
- use vinext/OpenNext to force the current application onto Workers;
- create a Worker wrapper around the Node.js application;
- redesign authentication, authorization, tenant isolation, session security, rate limiting, or backend behavior;
- start BAREA-007 or any later product phase;
- fabricate Cloudflare credentials, tunnel IDs, DNS records, hostnames, URLs, deployment IDs, or verification results.

A future Worker/D1 or other persistence-port milestone is separate and OUT OF SCOPE.

---

# 2. VERIFY THE CURRENT BASELINE

Before changes, run and record:

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

Read:

```text
README.md
docs/DECISIONS.md
docs/ROADMAP.md
package.json
package-lock.json
```

Locate and read ADR-012.

Do not rely on historical ChatGPT conversation state when current repository evidence is available.

---

# 3. PRESERVE EXISTING APPLICATION CONTRACTS

Preserve:

- root CommonJS package contract;
- no root `"type": "module"`;
- TypeScript Node16 module/moduleResolution behavior;
- CommonJS test execution;
- `dist/index.js` public CommonJS contract;
- current domain/service/persistence/transport behavior;
- current authentication/authorization/session/security behavior.

Do NOT rewrite imports merely for deployment.
Do NOT perform a broad refactor.

---

# 4. INSPECT AND CLEAN FAILED WORKER EXPERIMENTS

Inspect:

```text
wrangler.jsonc
wrangler.toml
vite.config.*
open-next.config.*
vinext configuration
Worker-specific scripts
@opennextjs/* dependencies
```

Determine whether each item is still legitimate for the CURRENT repository.

If an artifact exists solely because of the earlier failed Worker/OpenNext experiment and is obsolete, remove it safely and document the reason.

Do not remove legitimate Cloudflare/Tunnel documentation or application configuration.

Preserve the historical failure record.

---

# 5. VERIFY THE NATIVE NODE ORIGIN

Determine the supported Node.js version from the current repository/docs. Do not invent a requirement.

The production-style BAREA origin MUST bind only to loopback:

```text
127.0.0.1:3000
```

Use the repository's verified Next.js production command or an equivalent explicit command such as:

```text
next start -H 127.0.0.1 -p 3000
```

Do not expose port 3000 directly to the public Internet.

If `package.json` needs a deployment convenience script to enforce loopback binding, that is in scope provided it does not alter application semantics.

---

# 6. IMPLEMENT THE CLOUDFLARE TUNNEL RUNBOOK

Use current authoritative Cloudflare documentation to verify the exact `cloudflared` setup.

The intended ingress mapping is:

```text
<BAREA hostname> -> http://127.0.0.1:3000
```

Document a configuration shape such as:

```yaml
tunnel: <REAL_TUNNEL_UUID>
credentials-file: /etc/cloudflared/<REAL_TUNNEL_UUID>.json
ingress:
  - hostname: <REAL_BAREA_HOSTNAME>
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Use placeholders in committed documentation until real infrastructure is provisioned.

NEVER invent tunnel UUIDs, hostnames, credential contents, DNS records, or successful live results.

---

# 7. PHYSICAL CLOUDFLARE PROVISIONING

Determine whether `cloudflared` is installed and whether authenticated Cloudflare access is available.

If authorized access is available, provision NON-PRODUCTION/staging first.

Required operational sequence:

1. Verify Node.js origin.
2. Ensure origin binds to `127.0.0.1:3000`.
3. Install/configure `cloudflared` according to current Cloudflare documentation.
4. Create/configure a non-production Tunnel using real authorized credentials.
5. Configure ingress from the staging hostname to `http://127.0.0.1:3000`.
6. Configure DNS through the Tunnel using the current supported Cloudflare mechanism.
7. Start `cloudflared` as a supervised service appropriate to the target host.
8. Verify the public HTTPS path reaches the Node origin.
9. Verify direct public access to port 3000 is unavailable.

Do NOT modify production unless explicitly authorized and independently verified.

If credentials or a physical host are unavailable, complete all safe repository-side preparation and report physical provisioning as NOT PROVISIONED.

---

# 8. NETWORK / SECURITY BOUNDARY

Preserve:

```text
PUBLIC CLIENT
  -> Cloudflare Edge
  -> authenticated outbound-only cloudflared Tunnel
  -> 127.0.0.1:3000
  -> BAREA Node.js
```

Verify/document:

- origin binds only to loopback;
- port 3000 is not intentionally publicly exposed;
- `cloudflared` is the ingress path;
- origin is not expected to accept arbitrary Internet traffic.

Do NOT invent a Cloudflare source-CIDR allowlist for port 3000.
Do NOT claim a Transform Rule provides cryptographic request authentication.
Do NOT change security logic merely for deployment.

---

# 9. CLIENT-IP PROVENANCE

Do not modify the BAREA security implementation merely for deployment.

If the current application relies on edge-attested client-IP provenance, test the actual Cloudflare Tunnel path and report what is truly observed by the application.

Never claim cryptographic trust unless the current implementation actually establishes it.

Keep these operational states distinct:

1. Architecture Specified
2. Infrastructure Provisioned
3. Infrastructure Operational
4. Client-IP Provenance Experimentally Verified
5. Application Integration Verified
6. Merge Authorized

Do not collapse these into one “deployed” status.

---

# 10. SECRETS

Never print, commit, or expose secret values.

Never commit:

```text
CLOUDFLARE_TUNNEL_TOKEN
Cloudflare API tokens
Tunnel credential JSON
DATABASE_URL
SESSION_SECRET
COMPETITION_HMAC_SECRET
OAuth secrets
BAREA_EDGE_SECRET values
private keys
```

Use Cloudflare/environment secret mechanisms appropriate to the current environment.

If a required secret is missing, report its NAME only.

---

# 11. DATABASE SAFETY

Do NOT:

- migrate SQLite to D1;
- migrate SQLite to another database;
- run production migrations;
- change production schemas;
- add distributed storage solely for deployment.

The local SQLite architecture remains authoritative for this task.

---

# 12. BUILD / QUALITY CONTRACT

Preserve the existing normal build semantics.

If `npm run build` is the TypeScript distribution build, do not change its meaning merely for deployment.

For the Node.js origin, use the current verified Next.js production build/start process.

Run the actual repository quality gates available in `package.json`, including where applicable:

```text
npm test
npm run typecheck
npm run build
npm run build:next
```

Do not claim a check passed unless it actually ran.

Report each check as PASS / FAIL / NOT RUN with reason.

---

# 13. LOCAL NODE ORIGIN VALIDATION

Build the current Next.js application and run the production Node.js origin locally where practical.

Verify at minimum:

```text
GET /
```

and the actual route reached after the root behavior.

Check:

- HTTP status;
- HTML;
- CSS/assets;
- JavaScript;
- runtime errors;
- server errors;
- SQLite initialization;
- API/Route Handler behavior;
- relevant Server Actions where practical.

This is a Node.js origin test, NOT a Worker test.

---

# 14. CLOUDFLARED LOCAL / REMOTE TEST

If `cloudflared` is installed and authenticated access is available, test the Tunnel according to current Cloudflare documentation.

If credentials or a physical origin host are unavailable:

- prepare configuration/runbook;
- do not invent a live Tunnel;
- do not invent a public hostname;
- mark Tunnel provisioning as NOT RUN / PENDING.

---

# 15. END-TO-END VERIFICATION

When a real staging Tunnel exists, verify:

```text
Cloudflare Edge
  -> Cloudflare Tunnel
  -> 127.0.0.1:3000
  -> BAREA Next.js
  -> SQLite
```

Verify:

- public HTTPS reaches the application;
- `/` behaves correctly;
- assets load;
- application routes work;
- relevant API/server actions work;
- direct public access to 127.0.0.1:3000 is not possible from the Internet;
- no unexpected runtime errors occur.

Use real observations only.

---

# 16. VISUAL INSPECTION

Only when a real public/staging HTTPS deployment exists, inspect the actual BAREA homepage on:

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
- debug UI.

Do NOT redesign the UI during deployment work.

Without a real public deployment, report visual inspection as NOT RUN.

---

# 17. DOCUMENTATION

Update deployment documentation so it accurately records:

- ADR-012 topology;
- Cloudflare Edge/Tunnel role;
- private Node.js origin;
- loopback binding `127.0.0.1:3000`;
- cloudflared setup;
- required variables by NAME only;
- non-production/staging procedure;
- production procedure without executing production changes;
- verification gates;
- current Worker runtime incompatibility;
- historical OpenNext/Worker failure.

Do not rewrite history to hide failed experiments.

---

# 18. GIT DISCIPLINE

Before changes:

```text
git status
git diff
```

After changes:

```text
git diff
git status
```

Review every changed file.

If repository changes are required, create ONE focused deployment commit.

Suggested message:

```text
chore(deploy): implement ADR-012 Cloudflare Tunnel topology
```

Do not force-push.
Do not rewrite history.
Do not create unrelated branches or PRs.
Do not merge unrelated work.

---

# 19. HARD STOP CONDITIONS

Stop and report a concrete blocker only when:

1. ADR-012 cannot be verified.
2. The current Node.js origin cannot be established.
3. The origin cannot safely bind to loopback.
4. Required Cloudflare credentials/access are unavailable for a requested physical provisioning step.
5. `cloudflared` cannot be used on the target host/environment.
6. Deployment would require unauthorized production changes.
7. Deployment would require SQLite/D1/external-SQL migration.
8. Deployment would require root ESM migration.
9. Deployment would require backend/security/authentication redesign.

When blocked by infrastructure access:

- complete every safe repository-side step first;
- state exactly what remains pending;
- do not stop at the already-established Worker runtime gap because ADR-012 is the approved resolution for this MVP.

---

# 20. FINAL REPORT

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

## ADR-012 DEPLOYMENT

```text
Edge:
Tunnel:
Origin:
Origin bind:
Origin port:
Hostname:
```

## WORKER DECISION

```text
Current application on Workers: NOT VIABLE
Decision: ADR-012 Node.js origin + Cloudflare Tunnel
Reason:
```

## MODULE CONTRACT

```text
Root module type:
TypeScript module setting:
Test contract:
Public CommonJS contract:
```

Confirm these remained intact.

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
cloudflared/Tunnel: PASS / FAIL / NOT RUN
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
- no SQLite-to-D1/external-SQL migration performed;
- no root ESM migration performed.

## POST-DEPLOYMENT UI OBSERVATIONS

List observations only. Do not redesign the UI.

## NEXT STEP

STOP after ADR-012 deployment implementation, actual verification, and visual inspection where available.

Do NOT start the next BAREA product phase.

---

# SUCCESS CRITERIA

The task is successful when the available environment permits genuine completion of these items:

1. Current Phase-7 `main` baseline verified.
2. ADR-012 verified as the governing deployment architecture.
3. Worker runtime gap accepted without application migration.
4. Node.js origin verified.
5. Origin binds to `127.0.0.1:3000`.
6. Cloudflare Tunnel configuration/runbook implemented.
7. Non-production infrastructure provisioned when real credentials/access permit.
8. Public HTTPS verified when real infrastructure exists.
9. Edge -> Tunnel -> Node -> SQLite path verified when infrastructure exists.
10. Desktop/mobile visual inspection performed when a real deployment exists.
11. CommonJS/test/public-export contracts preserved.
12. No production infrastructure modified without explicit authorization.
13. No backend/security/domain redesign performed.
14. Deployment documentation updated.
15. Changes committed cleanly if changes were required.

If live provisioning cannot be completed because authorized Cloudflare access or a physical origin host is unavailable, complete all safe repository-side work and report the exact pending provisioning action instead of fabricating success.
