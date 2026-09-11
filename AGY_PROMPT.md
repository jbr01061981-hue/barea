# AGY PROMPT — BAREA LOCAL/REMOTE DEPLOYMENT READINESS

Repository: `jbr01061981-hue/barea`
Branch: `main`

## EXECUTION AUTHORITY

Execute this task directly. Do not merely provide recommendations.

Current approved deployment architecture: **ADR-012 — Node.js + local SQLite behind Cloudflare Tunnel**.

Do NOT deploy the current BAREA application directly to Cloudflare Workers.
Do NOT migrate SQLite to D1/PostgreSQL.
Do NOT migrate the root repository to ESM.
Do NOT start the next product/frontend phase.
Do NOT redesign the application.
Do NOT modify authentication, authorization, tenant isolation, session security, live-quiz correctness, or other security behavior unless a genuine defect is independently proven and explicitly in scope.

The immediate objective is to get the current repository to a clean, verified state and determine readiness for the physical Cloudflare Tunnel provisioning step.

---

# 1. VERIFY THE CURRENT BASELINE

Run:

```text
git status
git branch --show-current
git log -10 --oneline
git remote -v
```

Confirm:

- current branch is `main`;
- Phase 7 is merged;
- working tree is clean before changes;
- current HEAD is recorded.

Read current source-of-truth documentation and package configuration:

```text
README.md
docs/DECISIONS.md
docs/ROADMAP.md
package.json
package-lock.json
```

Locate ADR-012 and treat it as the governing MVP deployment architecture unless the repository itself shows a later accepted superseding ADR.

---

# 2. FIX THE REMAINING TEST FAILURE FIRST

The last verified deployment report stated:

```text
Tests: 148/149 PASS
Failure: CommonJS distribution test expects the prior dist/index.js compilation contract
```

Do NOT assume that description remains accurate.

Run:

```text
npm test
```

Reproduce the exact current failure and identify:

- exact test name;
- source file;
- assertion;
- stack trace/reason;
- root cause.

Inspect the relevant:

- test source;
- tsconfig files;
- package.json scripts;
- dist generation;
- module/moduleResolution settings;
- recent deployment-related changes.

Fix the underlying cause with the smallest correct change while preserving the established CommonJS contract.

The following are NON-NEGOTIABLE:

```text
root package remains CommonJS
no root "type": "module"
TypeScript Node16 module/moduleResolution remains valid
CommonJS test execution remains valid
dist/index.js public CommonJS contract remains valid
```

Do NOT:

- weaken the test;
- delete the test;
- skip the test;
- conditionally bypass the assertion;
- rewrite the repository to ESM;
- make an unrelated refactor.

If the test expectation itself is stale, change the test only when repository evidence proves the intended contract legitimately changed, and document the reason.

---

# 3. RUN COMPLETE QUALITY GATES

After fixing the test, run all relevant current repository gates.

At minimum:

```text
npm test
npm run typecheck
npm run build
npm run build:next
```

Run lint if a lint script exists.

Report:

```text
PASS
FAIL
NOT RUN — reason
```

The normal target is:

```text
149/149 tests passing
```

unless the current repository legitimately contains a different test count.

Do not claim a gate passed unless it actually ran and passed.

---

# 4. VERIFY THE NODE PRODUCTION ORIGIN

ADR-012 requires the BAREA origin to remain on the native Node.js runtime and bind only to loopback:

```text
127.0.0.1:3000
```

Verify the current production start command.

The preferred result is equivalent to:

```text
next start -H 127.0.0.1 -p 3000
```

Do not expose port 3000 publicly.

After the production build, run the Node origin locally where practical.

Verify:

```text
GET /
```

and the route reached by the current root behavior.

Check:

- HTTP status;
- HTML response;
- CSS/assets;
- JavaScript;
- hydration/runtime errors;
- SQLite initialization;
- relevant Route Handlers;
- relevant Server Actions where practical.

This is a Node-origin test, not a Worker test.

---

# 5. CLOUDFLARE TUNNEL LOCAL READINESS

Inspect whether `cloudflared` is installed:

```text
cloudflared --version
```

If not installed, do not fabricate its presence.

Determine whether authenticated Cloudflare access is available in the current environment.

Never print secret values.

Do not commit:

```text
CLOUDFLARE_TUNNEL_TOKEN
Cloudflare API tokens
Tunnel credential JSON
```

If the required host/credentials are unavailable, complete all repository-side readiness work and report the physical provisioning blocker.

---

# 6. CLOUDFLARE TUNNEL CONFIGURATION

Use current authoritative Cloudflare documentation for the exact procedure.

The intended staging mapping is:

```text
https://<staging-hostname>
        ↓
Cloudflare Edge
        ↓
Cloudflare Tunnel
        ↓
127.0.0.1:3000
```

A committed runbook may show placeholders:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: <STAGING_HOSTNAME>
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Never invent real values.

If real Cloudflare credentials and a target host are available, provision ONLY staging/non-production first.

---

# 7. SECURITY / NETWORK BOUNDARY

Preserve:

```text
PUBLIC INTERNET
    ↓
CLOUDFLARE EDGE
    ↓
AUTHENTICATED CLOUDFLARE TUNNEL
    ↓
127.0.0.1:3000
    ↓
BAREA NODE.JS
    ↓
LOCAL SQLITE
```

Verify/document:

- Node binds only to loopback;
- port 3000 is not directly publicly exposed;
- cloudflared is the ingress path;
- the origin does not trust arbitrary public Internet traffic.

Do NOT invent a Cloudflare source-IP allowlist for port 3000.
Do NOT claim Cloudflare Transform Rules provide cryptographic request authentication.
Do NOT change BAREA security behavior merely for deployment.

---

# 8. CLIENT-IP PROVENANCE

The current BAREA application has an existing client-IP provenance/security design.

Do not alter that implementation during this deployment task.

When a real Cloudflare Tunnel exists, test the actual headers/provenance observed by the application and report the result.

Do not call provenance cryptographically trusted unless the current implementation actually establishes cryptographic trust.

Keep these operational states separate:

1. Architecture Specified
2. Infrastructure Provisioned
3. Infrastructure Operational
4. Client-IP Provenance Experimentally Verified
5. Application Integration Verified
6. Merge Authorized

---

# 9. DO NOT REOPEN THE WORKER MIGRATION

The previous Cloudflare Worker audit established that the current application is not suitable for direct Workers deployment because of Node.js-native SQLite/DatabaseSync and filesystem/runtime requirements.

That finding is accepted.

ADR-012 is the resolution for the current MVP.

Do NOT:

- try vinext again;
- try OpenNext again;
- build a Worker wrapper;
- migrate persistence;
- migrate the root package to ESM.

A future Worker/D1 or external SQL migration can be a separate architectural milestone.

---

# 10. DOCUMENTATION

Update the deployment documentation so it accurately records:

- ADR-012 as the current deployment topology;
- Node.js origin requirement;
- loopback binding;
- cloudflared installation/setup;
- staging Tunnel procedure;
- required secret names without values;
- verification gates;
- physical provisioning prerequisites;
- current Worker incompatibility;
- historical failed Worker/OpenNext experiment.

Do not rewrite history.

---

# 11. GIT DISCIPLINE

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

If the test fix or deployment-readiness changes are required, create focused commit(s) with accurate messages. Prefer one focused commit when practical.

Do not force-push.
Do not rewrite history.
Do not create unrelated branches or PRs.
Do not merge unrelated work.

---

# 12. DO NOT CLAIM A LIVE DEPLOYMENT WITHOUT REAL INFRASTRUCTURE

Only report a public URL, Tunnel ID, DNS verification, or Edge → Tunnel → Origin result when it has actually been provisioned and tested.

If cloudflared or Cloudflare credentials are unavailable, report:

```text
Infrastructure: NOT PROVISIONED
Tunnel: NOT RUN
Hostname/DNS: NOT VERIFIED
Public URL: NOT AVAILABLE
```

Do not fabricate any of them.

---

# 13. VISUAL INSPECTION

Only after a real staging HTTPS deployment exists:

Inspect the actual BAREA homepage on:

- desktop;
- mobile.

Check layout, typography, spacing, navigation, CTAs, responsiveness, touch targets, overflow, assets, hydration/runtime errors, and debug UI.

Do not redesign the UI during this deployment task.

Without a real public/staging URL, report visual inspection as NOT RUN.

---

# 14. FINAL REPORT

Return exactly:

## CURRENT BASELINE

```text
Branch:
HEAD:
Git status:
Phase 7 status:
```

## TEST FAILURE INVESTIGATION

```text
Original failure:
Exact failing test:
Root cause:
Fix applied:
```

## QUALITY GATES

```text
Lint: PASS / FAIL / NOT RUN
Typecheck: PASS / FAIL / NOT RUN
Tests: PASS / FAIL / NOT RUN
Test count:
Normal build: PASS / FAIL / NOT RUN
Next.js production build: PASS / FAIL / NOT RUN
Local Node origin: PASS / FAIL / NOT RUN
```

## ADR-012 READINESS

```text
Architecture: ADR-012 Node.js + Cloudflare Tunnel
Node origin bind:
Node origin port:
cloudflared installed: YES / NO
Cloudflare authenticated access: YES / NO / NOT CHECKED
Target staging host: YES / NO / NOT CHECKED
Tunnel: PROVISIONED / NOT PROVISIONED / NOT RUN
Hostname/DNS: VERIFIED / NOT VERIFIED / NOT RUN
Public URL: real value or NOT AVAILABLE
```

## SECURITY

Confirm:

- no secrets committed;
- no credentials exposed;
- no production database modified;
- no unauthorized production infrastructure modified;
- origin remains loopback-only;
- no authentication/authorization/security behavior changed;
- no SQLite-to-D1/external-SQL migration;
- no root ESM migration;
- no direct Worker deployment.

## FILES CHANGED

List every changed file and why it changed.

## COMMIT

```text
Commit SHA:
Commit message:
```

Use `NONE` if no repository change was necessary.

## CLOUDFLARE PROVISIONING BLOCKERS

List only concrete missing prerequisites.

## NEXT STEP

STOP after completing this test/build/deployment-readiness task.

Do NOT start the next BAREA product phase.

---

# SUCCESS CRITERIA

1. Current `main` baseline verified.
2. Remaining test failure reproduced and genuinely fixed, or a concrete blocker documented.
3. Existing CommonJS/test/public-export contracts preserved.
4. Full test suite green where applicable.
5. Typecheck/builds verified.
6. Node production origin verified on `127.0.0.1:3000`.
7. ADR-012 preserved as the deployment architecture.
8. Cloudflare Tunnel prerequisites accurately assessed.
9. Staging Tunnel provisioned only when real authorized infrastructure access exists.
10. No secrets exposed.
11. No production infrastructure modified without explicit authorization.
12. No product phase started.

Do the work now. Do not merely tell the operator what they should do later.