# AGY PROMPT — BAREA-006 FINAL MERGE CONFLICT RESOLUTION

Repository: `jbr01061981-hue/barea`
Branch: `barea-006-share-join`
PR: `#8`

## CURRENT DECISION

**BAREA-006 security review: GO.**

The application/security implementation at the reviewed PR head has passed the final independent security review. The only remaining blocker is a **Git merge conflict with `main`**. Do not redesign BAREA-006.

## YOUR TASK — FINAL MECHANICAL STEP ONLY

Update `barea-006-share-join` against the current `main` and resolve the merge conflicts so PR #8 becomes mergeable.

### NON-NEGOTIABLE

1. **Do not change the BAREA-006 architecture.**
2. **Do not redesign or add rate limiting.**
3. Do not reintroduce `127.0.0.1` as a client identity.
4. Do not reintroduce forwarding-header trust.
5. Do not reintroduce a room-code failure bucket.
6. Do not add a global anonymous limiter.
7. Do not add client-controlled limiter keys.
8. Preserve authenticated `userId` join throttling.
9. Preserve church-NAT scalability and zero successful-participant-per-IP seat quotas.
10. Preserve tenant isolation, admission enforcement, expiry and error sanitization.
11. Do not add BAREA-007 functionality.
12. Do not provision Cloudflare, Tunnel, Workers or DNS.
13. Do not create another PR.
14. Do not merge the PR yourself.

## MERGE-CONFLICT PROCEDURE

1. Fetch current `main`.
2. Rebase or otherwise update `barea-006-share-join` onto current `main` using the repository's normal workflow.
3. Resolve conflicts by preserving the reviewed BAREA-006 implementation and incorporating only legitimate non-conflicting changes from `main`.
4. Do not use conflict resolution as an opportunity to refactor unrelated code.
5. Inspect the final diff against `main` for accidental deletions, duplicated code, reverted security fixes or unrelated changes.

## REQUIRED FINAL SECURITY INVARIANTS

Verify the resolved branch still has:

- `resolveServerClientIp(): Promise<string | null>` with normal MVP runtime returning `null` when trusted provenance is unavailable.
- No trust of `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` or `X-Barea-*` without a real deployment trust boundary.
- No fake constant IP fallback.
- No room-code shared failure bucket.
- No global anonymous bucket.
- No successful-participant-per-IP quota.
- Authenticated join throttling keyed by server-authoritative `userId`.
- Exact-room lookup cannot be blocked by another caller.
- Cross-room lookup isolation remains intact.
- Teacher-group mode remains device/account-free for pupils.
- Individual participation remains authenticated.
- Restricted admission remains server-authoritative using verified identity attributes.
- Personal tenant mapping and snapshot tenant isolation remain intact.
- BAREA-007 live transport/state/scoring remains absent.

## REQUIRED VERIFICATION

Run all of these after conflict resolution:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
git status
git diff main...HEAD
```

All must pass.

## REVIEWER REQUIREMENT

Do **not** start another architecture/review cycle unless conflict resolution exposes a genuine regression or security defect.

Run the repository's existing required checks. If the conflict resolution changed security-sensitive application code materially, report exactly what changed and why.

## FINAL REPORT — THEN STOP

Report only:

- new branch HEAD commit SHA;
- exact conflict files and how they were resolved;
- final changed-file summary against `main`;
- test/typecheck/build results;
- confirmation that all security invariants above remain intact;
- PR #8 current HEAD and whether GitHub now reports it mergeable.

**Do not merge. Do not start BAREA-007. Do not provision Cloudflare. Stop after the report. ChatGPT will perform the final merge check.**
