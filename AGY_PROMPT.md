# AGY PROMPT — BAREA ADR-012 CLOUDFLARE TUNNEL DEPLOYMENT EXECUTION

Repository: `jbr01061981-hue/barea`

## EXECUTION AUTHORITY

Execute this task directly. Inspect the repository, modify deployment/configuration documentation as necessary, run the available verification commands, and commit the focused deployment changes to `main` when appropriate.

Do not merely produce a recommendation or another audit report. The purpose of this prompt is to IMPLEMENT the current approved deployment architecture as far as the available environment and credentials permit.

GitHub/repository state is the source of truth.

Phase 7 is already COMPLETED and MERGED.

Do NOT start the next BAREA product phase.

---

# 1. APPROVED ARCHITECTURAL DECISION

The previous Cloudflare Worker audit established a genuine:

**CLOUDFLARE RUNTIME / DEPLOYMENT ARCHITECTURE GAP**

The current BAREA application depends on Node.js-native `node:sqlite` / `DatabaseSync` and local filesystem behavior. The current application is therefore NOT to be deployed directly into the Cloudflare Workers runtime.

The approved deployment topology is ADR-012:

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

Cloudflare is the public edge/ingress layer.

Node.js remains the BAREA application runtime.

SQLite remains the current persistence implementation.

## NON-NEGOTIABLE

DO NOT:

- deploy the current BAREA application directly to Workers;
- migrate SQLite to D1;
- migrate SQLite to PostgreSQL/external SQL;
- introduce Durable Objects, KV, R2, Queues, or another storage system merely for deployment;
- migrate the root repository to ESM;
- use vinext/OpenNext to force the current application onto Workers;
- create a Worker wrapper around the Node application;
- redesign authentication, authorization, sessions, database security, or backend behavior;
- start BAREA-007 or another product phase;
- fabricate Cloudflare credentials, tunnel IDs, DNS records, hostnames, URLs, deployment IDs, or verification results.

A future persistence-port or Worker architecture may be proposed as a separate milestone only. It is OUT OF SCOPE for this task.

---

# 2. VERIFY BEFORE CHANGING ANYTHING

Run:

```text
git status
git branch --show-current
git log -10 --oneline
git remote -v
```

Confirm the actual current HEAD and working-tree state.

Read:

```text
README.md
docs/DECISIONS.md
docs/ROADMAP.md
package.json
package-lock.json
```

Locate and read ADR-012.

Inspect the current Next.js application and deployment-related files.

Do not rely on historical reports when current repository evidence can answer the question.

---

# 3. PRESERVE APPLICATION CONTRACTS

The current repository's CommonJS contract MUST remain intact.

Preserve:

- no root `"type": "module"`;
- TypeScript Node16 module/moduleResolution behavior;
- CommonJS test execution;
- `dist/index.js` public CommonJS contract;
- current domain, persistence, service, transport, authentication, authorization, session, and security behavior.

Do not rewrite application imports solely for deployment.

Do not perform a broad refactor.

---

# 4. CLEAN UP FAILED WORKER EXPERIMENTS ONLY WHEN PROVEN OBSOLETE

Inspect for:

```text
wrangler.jsonc
wrangler.toml
vite.config.*
open-next.config.*
vinext configuration
Worker-specific scripts
automatic OpenNext configuration/dependencies
```

Determine whether these are still required by the current application.

If an artifact exists solely because of the failed Worker experiment and is no longer required, remove it safely and document why.

Do not remove anything merely because it mentions Cloudflare.

Preserve historical documentation of the failed Worker/OpenNext attempt.

---

# 5. IMPLEMENT THE NODE ORIGIN

Use the repository's actual supported Node.js version. Verify it; do not invent one.

The BAREA origin must listen on loopback only:

```text
127.0.0.1:3000
```

Use the repository's verified production command or an equivalent explicit command such as:

```text
next start -H 127.0.0.1 -p 3000
```

Do not expose port 3000 directly to the Internet.

Do not alter application runtime code unless required to make the verified origin listen safely on loopback.

---

# 6. IMPLEMENT / DOCUMENT CLOUDFLARE TUNNEL

Use current authoritative Cloudflare documentation to implement the ADR-012 Tunnel topology.

The intended mapping is:

```text
<BAREA hostname> -> http://127.0.0.1:3000
```

A typical configuration shape is:

```yaml
tunnel: <REAL_TUNNEL_UUID>
credentials-file: /etc/cloudflared/<REAL_TUNNEL_UUID>.json
ingress:
  - hostname: <REAL_BAREA_HOSTNAME>
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Use placeholders in repository documentation when real infrastructure has not yet been provisioned.

NEVER invent values.

If Cloudflare authentication/access is available, provision the NON-PRODUCTION environment first using real values.

If access is unavailable, complete all safe repository-side preparation and clearly mark physical provisioning as pending.

---

# 7. TUNNEL SECURITY / NETWORK BOUNDARY

Preserve ADR-012's trust boundary:

```text
Client
  -> Cloudflare Edge
  -> authenticated outbound-only cloudflared Tunnel
  -> 127.0.0.1:3000
  -> BAREA Node.js
```

Verify/document that:

- Node binds to loopback;
- port 3000 is not intentionally publicly exposed;
- cloudflared establishes outbound connectivity;
- the Tunnel is the ingress path.

Do NOT invent a Cloudflare source-IP allowlist as a substitute for the Tunnel.

Do NOT claim that a Transform Rule provides cryptographic request authentication.

Do not modify existing security behavior merely for deployment.

---

# 8. SECRETS AND CREDENTIALS

Never print or commit secret values.

Never commit:

```text
CLOUDFLARE_TUNNEL_TOKEN
Cloudflare API tokens
Tunnel credentials JSON
DATABASE_URL
SESSION_SECRET
COMPETITION_HMAC_SECRET
OAuth secrets
BAREA_EDGE_SECRET values
private keys
```

If a required secret is missing, report its NAME only.

If credentials are available through an authorized local environment, use them without exposing their values.

---

# 9. DO NOT CHANGE THE NORMAL BUILD CONTRACT

Inspect `package.json`.

If `npm run build` is the TypeScript distribution build, preserve that meaning.

For the Node.js origin, use the actual Next.js production build/start process already supported by the repository.

Do not create a fake Worker build command.

Do not configure Wrangler to auto-detect and transform this Next.js application into OpenNext.

---

# 10. QUALITY GATES

Run the actual available quality gates, including where applicable:

```text
npm test
npm run typecheck
npm run build
npm run build:next
```

Use the current package scripts; do not assume every command exists.

Report each command as:

```text
PASS
FAIL
NOT RUN — reason
```

Do not claim a command passed unless it actually ran.

---

# 11. LOCAL NODE PRODUCTION TEST

Build the Next.js application and run the production Node origin locally where practical.

Verify:

```text
GET /
```

and the route reached after the root redirect.

Check:

- HTTP status;
- HTML;
- CSS/assets;
- JavaScript;
- hydration/runtime errors;
- server errors;
- Node.js SQLite initialization;
- relevant API/server-action behavior.

This is a Node origin test, NOT a Worker test.

---

# 12. CLOUDFLARED TEST / PROVISIONING

Determine whether `cloudflared` is installed and whether authenticated Cloudflare access is available.

If both are available, implement and test the non-production Tunnel using the real infrastructure.

If not available:

- prepare the repository-side runbook/configuration;
- do not fabricate a Tunnel;
- do not fabricate a public hostname;
- do not claim public HTTPS works;
- mark physical provisioning and public verification as NOT RUN / PENDING.

If Cloudflare credentials are available, do NOT modify production. Provision staging/non-production first.

---

# 13. END-TO-END VERIFICATION

When a real Tunnel exists, verify the complete path:

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
- direct access to port 3000 from the public Internet is unavailable;
- no unexpected runtime errors occur.

Use real observations only.

---

# 14. CLIENT-IP / PROVENANCE

Do not modify BAREA security code merely to make deployment work.

If ADR-012 requires client-IP provenance verification, test and report what the deployed path actually supplies to the application.

Do not claim provenance is cryptographically trusted unless the current implementation actually establishes that property.

Keep these states separate:

1. Architecture Specified
2. Infrastructure Provisioned
3. Infrastructure Operational
4. Client-IP Provenance Experimentally Verified
5. Application Integration Verified
6. Merge Authorized

Never collapse these states into one “deployed” claim.

---

# 15. VISUAL INSPECTION

If and only if a real public/staging HTTPS deployment exists, inspect the actual BAREA application on:

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

Do NOT redesign the UI in this task.

If there is no real public deployment, report visual inspection as NOT RUN.

---

# 16. DOCUMENTATION

Update the appropriate deployment documentation to describe the implemented/current state:

- ADR-012 Cloudflare Edge + Tunnel + private Node origin;
- Node.js runtime requirement;
- loopback origin `127.0.0.1:3000`;
- cloudflared configuration/runbook;
- required environment variables by NAME only;
- staging/non-production procedure;
- production procedure without performing production changes;
- verification gates;
- current Worker incompatibility;
- previous failed OpenNext/Worker experiment as historical record.

Do not rewrite history.

---

# 17. GIT DISCIPLINE

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

If repository changes are required, create ONE focused deployment commit.

Suggested commit message:

```text
chore(deploy): implement ADR-012 Cloudflare Tunnel topology
```

Do not force-push.
Do not rewrite history.
Do not merge unrelated work.
Do not resurrect obsolete frontend branches.

---

# 18. HARD STOP CONDITIONS

STOP only when the requested implementation genuinely cannot proceed because of a concrete blocker, such as:

1. ADR-012 cannot be verified;
2. the Node origin cannot be established;
3. required Cloudflare credentials/access are unavailable for a requested live provisioning step;
4. `cloudflared` cannot be installed/used in the available environment;
5. deployment would require production changes without authorization;
6. deployment would require SQLite-to-D1/external-SQL migration;
7. deployment would require root ESM migration;
8. deployment would require backend/security/authentication redesign.

When blocked, do NOT stop at the old “Worker runtime gap” report. That gap is already accepted and resolved architecturally by selecting ADR-012.

Instead:

1. complete every safe repository-side implementation step;
2. identify the exact remaining blocker;
3. report what is complete and what remains pending.

---

# 19. FINAL REPORT

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
Reason:
Decision: Use ADR-012 Node origin + Cloudflare Tunnel
```

## MODULE CONTRACT

```text
Root module type:
TypeScript module setting:
Test contract:
Public CommonJS contract:
```

Confirm these were preserved.

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

STOP after ADR-012 deployment implementation, verification, and visual inspection.

Do NOT start the next BAREA product phase.

---

# SUCCESS CRITERIA

The task is successful when as many of the following as the available environment permits are genuinely completed:

1. Current Phase-7 `main` baseline verified.
2. ADR-012 verified as the governing deployment architecture.
3. Worker runtime gap accepted without application migration.
4. Node.js origin verified.
5. Origin binds to `127.0.0.1:3000`.
6. Cloudflare Tunnel configuration/runbook implemented.
7. Required staging infrastructure provisioned when credentials/access permit.
8. Public HTTPS verified when real infrastructure exists.
9. End-to-end Edge → Tunnel → Node → SQLite path verified when infrastructure exists.
10. Desktop/mobile visual inspection performed when a real deployment exists.
11. CommonJS/test/public-export contracts preserved.
12. No production infrastructure modified without explicit authorization.
13. No backend/security/domain redesign performed.
14. Deployment documentation updated.
15. Changes committed cleanly.

If live Cloudflare provisioning cannot be completed because the environment lacks authorized credentials or infrastructure access, do NOT fabricate success. Complete the repository-side work and report the exact pending provisioning step.
