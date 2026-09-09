# AGY — BAREA-005 DESIGN GATE — FINAL HANDOFF

## STATUS

The BAREA-005 design artifact has now been reported as committed to `main` at:

`7e894599f13f4725f927461c49e37fac8428a701`

BAREA-004 is completed and merged in:

`1faff33235378c6061a902a89454e5d62b097b0b`

**BAREA-005 IMPLEMENTATION IS NOT AUTHORIZED.**

This instruction is a HANDOFF/VALIDATION instruction only. Do not write BAREA-005 application code.

---

# 1. VERIFY THE PUBLISHED DESIGN

Verify directly on GitHub `main` that these artifacts exist and are internally consistent:

- `docs/BAREA-005-DESIGN-GATE.md`
- `AGY-REPORT.md`
- `docs/ROADMAP.md`
- `AGY-PROMPT.md`

Confirm the design commit is reachable from current `main`. Do not assume the reported SHA is sufficient; verify the actual files and current branch state.

If the design artifact is missing from the current `main`, restore/publicize the design artifact only. Do not implement anything.

---

# 2. REQUIRED DESIGN CONTENT

Verify `docs/BAREA-005-DESIGN-GATE.md` covers, with precise implementation-ready detail:

1. canonical workflow:
   `Approved Question Bank -> Quiz Draft -> Configure -> Review -> Publish -> Immutable Published Snapshot`
2. exact BAREA-005 scope and non-goals;
3. Quiz domain model;
4. Quiz/question relationship;
5. SQLite persistence model and constraints;
6. Quiz lifecycle and legal transitions;
7. server-authoritative tenant/authorization model;
8. approved-question selection rules;
9. runtime payload allowlisting;
10. question ordering invariants;
11. timer configuration and validation;
12. scoring-style configuration and finite allowed values;
13. option-shuffle configuration;
14. publish authorization boundary;
15. publication-time revalidation of every question;
16. TOCTOU protection;
17. immutable published snapshot semantics;
18. atomic publication/failure behavior;
19. teacher authoring UI scope;
20. adversarial acceptance tests;
21. risks/trade-offs;
22. explicit implementation-readiness verdict.

---

# 3. SECURITY REVIEW REQUIREMENTS

Before recommending the design as ready, challenge these invariants:

### Tenant isolation

Org A must not be able to read, edit, publish, or attach Org B resources.

### Server-authoritative identity

No browser/query/form/request property may select the tenant or authenticated identity.

### Approval enforcement

Only currently approved questions may enter or be published in a quiz.

### Runtime boundary

Do not rely solely on TypeScript types. All server actions handling security-sensitive payloads must use explicit runtime allowlists/reconstruction or equivalent runtime validation.

Protected fields must never be client-controlled:

`id`, `organizationId`, `ownerId`, `status`, `publishedSnapshot`, `createdAt`, `updatedAt` and unknown fields.

### Publication revalidation

Every attached question must be re-fetched and revalidated for existence, organization ownership, approval state, and eligibility inside the publication transaction.

### Snapshot integrity

After publication, later Question Bank edits/archive/delete/demotion must not change the published quiz.

### Atomicity

Publication must either complete fully or leave no published/partial state.

---

# 4. PERSISTENCE/DATA CHALLENGE

The reported design uses:

- `quizzes`
- `quiz_questions`
- `published_quiz_snapshots`

Review whether the proposed keys, uniqueness constraints, indexes, foreign-key behavior, organization columns, ordering representation, and transaction strategy actually enforce the stated invariants.

Pay particular attention to whether the schema can accidentally allow:

- duplicate question membership;
- duplicate positions;
- cross-tenant question attachment;
- orphaned snapshot state;
- publication without complete snapshot;
- mutation of a published snapshot;
- publication based on stale approval state.

Do not approve a schema merely because it looks plausible.

---

# 5. API/SERVER-ACTION DESIGN CHALLENGE

Review the proposed Quiz actions/services for explicit boundaries.

For every mutation, require a clear distinction between:

`trusted server context`

and

`untrusted client arguments`.

Challenge at least:

- create quiz;
- read quiz;
- update quiz;
- add question;
- remove question;
- reorder questions;
- configure quiz;
- publish quiz;
- archive if included.

The design must prevent lifecycle/status/tenant injection just as BAREA-004 now does.

---

# 6. TOCTOU CHALLENGE

The design says publication revalidates questions inside the transaction.

Independently check whether this is actually strong enough for the SQLite model and proposed query/update order.

The design must answer:

- when the transaction starts;
- how the quiz is locked/serialized;
- how all question rows are re-read;
- how approval is verified;
- what happens if one question is missing/archived/demoted;
- when the snapshot is constructed;
- when the status changes to `PUBLISHED`;
- what rollback does after any failure.

Flag any race or ambiguous transaction boundary.

---

# 7. SNAPSHOT CHALLENGE

Verify the snapshot is truly self-contained enough for later live execution.

It should preserve all data needed by future live gameplay without depending on mutable Question Bank state.

Check especially:

- question text;
- options;
- correct-answer data for the future server-authoritative engine;
- explanation/scripture metadata;
- effective timer values;
- scoring configuration;
- option-shuffle configuration;
- ordering;
- published timestamp/user metadata.

Do not add live gameplay functionality now.

---

# 8. ADVERSARIAL TEST MATRIX

Verify the design defines concrete expected outcomes for at least these cases:

1. cross-tenant Quiz read;
2. cross-tenant Quiz update;
3. cross-tenant publish;
4. cross-tenant question attachment;
5. unapproved question selection;
6. archived question selection;
7. approval lost between draft selection and publish;
8. question deleted/archived between selection and publish;
9. runtime `status` injection;
10. runtime `organizationId` injection;
11. runtime `id` injection;
12. unknown-field injection;
13. duplicate question IDs;
14. nonexistent question IDs;
15. invalid ordering;
16. invalid timer values;
17. invalid scoring values;
18. snapshot unaffected by later Question Bank modification;
19. unauthorized publish;
20. transaction failure leaves no partial publication.

Each case should have a stable test ID and expected result.

---

# 9. FRONTEND REVIEW

Confirm the proposed teacher authoring UI:

- uses existing BAREA frontend standards;
- never treats client state as authorization;
- makes approved-question status clear;
- provides an explicit publish confirmation;
- clearly explains that publication creates an immutable snapshot;
- does not introduce participant/live-game UI prematurely.

---

# 10. ROADMAP CONSISTENCY

`docs/ROADMAP.md` must state:

- BAREA-004 = COMPLETED / MERGED;
- BAREA-005 = DESIGN GATE COMPLETED / PENDING INDEPENDENT GO;
- BAREA-005 implementation = NOT STARTED.

`AGY-REPORT.md` must no longer contain stale claims that PR #6 is open/unmerged.

Do not mark BAREA-005 as implemented merely because the design exists.

---

# 11. REVIEW OUTPUT

After verification, update `AGY-REPORT.md` only with factual corrections/evidence discovered during this handoff review.

State clearly:

- design artifact commit SHA;
- files verified on `main`;
- architecture/persistence verdict;
- security verdict;
- TOCTOU verdict;
- snapshot verdict;
- adversarial matrix verdict;
- unresolved design questions;
- whether the design is ready for independent GO review.

Do not fabricate tests, agent participation, or implementation results.

---

# 12. STRICT STOP CONDITION

After completing the design verification/reporting:

**STOP.**

Do NOT:

- create `src/domain/quiz.ts` or other BAREA-005 implementation files;
- create SQL migrations/tables for implementation;
- create Quiz server actions/services/components;
- start BAREA-006;
- open or merge an implementation PR.

The only permitted changes at this stage are documentation corrections needed to accurately publish and report the design gate.

## FINAL SEQUENCE

`DESIGN VERIFIED -> INDEPENDENT REVIEW -> GO -> IMPLEMENTATION`

The independent reviewer will now determine whether BAREA-005 receives implementation authorization.