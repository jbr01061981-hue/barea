# AGY TASK — BAREA-003 Merge + Cleanup

## STATUS

Independent review of PR #4 has been completed.

**VERDICT: APPROVE.**

PR #4 is ready to merge. This task is ONLY the controlled merge, roadmap/report cleanup, verification, and branch cleanup for BAREA-003.

**Do NOT implement new BAREA-003 functionality.**
**Do NOT start BAREA-004 or any later milestone.**

---

## 1. SOURCE OF TRUTH

Repository: `jbr01061981-hue/barea`
PR: `#4`
Branch: `barea-003-ai-generation`
Base: `main`

The independently reviewed implementation head was:
`dbe45c48548264e26e89a0580488a5dc5459b486`

First verify the actual current PR head before acting. If the PR head differs, inspect the difference and STOP if unexpected implementation changes are present.

Do not reset, force-push, squash, or rewrite history.

---

## 2. VERIFY BEFORE MERGE

Verify all of the following before merging:

- PR #4 exists and is OPEN;
- PR #4 targets `main`;
- PR #4 is not already merged;
- current PR head is expected;
- working tree is clean;
- no unexpected implementation changes are present after the independent review.

Run the final validation suite on the current branch:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `git diff --check`
5. verify zero `any` in `src/`
6. verify zero BOM artifacts
7. verify no secrets committed
8. verify no legacy `.js` application/test source
9. verify `dist/` remains ignored
10. verify BAREA-003 atomic rollback tests pass
11. verify Gemini provider tests pass without real credentials/network dependency

Do not report a check as passed unless it was actually executed.

If any implementation regression is found, STOP and report it. Do not silently modify implementation during this merge task.

---

## 3. ROADMAP STATUS

After successful verification, update `docs/ROADMAP.md` so the milestone status is:

`BAREA-003 | AI Quiz Generation | ... | COMPLETED`

Ensure:

- BAREA-004 = NOT STARTED
- BAREA-005 = NOT STARTED
- BAREA-006 = NOT STARTED
- BAREA-007 = NOT STARTED
- BAREA-008 = NOT STARTED
- BAREA-009 = NOT STARTED
- BAREA-010 = NOT STARTED
- BAREA-011 = NOT STARTED
- BAREA-012 = NOT STARTED
- BAREA-013 = NOT STARTED

Preserve the existing roadmap wording and ordering. Make only the status update required for BAREA-003 and any necessary completion note.

Do not add BAREA-004 work to the roadmap.

---

## 4. AGY-REPORT.md

Update `AGY-REPORT.md` with the final BAREA-003 completion record.

Include only facts actually verified. At minimum record:

- milestone: BAREA-003;
- branch: `barea-003-ai-generation`;
- PR: `#4`;
- final implementation head SHA;
- merge result and resulting main SHA;
- final test result;
- typecheck result;
- build result;
- `git diff --check` result;
- source/secrets/BOM audits;
- atomic transaction regression result;
- Gemini provider regression result;
- roadmap update result;
- branch cleanup result;
- final working-tree status;
- explicit statement that BAREA-004+ was NOT started.

Do not fabricate SHAs, test counts, URLs, or results.

---

## 5. MERGE PR #4

Once verification and required roadmap/report preparation are complete, merge PR #4 into `main` using the repository's normal merge workflow.

Use a normal merge commit, consistent with the previous BAREA milestone merges.

Do NOT:

- squash the PR;
- rebase/rewrite the branch;
- force-push;
- create a replacement PR;
- merge any other PR;
- start BAREA-004.

PR #4 should become MERGED and CLOSED as the result of the normal merge.

---

## 6. POST-MERGE MAIN VERIFICATION

After the merge:

1. switch local checkout to `main`;
2. pull the merged main branch;
3. verify the working tree is clean;
4. verify BAREA-003 implementation is present on `main`;
5. verify BAREA-003 is marked COMPLETED in `docs/ROADMAP.md`;
6. verify BAREA-004 through BAREA-013 remain NOT STARTED;
7. verify no BAREA-004 implementation exists;
8. run `npm test` again on `main`;
9. run `npm run typecheck` again on `main`;
10. run `npm run build` again on `main`.

If the roadmap/report cleanup requires a separate post-merge commit on `main`, that is acceptable and should be a focused Conventional Commit. Do not modify implementation code.

---

## 7. BRANCH CLEANUP

After main verification succeeds:

- delete local `barea-003-ai-generation`;
- delete remote `barea-003-ai-generation`;
- prune stale remote-tracking references;
- verify local branch is `main`;
- verify working tree is clean.

Do not delete `main`.

---

## 8. FINAL REPORT

Update `AGY-REPORT.md` with the actual final post-merge state, including:

- merged PR #4;
- actual merge commit SHA;
- actual current main SHA;
- final test/typecheck/build results on main;
- roadmap status;
- branch deletion result;
- clean working tree result;
- explicit confirmation that BAREA-004+ was not started.

Do not claim completion until these checks have actually been performed.

---

## 9. STRICT SCOPE BOUNDARY

This task must NOT implement or begin:

- BAREA-004 teacher review UI;
- approval UI;
- regeneration UI;
- HTTP/REST endpoints;
- authentication/authorization;
- quiz authoring;
- quiz publishing;
- live sessions;
- participant joining;
- QR codes;
- WebSockets/realtime;
- host UI;
- participant UI;
- projector UI;
- scoring;
- leaderboards;
- analytics;
- deployment;
- pilot work;
- theological truth certification;
- Scripture fact-checking engine;
- unrelated refactoring.

---

## STOP CONDITION

Stop only after:

- PR #4 is merged into `main`;
- main contains the approved BAREA-003 implementation;
- roadmap marks BAREA-003 COMPLETED;
- BAREA-004–013 remain NOT STARTED;
- final validation passes on main;
- branch `barea-003-ai-generation` is deleted locally and remotely;
- local checkout is on `main`;
- working tree is clean;
- `AGY-REPORT.md` records the actual final state;
- no BAREA-004 work has started.

**STOP.**

Do not start BAREA-004.

Wait for the next explicit task.