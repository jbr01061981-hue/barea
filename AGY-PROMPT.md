# AGY TASK — Verification Gates Merge + Local/GitHub Cleanup

## STATUS

PR #5 is the approved documentation gate for BAREA milestone verification and release workflow.

This task is ONLY to complete the controlled PR #5 merge, synchronize the local workspace with GitHub, clean safe stale local artifacts/branches, and leave the repository in a known clean state.

**Do NOT start BAREA-004 implementation.**
**Do NOT modify application implementation code.**
**Do NOT invent or add new product scope.**

---

## 1. SOURCE OF TRUTH

Repository: `jbr01061981-hue/barea`
PR: `#5`
Branch: `vg-doc3`
Base: `main`

Before acting, inspect the actual current PR #5 state and current `main` state.

PR #5 was created for:
- `AGENTS.md`
- `docs/VERIFICATION-GATES.md`

Do not assume SHAs from this prompt are current. Read GitHub and the local repository first.

---

## 2. VERIFY PR #5

Verify:

- PR #5 exists;
- it targets `main`;
- it is not already merged;
- its changes are limited to the verification-gate documentation described above;
- no BAREA-004 implementation is present in the PR.

If unexpected implementation changes are present, STOP and report them.

---

## 3. MERGE PR #5

After verification, merge PR #5 into `main` using the repository's normal merge workflow.

Use a normal merge commit.

Do NOT:
- squash;
- rebase/rewrite history;
- force-push;
- modify application implementation;
- merge unrelated PRs;
- start BAREA-004.

---

## 4. SYNCHRONIZE LOCAL WORKSPACE

After the merge:

1. switch local checkout to `main`;
2. fetch the remote repository;
3. pull the current merged `main`;
4. verify local `HEAD` matches `origin/main`;
5. verify the working tree is clean;
6. verify there are no untracked files that belong to the BAREA project;
7. verify there are no staged-but-uncommitted changes;
8. verify the verification-gate documentation is present locally;
9. verify `AGENTS.md` references the verification-gate process;
10. verify `docs/ROADMAP.md` still records BAREA-003 as COMPLETED and BAREA-004 onward as NOT STARTED.

Do not use destructive commands such as `git reset --hard` or mass file deletion unless you first inspect the files and establish that they are safe generated/stale artifacts from this BAREA workspace.

---

## 5. SAFE LOCAL FILE CLEANUP

Inspect the BAREA workspace for temporary/generated artifacts that are not part of the GitHub repository source of truth.

Examples to inspect include:
- build output already covered by `.gitignore`;
- `node_modules/`;
- `dist/`;
- temporary logs;
- editor/OS temporary files;
- abandoned task output files;
- duplicate temporary copies of repository documents.

Do NOT delete source files, documentation, configuration, tests, or any file that is tracked by Git.

For every untracked file:
- determine whether it is a legitimate project file that should be committed;
- if legitimate, add it only if it belongs to the current approved repository scope;
- if it is clearly a temporary/generated/stale artifact, remove it safely;
- if uncertain, STOP and report it rather than deleting it.

The goal is a clean local workspace, not indiscriminate deletion.

---

## 6. BRANCH CLEANUP

After local `main` is verified clean:

- delete the local `vg-doc3` branch;
- delete the remote `vg-doc3` branch after PR #5 is merged;
- prune stale remote-tracking references;
- inspect other BAREA branches created during earlier documentation/gate work;
- delete only branches that are clearly obsolete, empty, merged, or temporary and are not `main` or an active milestone branch;
- do not delete any branch containing unmerged approved work;
- if branch safety is uncertain, leave it and report it.

Do not delete `main`.

---

## 7. FINAL VALIDATION

On clean local `main`, run the repository validation appropriate to the current state.

At minimum:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- `git status --short`
- `git branch --show-current`
- verify `HEAD` equals `origin/main`

Do not claim a check passed unless it was actually executed.

---

## 8. AGY-REPORT.md

Update `AGY-REPORT.md` with the actual results of this task.

Record:
- PR #5 verification result;
- actual merge commit SHA;
- actual final `main` SHA;
- local/remote synchronization result;
- test/typecheck/build results;
- local cleanup result;
- branch cleanup result;
- final working-tree status;
- explicit confirmation that BAREA-004 implementation was NOT started.

Do not fabricate results or SHAs.

If updating `AGY-REPORT.md` creates a focused documentation commit after the merge, that commit may be pushed to `main`; then re-verify `HEAD` equals `origin/main` and the working tree is clean.

---

## 9. STRICT SCOPE BOUNDARY

This task must NOT implement:

- BAREA-004 teacher review UI;
- question review workflow implementation;
- approval UI;
- regeneration UI;
- frontend application code;
- HTTP/REST endpoints;
- authentication/authorization;
- quiz authoring;
- quiz publishing;
- live sessions;
- participant joining;
- QR codes;
- WebSockets/realtime;
- scoring;
- leaderboards;
- analytics;
- deployment;
- pilot work;
- theological fact-checking engine;
- new LLM providers;
- unrelated refactoring.

---

## STOP CONDITION

Stop only when:

- PR #5 is merged;
- local checkout is on `main`;
- local `HEAD` is synchronized with `origin/main`;
- working tree is clean;
- safe temporary artifacts have been cleaned;
- obsolete safe-to-delete branches have been cleaned;
- verification-gate documentation is present in GitHub and local `main`;
- tests/typecheck/build pass;
- `AGY-REPORT.md` records the actual final state;
- BAREA-004 implementation has NOT started.

**STOP. Wait for the next explicit task.**