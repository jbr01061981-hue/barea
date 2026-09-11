# AGY PROMPT — LOCAL WORKSPACE / GITHUB RECONCILIATION

Repository: `jbr01061981-hue/barea`
Remote: `origin`
Primary branch: `main`

## OBJECTIVE

Reconcile the **local BAREA workspace** with the actual GitHub repository after the successful merge of BAREA-006.

This is a synchronization and reconciliation task, **not a new feature-development task**.

The authoritative remote repository is:

`origin/main`

Current known BAREA-006 merge commit:

`008dc85123d05129ac3154e676369ae39864d005`

The goal is to make the local workspace accurately reflect GitHub `main`, while preserving any legitimate local work that is not yet on GitHub. Do not silently discard local changes.

---

## NON-NEGOTIABLE RULES

1. **Do not start BAREA-007.**
2. Do not implement new product functionality.
3. Do not redesign BAREA-006.
4. Do not provision Cloudflare, Tunnel, Workers or DNS.
5. Do not delete local work merely because it is absent from GitHub.
6. Do not overwrite local files blindly with `origin/main`.
7. Do not force-push unless explicitly authorized later.
8. Do not reset with `git reset --hard` while uncommitted local work exists.
9. Do not use generated/build directories as source-of-truth files.
10. Preserve all security corrections already merged into BAREA-006.
11. Treat GitHub `main` as the authoritative **committed repository state**.
12. If local work conflicts with the remote, stop and report the conflict rather than guessing which implementation should win.

---

## STEP 1 — INSPECT THE LOCAL WORKSPACE FIRST

Run:

```text
git status --short --branch
git branch --show-current
git remote -v
git log --oneline --decorate -12
git diff --stat
git diff
git diff --cached --stat
git stash list
```

Determine:

- current local branch;
- whether the workspace is clean or dirty;
- whether there are staged changes;
- whether there are local commits not present on GitHub;
- whether there are untracked files;
- whether the local branch tracks a remote branch.

**Do not modify anything yet.**

---

## STEP 2 — FETCH THE REAL GITHUB STATE

Run:

```text
git fetch origin --prune
git rev-parse origin/main
git log --oneline --decorate -12 origin/main
```

Confirm that `origin/main` contains BAREA-006 merge commit:

`008dc85123d05129ac3154e676369ae39864d005`

If it does not, report the discrepancy before proceeding.

---

## STEP 3 — COMPARE LOCAL AGAINST GITHUB

Run the appropriate comparisons:

```text
git rev-list --left-right --count HEAD...origin/main
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

If the local branch is not the intended working branch, also inspect:

```text
git branch -vv
git log --all --oneline --decorate --graph -30
```

Classify differences into:

### A. Already on GitHub
Local state matches remote.

### B. Local-only legitimate work
Changes exist locally but are not committed/pushed to GitHub.

### C. Remote-only work
Changes exist on GitHub but not locally.

### D. Conflicting edits
Both local and remote changed the same logical/file areas.

Do not guess for category D.

---

## STEP 4 — RECONCILE SAFELY

### If the local workspace is clean

Bring the local branch up to date with GitHub using the normal non-destructive workflow:

```text
git pull --ff-only origin main
```

If the local branch is a separate working branch, update it from `origin/main` using the repository's normal workflow without destroying local commits.

### If there are uncommitted local changes

Do **not** reset or overwrite them.

First preserve them safely, preferably with a descriptive stash if appropriate:

```text
git stash push -u -m "barea-local-reconciliation-backup"
```

Then synchronize the branch with `origin/main`.

After synchronization, restore the local work:

```text
git stash pop
```

If conflicts occur, resolve only when the correct resolution is unambiguous from the local changes and current `origin/main`. Otherwise stop and report the exact conflict.

### If there are local commits not on GitHub

Do not discard them.

Inspect them with:

```text
git log origin/main..HEAD --oneline
```

Determine whether they are:

- obsolete/duplicate copies of already-merged BAREA-006 work;
- legitimate documentation/workspace changes;
- unfinished feature work;
- unrelated changes.

Do not force-push or rewrite history automatically.

If they are legitimate and safe to preserve, keep them on the local branch and report them separately. If they should be published, prepare the appropriate normal commit/PR workflow, but **do not create or merge a PR without explicit instruction**.

---

## STEP 5 — SPECIAL BAREA-006 RECONCILIATION

Because BAREA-006 has now been merged into GitHub `main`, verify that the local workspace contains the merged implementation.

Check at minimum:

```text
src/app/session/actions.ts
src/app/teacher/review/db.ts
src/domain/domain-errors.ts
src/domain/session.ts
src/domain/value-objects.ts
src/index.ts
src/persistence/sqlite-session-repository.ts
src/service/rate-limiter.ts
src/service/session-service.ts
test/session-share-join.test.ts
docs/ROADMAP.md
docs/DECISIONS.md
AGY-REPORT.md
AGY_PROMPT.md
```

The local BAREA-006 implementation must retain these security invariants:

- `resolveServerClientIp(): Promise<string | null>`;
- normal MVP runtime returns `null` when trustworthy proxy provenance is unavailable;
- no fabricated `127.0.0.1` client identity;
- no trust of `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` or `X-Barea-*` without a genuine deployment trust boundary;
- no room-code shared failure bucket;
- no global anonymous limiter;
- no client-controlled rate-limit identity;
- no successful-participant-per-IP seat quota;
- authenticated join throttling remains keyed by server-authoritative `userId`;
- exact-room lookup cannot be blocked by another anonymous caller;
- church NAT scalability remains intact;
- teacher-group participation remains account/device-free for pupils;
- individual participation remains authenticated;
- restricted admission remains server-authoritative using verified identity attributes;
- tenant isolation remains intact;
- BAREA-007 live transport/state/scoring remains absent.

If local code violates any of these because it is stale relative to GitHub, reconcile it to the merged `origin/main` implementation.

---

## STEP 6 — RECONCILE DOCUMENTATION

Ensure the local documentation reflects the actual merged repository state:

- `docs/ROADMAP.md` must show BAREA-006 as completed/merged and BAREA-007 as not started.
- `docs/DECISIONS.md` must not describe the obsolete `127.0.0.1` fallback as the current BAREA-006 implementation.
- `AGY-REPORT.md` must retain the complete historical BAREA-004 and BAREA-005 report and contain an additional BAREA-006 final section documenting:
  - implementation completion;
  - security review GO;
  - merge-conflict resolution;
  - final HEAD `e8ee09035b2bfd4bdc86451dd3c62f5f1f2ff15f`;
  - PR #8;
  - merge commit `008dc85123d05129ac3154e676369ae39864d005`;
  - 134/134 tests passing;
  - typecheck/build/Next.js build passing;
  - security invariants listed above;
  - BAREA-007 not started;
  - Cloudflare deployment deferred.

**Do not rewrite or truncate the historical AGY-REPORT.md content.** Append/reconcile the BAREA-006 report while preserving BAREA-004 and BAREA-005 history.

If `AGY-REPORT.md` is already correctly updated on GitHub, synchronize the local copy rather than creating a duplicate report.

---

## STEP 7 — VERIFY THE RECONCILED LOCAL WORKSPACE

Run:

```text
npm test
npm run typecheck
npm run build
npm run build:next
git grep ": any" -- src/
git diff --check
git status --short --branch
git diff --stat origin/main...HEAD
```

If the local workspace is intended to exactly match `origin/main`, also verify:

```text
git diff --exit-code origin/main
```

Only use the final command when there should be no legitimate local changes.

---

## STEP 8 — FINAL REPORT

Report clearly:

1. Local branch name.
2. Local HEAD SHA.
3. `origin/main` SHA.
4. Whether local and GitHub are now synchronized.
5. Any local-only commits or files preserved.
6. Any conflicts encountered and exactly how they were resolved.
7. Whether `AGY-REPORT.md` was reconciled without losing historical content.
8. BAREA-006 security invariant verification.
9. Test/typecheck/build results.
10. Whether the working tree is clean.
11. Any remaining local-vs-GitHub differences.

### STOP CONDITION

After reconciliation and verification:

**STOP.**

Do not start BAREA-007.
Do not implement new features.
Do not provision Cloudflare.
Do not create or merge a new PR.
Do not force-push.

Wait for ChatGPT's next instruction.
