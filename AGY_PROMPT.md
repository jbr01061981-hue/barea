# AGY PROMPT — BAREA DEPLOYMENT READINESS: FIX THE REMAINING TEST FAILURE

Repository: `jbr01061981-hue/barea`
Branch: `main`

## EXECUTION AUTHORITY

Execute this task directly in the repository. Do not merely write an audit report.

The approved MVP deployment architecture is **ADR-012: Node.js + local SQLite behind Cloudflare Tunnel**. Do not revisit or replace that architecture during this task.

Do NOT start BAREA-007 or any later product/frontend phase.
Do NOT redesign the application.
Do NOT migrate SQLite to D1/PostgreSQL.
Do NOT migrate the root repository to ESM.
Do NOT deploy the current application directly to a Cloudflare Worker.
Do NOT modify authentication, authorization, session, tenant isolation, or other security behavior unless a genuine defect in the existing implementation is independently proven.

The immediate objective is to resolve and verify the repository's one remaining test failure, then assess whether the repository is ready for the physical Cloudflare Tunnel provisioning step.

---

# 1. VERIFY CURRENT BASELINE FIRST

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
- current HEAD;
- working-tree state.

Read:

```text
README.md
docs/DECISIONS.md
docs/ROADMAP.md
package.json
package-lock.json
```

Locate ADR-012 in `docs/DECISIONS.md` and preserve it as the governing deployment decision.

---

# 2. INVESTIGATE THE SINGLE FAILING TEST

The last verified repository report showed:

```text
Tests: 148/149 PASS
Failure: CommonJS test expects the prior `dist/index.js` compilation contract
```

Do NOT assume this description is still accurate. Reproduce the current failure from the actual repository.

Run:

```text
npm test
```

Identify the exact failing test, source file, assertion, and root cause. Inspect the relevant test source, TypeScript configuration, package scripts, `dist` generation behavior, module/moduleResolution settings, and recent deployment-related changes.

The existing root CommonJS contract MUST remain intact:

```text
root package type: CommonJS
no root "type": "module"
TypeScript Node16 module/moduleResolution behavior preserved
CommonJS test execution preserved
`dist/index.js` public CommonJS contract preserved
```

Fix the underlying cause with the **smallest focused repository change**.

Do NOT weaken, skip, delete, quarantine, or conditionally bypass the failing test merely to obtain a green result.
Do NOT rewrite the repository's module system merely to satisfy this test.

If the test exposes a genuine incompatibility introduced by ADR-012 deployment work, fix that incompatibility while preserving the existing application contract.

If the test expectation is stale, update it only when repository evidence proves the intended contract legitimately changed, and document why.

---

# 3. QUALITY GATES AFTER THE FIX

Run:

```text
npm test
npm run typecheck
npm run build
npm run build:next
```

If linting exists in `package.json`, run it too.

Report every gate as PASS / FAIL / NOT RUN. Do not claim success unless the command actually ran.

The expected target is **149/149 tests passing**, unless repository evidence proves the suite has legitimately changed.

If tests still fail, continue investigating the actual failure while the fix remains focused and in scope.

---

# 4. VERIFY THE NODE ORIGIN CONTRACT

ADR-012 requires the native Node.js origin to remain private and loopback-only:

```text
127.0.0.1:3000
```

Verify the current production start command/configuration. If `package.json` already contains the expected loopback binding, preserve it.

Where practical, perform a local production-origin smoke test after `npm run build:next`.

Verify at minimum:

```text
GET /
```

and check that the homepage and assets are served without runtime errors.

This is a Node.js-origin check, not a Worker check.

---

# 5. CLOUDFLARE TUNNEL READINESS — DO NOT FABRICATE INFRASTRUCTURE

After the test/build fix, inspect the environment for the actual prerequisites for ADR-012 physical provisioning:

- `cloudflared` installed or not;
- authenticated Cloudflare access available or not;
- target host available or not;
- required tunnel credential/token available or not.

Never print secret values.

If the environment genuinely permits authorized staging provisioning, proceed with **non-production/staging only** using current authoritative Cloudflare procedures.

If the required binary, credentials, or physical host are unavailable, complete all repository-side work. Report missing prerequisites by NAME only.

Example:

```text
cloudflared: NOT INSTALLED
CLOUDFLARE_TUNNEL_TOKEN: NOT AVAILABLE
STAGING HOST: NOT AVAILABLE
```

Do not fabricate a tunnel UUID, hostname, DNS record, public URL, or verification result.

---

# 6. PRESERVE ADR-012

The topology remains:

```text
PUBLIC INTERNET
      |
      v
CLOUDFLARE EDGE DNS / HTTPS / TLS
      |
      v
CLOUDFLARE TUNNEL / cloudflared
      |
      v
127.0.0.1:3000
      |
      v
BAREA NEXT.JS / NODE.JS
      |
      v
LOCAL SQLITE
```

Do not reopen the earlier Worker/OpenNext/vinext experiment.

---

# 7. SECURITY BOUNDARY

Preserve all existing security behavior.

Do NOT weaken authorization, bypass authentication, change session handling, change tenant isolation, invent Cloudflare trust mechanisms, claim cryptographic client-IP provenance without evidence, add arbitrary trusted-proxy behavior, or expose SQLite/the Node origin publicly.

Never commit or print:

```text
CLOUDFLARE_TUNNEL_TOKEN
Cloudflare API tokens
Tunnel credential JSON
DATABASE_URL
SESSION_SECRET
COMPETITION_HMAC_SECRET
OAuth secrets
BAREA_EDGE_SECRET
private keys
```

---

# 8. GIT DISCIPLINE

Before modifications:

```text
git diff
```

After modifications:

```text
git diff
git status
```

Review every changed file.

If a code/test/configuration fix is required, create **one focused commit** on `main`.

Use a focused message such as:

```text
fix(test): restore CommonJS distribution test contract
```

Use the actual scope if a different message is more accurate.

Do not force-push, rewrite history, create unrelated branches/PRs, or merge unrelated work.

---

# 9. HARD STOP CONDITIONS

Stop only for a concrete blocker such as:

1. The failing test cannot be reproduced but the repository state is otherwise verified.
2. Fixing the failure would require an out-of-scope architecture migration.
3. Cloudflare physical provisioning requires credentials/access that are not available.
4. A target host is required but unavailable.
5. A production change would be required without explicit authorization.

Missing Cloudflare infrastructure access is not a reason to undo ADR-012 or return to Workers. Complete repository-side readiness and report physical provisioning as pending.

---

# 10. FINAL REPORT — EXACT STRUCTURE

Return exactly these sections:

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
Staging host available: YES / NO / NOT CHECKED
Tunnel: PROVISIONED / NOT PROVISIONED / NOT RUN
Hostname/DNS: VERIFIED / NOT VERIFIED / NOT RUN
Public URL: real value or NOT AVAILABLE
```

## SECURITY

Confirm:

- no secrets committed;
- no credentials exposed;
- no production database modified;
- no production infrastructure modified without authorization;
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

List only concrete missing prerequisites. Do not invent values.

## NEXT STEP

Stop after completing this test/build/readiness task.

Do NOT start the next BAREA product phase.

---

# SUCCESS CRITERIA

This task is successful when:

1. The current `main` baseline is verified.
2. The single failing test is reproduced and its real root cause is identified.
3. The underlying issue is fixed without weakening the test or changing the CommonJS contract.
4. The full test suite is green, ideally 149/149.
5. Typecheck and both build paths pass.
6. The Node origin remains bound to `127.0.0.1:3000`.
7. ADR-012 remains the approved deployment architecture.
8. Cloudflare Tunnel prerequisites are accurately assessed.
9. Real staging provisioning is performed only if actual authorized infrastructure access exists.
10. No secrets are exposed.
11. No product phase is started.

Do the work now. Do not merely propose commands for someone else to run.