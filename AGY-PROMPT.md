# AGY — BAREA-005 DESIGN GATE PUBLICATION & HANDOFF

## STATUS

BAREA-004 is completed and merged on `main`.

The previous AGY instruction required a **BAREA-005 design-only gate**. AGY has reported that the design gate was completed, but the reported design artifact is not currently visible on GitHub `main`.

### IMPORTANT

**BAREA-005 IMPLEMENTATION REMAINS STRICTLY UNAUTHORIZED.**

Do not write application code, database migrations, implementation tests, UI implementation, or live-quiz functionality.

Your immediate task is to ensure the completed DESIGN GATE is actually committed and visible on GitHub so it can undergo independent review.

---

# 1. REQUIRED SOURCE-OF-TRUTH CHECK

Before changing anything, inspect the current `main` versions of:

- `AGENTS.md`
- `AGY-PROMPT.md`
- `AGY-REPORT.md`
- `README.md`
- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md` if present
- `docs/VERIFICATION-GATES.md` if present

Confirm BAREA-004 remains merged and that no BAREA-005 application implementation has been introduced.

---

# 2. REQUIRED DESIGN ARTIFACT

The completed design gate MUST exist at exactly:

`docs/BAREA-005-DESIGN-GATE.md`

If the design exists only locally, commit it to the current BAREA working branch and push it to GitHub.

If it does not exist, reconstruct the design from the previous BAREA-005 design-gate requirements and create it.

Do not create an implementation branch or implementation PR.

---

# 3. DESIGN CONTENT REQUIREMENTS

`docs/BAREA-005-DESIGN-GATE.md` must contain all of the following:

1. Objective and canonical workflow:
   `Approved Question Bank -> Quiz Draft -> Configure -> Review -> Publish -> Immutable Published Snapshot`
2. Explicit scope and non-goals.
3. Quiz domain model.
4. Quiz/question relationship.
5. Persistence/database design consistent with the existing SQLite architecture.
6. Quiz lifecycle, at minimum `DRAFT -> PUBLISHED` unless a documented existing requirement requires more.
7. Server-authoritative tenant/organization model.
8. Question-selection revalidation.
9. Approval enforcement.
10. Runtime payload allowlisting.
11. Timer configuration and validation.
12. Scoring configuration and finite allowed values.
13. Question ordering and validation.
14. Option-shuffle configuration.
15. Explicit publish server-action/service boundary.
16. Publication-time revalidation of every question.
17. TOCTOU protection and transaction strategy.
18. Immutable published snapshot design.
19. Atomic publication/failure behavior.
20. Teacher authoring UI design.
21. Security invariants.
22. Adversarial acceptance-test matrix.
23. Implementation risks/trade-offs.
24. Explicit final design readiness verdict.

Do not merely describe these requirements at a high level. The design must make the security and persistence behavior sufficiently precise that an implementation can later be reviewed against it.

---

# 4. MANDATORY SECURITY INVARIANTS

The design MUST explicitly guarantee:

### Tenant isolation

An authorized teacher from Org A cannot:

- read Org B quizzes;
- modify Org B quizzes;
- publish Org B quizzes;
- attach Org B questions to an Org A quiz.

### Server-authoritative identity

Organization identity and teacher authorization come only from trusted server-side context.

Client/query/form input has zero authority over tenant selection.

### Approved questions only

A question may enter a quiz only after server-side verification that it belongs to the authorized organization and is currently approved/eligible.

### Publication revalidation

Approval, tenant ownership, existence, structure, and eligibility must be rechecked at publication time inside the publication transaction.

### Runtime allowlisting

Do not pass arbitrary runtime request objects directly to persistence.

Client input must not control or inject:

- `id`;
- `organizationId`;
- `ownerId`;
- `status`;
- `published`;
- `publishedSnapshot`;
- `createdAt`;
- `updatedAt`;
- unknown persistence fields.

This must explicitly incorporate the BAREA-004 lesson where TypeScript typing alone was insufficient as a runtime security boundary.

### Snapshot immutability

After publication, subsequent Question Bank edits, demotions, archival, or deletion must not alter the published quiz.

Future live sessions must consume the frozen published representation rather than mutable Question Bank rows.

### Atomic publication

No partially published quiz may remain after a failure.

---

# 5. REQUIRED ADVERSARIAL TEST MATRIX

The design MUST define concrete tests covering at least:

- cross-tenant quiz read;
- cross-tenant quiz update;
- cross-tenant publish;
- cross-tenant question attachment;
- unapproved question selection;
- runtime `status: APPROVED` injection;
- runtime `organizationId` injection;
- runtime `id` injection;
- arbitrary/unknown field injection;
- duplicate question IDs;
- nonexistent question IDs;
- invalid ordering;
- invalid timer values;
- invalid scoring values;
- publication after a question loses approval;
- publication after a question changes tenant ownership;
- publication after a source question is deleted/archived;
- snapshot remains unchanged after source question modification;
- unauthorized publish;
- publication transaction failure leaves no partial state.

The design should assign stable IDs to these tests, e.g. `ADV-QZ-01` through `ADV-QZ-20`, and explain the expected security/invariant result.

---

# 6. PERSISTENCE REVIEW

Because the reported design proposes:

- `quizzes`;
- `quiz_questions`;
- `published_quiz_snapshots`;

validate that these structures actually fit the current repository's persistence conventions.

Do not blindly implement them merely because they were previously proposed.

Explain:

- primary keys;
- organization scoping;
- foreign-key relationships where appropriate;
- ordering representation;
- draft configuration storage;
- snapshot storage;
- transaction boundaries;
- uniqueness constraints needed to enforce invariants;
- how publication prevents partial state.

If another representation is safer/simpler, document it and explain why.

---

# 7. MULTI-AGENT REVIEW

Use available specialized agents if supported.

Request actual independent review from:

1. **Security/Backend** — tenant isolation, approval enforcement, runtime payload attacks, TOCTOU, publication authorization.
2. **Persistence/Data** — SQLite schema, constraints, transaction behavior, snapshot integrity.
3. **Frontend/Next.js** — teacher authoring flow and server/client security boundary.
4. **Testing** — adversarial matrix completeness and invariant coverage.
5. **Independent Reviewer** — attempt to identify a design-level bypass or ambiguity.

Record only actual participation and actual findings. Never fabricate agent activity.

Reconcile disagreements explicitly in the design document or report.

---

# 8. AGY-REPORT.md

Update `AGY-REPORT.md` with a dedicated **BAREA-005 Design Gate** section containing:

- exact design artifact path;
- commit SHA containing the artifact;
- documents inspected;
- confirmation that implementation remains unauthorized;
- architecture/persistence summary;
- security summary;
- snapshot strategy;
- transaction/TOCTOU strategy;
- adversarial-test matrix summary;
- actual multi-agent participation and findings;
- unresolved questions, if any;
- final design readiness recommendation.

Do not leave stale statements claiming PR #6 is open/unmerged. BAREA-004 is already merged.

Do not claim tests or reviews that were not actually performed.

---

# 9. ROADMAP CONSISTENCY

Ensure `docs/ROADMAP.md` reflects:

- BAREA-004 = COMPLETED / MERGED;
- BAREA-005 = DESIGN GATE COMPLETED / PENDING INDEPENDENT GO;
- BAREA-005 implementation = NOT STARTED.

Do not mark BAREA-005 implemented merely because the design exists.

---

# 10. VERIFICATION

After committing the design/report/documentation changes, verify:

- the exact design file exists on GitHub;
- `AGY-REPORT.md` contains the design-gate evidence;
- `docs/ROADMAP.md` has consistent milestone status;
- no BAREA-005 application implementation was added;
- working tree is clean;
- the resulting commit SHA is recorded.

If actual automated tests are run, report their real results. Do not manufacture implementation-test results for code that has not been written.

---

# 11. STOP CONDITION

After the design artifact, report, and roadmap are committed and pushed:

**STOP.**

Do NOT:

- implement BAREA-005;
- create database migrations for BAREA-005;
- create Quiz services/actions/components;
- open an implementation PR;
- merge an implementation PR;
- start BAREA-006 or later milestones.

Wait for an independent BAREA design review and explicit **GO** authorization.

---

# FINAL AUTHORITY RULE

The existence of a design document does NOT grant implementation permission.

The sequence is:

`DESIGN -> INDEPENDENT REVIEW -> GO -> IMPLEMENTATION`

Until the independent review says **GO**, BAREA-005 remains implementation-blocked.