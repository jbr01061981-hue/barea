# AGY PROMPT — BAREA FRESH CLOUDFLARE WORKER SETUP AFTER PHASE 7

Repository: `jbr01061981-hue/barea`

## EXECUTION AUTHORITY

You are authorized to directly inspect, modify, test, and commit the repository as required for this deployment task.

Phase 7 is COMPLETED and MERGED into `main`.

Work from the CURRENT post-Phase-7 repository state. Do not rely on an older frontend branch or older deployment configuration.

This task is deployment/infrastructure only.

Do NOT start a new product phase.
Do NOT redesign the application.
Do NOT modify backend/security behavior unless a genuine deployment compatibility issue is proven and explicitly documented.
Do NOT migrate the repository to ESM merely to make deployment tooling easier.

---

# 1. VERIFY THE CURRENT BASELINE

Before making any changes, inspect:

```text
git status
git branch
git log -10 --oneline
git remote -v
```

Confirm the current branch, HEAD, clean working tree, Phase-7 merged state, and current application structure.

GitHub/repository state is the source of truth.

---

# 2. READ CURRENT PROJECT ARCHITECTURE

Read the current README, docs, package.json, workspace files if present, application source, and deployment documentation.

Search for:

```text
Cloudflare
Workers
Next.js
vinext
OpenNext
Vite
deployment
staging
production
web
API
```

Determine the CURRENT web application and deployment architecture after Phase 7.

Do not assume the older frontend architecture is still authoritative.

---

# 3. CURRENT APPLICATION FACTS TO VERIFY

Previously observed repository facts included a single Next.js application with areas such as `src/app/`, `src/domain/`, `src/persistence/`, `src/service/`, and `src/transport/`, and Node-specific APIs such as `node:sqlite`, `node:fs`, `node:path`, and `node:crypto`.

These are historical observations only. Re-verify them against the current Phase-7 repository before implementation.

---

# 4. PREVIOUS CLOUDFLARE FAILURE — DO NOT REPEAT IT

The previous Cloudflare attempt used:

```text
npm run build
```

which ran `tsc`, followed by `npx wrangler deploy`.

Wrangler auto-detected Next.js, configured OpenNext, and the deployment failed because:

```text
.next/server/middleware-manifest.json
```

was unavailable.

The automatic migration also attempted to create/update OpenNext configuration and dependencies.

Treat this as a failed historical deployment configuration. Do NOT blindly reuse it.

---

# 5. DO NOT ASSUME VINEXT OR OPENNEXT

Earlier frontend work proposed vinext for Cloudflare Workers. Phase 7 has since been merged.

Determine the correct CURRENT Cloudflare architecture from:

1. current repository;
2. current dependencies;
3. current application structure;
4. current Cloudflare documentation;
5. current framework/adapter documentation.

Use authoritative current documentation wherever possible.

Possible adapters include vinext, OpenNext, or another current Cloudflare-supported architecture.

Do NOT choose OpenNext merely because Wrangler previously auto-detected Next.js.
Do NOT choose vinext merely because it was previously discussed.

Document:

```text
Chosen deployment architecture:
Reason:
Relevant versions:
Alternatives considered:
Why alternatives were rejected:
```

---

# 6. CRITICAL MODULE-SYSTEM CONSTRAINT

The existing root package contract is CommonJS and MUST be preserved unless an independently approved repository-wide migration is authorized.

The existing root package historically contains:

```text
"main": "dist/index.js"
```

and no root:

```text
"type": "module"
```

The normal build/test/public-export contract must remain intact.

Do NOT add root `"type": "module"` simply to satisfy a deployment adapter.

Do NOT rewrite the repository's relative imports to `.js` merely for deployment.
Do NOT convert the test suite to ESM.
Do NOT break the CommonJS `dist/index.js` public contract.

If the selected adapter requires ESM configuration, first investigate whether deployment tooling can be isolated from the CommonJS root.

---

# 7. IF VINEXT IS VERIFIED, PREFER ISOLATED ESM DEPLOYMENT CONFIGURATION

If current evidence confirms vinext is the correct adapter, investigate a deployment-only ESM scope/configuration while leaving the root package CommonJS.

Conceptually:

```text
BAREA repository
       |
       +---- existing Node/TypeScript/CommonJS contract
       |
       +---- isolated Cloudflare/vinext deployment configuration
```

A deployment-only package/config scope with its own ESM metadata may be appropriate if supported by the actual toolchain.

Do NOT invent an unsupported mechanism.
Do NOT duplicate the entire BAREA application source.
Prefer one application source with isolated deployment tooling.

---

# 8. CRITICAL RUNTIME COMPATIBILITY AUDIT

Before declaring Worker deployment viable, audit the actual current application for Node-only runtime dependencies.

Specifically inspect usage of:

```text
node:sqlite
node:fs
node:path
node:crypto
```

and any other Node-specific APIs.

Determine which routes/components actually execute them.

A successful build does NOT prove Worker runtime compatibility.

Determine whether:

- the public homepage can execute on Workers;
- server components can execute on Workers;
- server actions can execute on Workers;
- teacher/session routes require Node-only runtime behavior;
- persistence is local/in-process SQLite;
- the required application runtime can execute on Cloudflare Workers.

If the current application cannot run correctly on Workers because of Node-only persistence/runtime requirements, STOP and report:

**CLOUDFLARE RUNTIME / DEPLOYMENT ARCHITECTURE GAP**

Do NOT rewrite persistence merely to make the homepage deploy.

---

# 9. DATABASE SAFETY

Do NOT migrate SQLite to D1 or another database as part of this deployment task.

Do NOT add Durable Objects, KV, R2, Queues, or other Cloudflare services unless the CURRENT architecture explicitly requires them.

Do NOT run production migrations.
Do NOT modify production database schemas.

---

# 10. PACKAGE MANAGER

Inspect the current package manager from package.json and lock/workspace files.

Use the package manager actually declared by the current repository.

Do not introduce a second package manager.

---

# 11. CLOUDFLARE CONFIGURATION

Inspect current:

```text
wrangler.jsonc
wrangler.toml
vite.config.*
next.config.*
open-next.config.*
```

Use git history/diffs to distinguish legitimate configuration from artifacts of the previous failed automatic migration.

Then create a deterministic Worker configuration for the CURRENT verified architecture.

Explicitly define, as applicable:

- Worker name;
- Worker entry point;
- compatibility date;
- compatibility flags;
- assets;
- required bindings.

Do not depend on Wrangler's automatic framework migration.

---

# 12. BUILD CONTRACT

Keep the normal repository build contract intact.

If `npm run build` means TypeScript compilation, do not change it merely for Cloudflare.

Create/use a separate explicit Cloudflare deployment build command, such as:

```text
npm run build:cloudflare
```

or another name justified by the verified architecture.

That command MUST produce the deployment artifact expected by the selected Cloudflare adapter.

The Cloudflare Dashboard build command must use this deployment-specific command rather than the generic TypeScript build when appropriate.

---

# 13. ENVIRONMENT VARIABLES / SECRETS

Do NOT commit or expose secrets.

Never print secret values.

Do not commit DATABASE_URL, SESSION_SECRET, COMPETITION_HMAC_SECRET, OAuth secrets, Cloudflare API tokens, private keys, or other credentials.

Determine which variables the current web application actually requires.

If a required variable is missing, report only the variable NAME.

---

# 14. ENVIRONMENT SEPARATION

The first remote deployment must be NON-PRODUCTION.

Do NOT modify the production Worker.
Do NOT modify production database infrastructure.

Use the appropriate current Cloudflare preview/version/staging mechanism.

---

# 15. VALIDATION

Run the current repository quality gates discovered from the repository, such as:

```text
lint
typecheck
test
build
```

Then run the dedicated Cloudflare deployment build.

For every check report PASS, FAIL, or NOT RUN with the reason.

Do not claim success without actually running the command.

---

# 16. LOCAL CLOUDFLARE RUNTIME TEST

If the selected architecture supports local Worker execution, run the appropriate local preview/runtime.

Test at minimum:

```text
GET /
```

Verify HTTP status, HTML, CSS/assets, JavaScript, runtime errors, server errors, and API connectivity where applicable.

---

# 17. REMOTE PREVIEW

If authorized Cloudflare access is available, deploy a NON-PRODUCTION preview/version.

Capture real values only:

- Worker name;
- version/deployment ID;
- preview URL;
- HTTP status;
- runtime result.

Never invent a URL.

If Cloudflare Dashboard configuration must be changed manually and cannot be changed from the available environment, report that as a blocker.

---

# 18. VISUAL INSPECTION

After successful deployment, open the actual BAREA homepage and inspect desktop and mobile.

Check:

- layout;
- typography;
- spacing;
- navigation;
- primary/secondary CTAs;
- responsive behavior;
- touch targets;
- text wrapping;
- overflow;
- missing assets;
- runtime/console errors;
- hydration errors;
- accidental debug UI.

Capture screenshots if available.

Do NOT redesign the UI during this deployment task.

Report UI problems separately as:

`POST-DEPLOYMENT UI OBSERVATIONS`

---

# 19. BACKEND / SECURITY BOUNDARY

Do NOT alter authentication, authorization, tenant isolation, session security, trusted proxy/IP behavior, rate limiting, BAREA-006 security behavior, BAREA-007 live-quiz security/correctness behavior, or database authorization.

Deployment work must not become backend redesign.

---

# 20. GIT DISCIPLINE

Work against the CURRENT post-Phase-7 repository state.

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

Do not resurrect obsolete frontend branches, create unrelated branches/PRs, rewrite history, force-push, or merge automatically.

If deployment changes are required, create one focused deployment commit.

Suggested message:

```text
chore(deploy): configure BAREA Cloudflare Worker
```

---

# 21. DOCUMENTATION

Update current deployment documentation to describe:

- selected Cloudflare architecture;
- reason for selection;
- build command;
- Worker entry point;
- environment configuration;
- preview process;
- runtime limitations;
- Node-only route limitations;
- required Cloudflare Dashboard settings.

Preserve the historical record of the previous failed OpenNext deployment.

Do not rewrite history to hide the failure.

---

# 22. STOP CONDITIONS

STOP and report if:

1. Current architecture cannot be determined.
2. Cloudflare adapter compatibility cannot be established.
3. Isolated ESM deployment cannot preserve the root CommonJS contract and no approved alternative exists.
4. Current application runtime is incompatible with Workers because of Node-only functionality.
5. Required Cloudflare credentials/access are unavailable.
6. Deployment would require changing production infrastructure.
7. A proposed fix requires a broad application/backend/database migration.

Do not guess.
Do not silently change architecture.
Do not choose root ESM migration automatically.

---

# 23. FINAL REPORT

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
Package manager:
Monorepo structure:
API:
Database:
```

## CLOUDFLARE ARCHITECTURE

```text
Deployment target:
Adapter:
Worker:
Build command:
Deploy command:
Preview mechanism:
```

## ARCHITECTURE DECISION

```text
Chosen option:
Reason:
Alternatives rejected:
```

## MODULE CONTRACT

```text
Root package module type:
TypeScript module setting:
Test module contract:
Public CommonJS contract:
```

Confirm the root CommonJS contract was preserved unless an independently approved migration was explicitly authorized.

## RUNTIME COMPATIBILITY

```text
Homepage:
Server components:
Server actions:
Node-only dependencies:
Worker compatibility:
```

## FILES CHANGED

List every changed file and its purpose.

## QUALITY GATES

```text
Lint: PASS / FAIL / NOT RUN
Typecheck: PASS / FAIL / NOT RUN
Tests: PASS / FAIL / NOT RUN
Normal build: PASS / FAIL / NOT RUN
Cloudflare build: PASS / FAIL / NOT RUN
Local Worker runtime: PASS / FAIL / NOT RUN
```

## DEPLOYMENT

```text
Preview:
Worker:
Version:
URL:
HTTP status:
```

Use real values only.

## RUNTIME CHECK

```text
Homepage:
Assets:
Console:
Runtime:
API connectivity:
```

## VISUAL INSPECTION

```text
Desktop:
Mobile:
Major issues:
Minor issues:
```

## SECURITY / ENVIRONMENT

Confirm:

- no production secrets committed;
- no production database modified;
- no production Worker modified;
- no credentials exposed;
- no backend/security behavior changed.

## POST-DEPLOYMENT UI OBSERVATIONS

List observations only. Do not fix them unless separately authorized.

## NEXT STEP

STOP after deployment setup and visual inspection.

Do NOT start the next BAREA product phase.
Do NOT migrate the root repository to ESM.
Do NOT make unrelated changes.

---

# SUCCESS CRITERIA

This task is successful only when:

1. Current Phase-7 merged repository is verified.
2. Current web architecture is verified.
3. Current Cloudflare deployment method is verified against current authoritative documentation.
4. Previous failed OpenNext configuration is not blindly reused.
5. Root CommonJS/test/public-export invariants remain intact.
6. Cloudflare build produces the correct Worker artifact.
7. Applicable repository quality gates pass.
8. A safe non-production Cloudflare deployment succeeds.
9. The real BAREA homepage is reachable.
10. The deployed homepage is visually inspected.
11. No production environment is modified.
12. No backend/security/domain behavior is changed.
13. All deployment changes are documented and committed cleanly.

If these criteria cannot be met without a broad architectural migration:

**STOP AND REPORT THE BLOCKER.**
