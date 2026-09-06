# AGY Report -- BAREA-002 Corrective Fix (Approval Gate)

## Summary
Completed the BAREA-002 corrective task as requested in `AGY-PROMPT.md` on branch `barea-002-question-bank` for Pull Request #2.

## Task Completed
Enforced the human-review approval gate at creation time:
- Prohibited creating questions directly with `status: APPROVED`.
- Ensured normal question creation always starts as `DRAFT` by default, and any explicit creation payload specifying `status: APPROVED` is strictly rejected by domain validation with a descriptive `DomainValidationError`.
- Ensured `APPROVED` status can only be achieved by progressing questions through the legitimate review lifecycle (`DRAFT -> PENDING_REVIEW -> APPROVED`).
- Updated all existing test fixtures to create questions as `DRAFT` and transition them through the review lifecycle to reach `APPROVED`.
- Added comprehensive regression tests.

## Lifecycle / Approval Behavior Fixed
1. **Creation Invariant**: In `src/domain/question.js` (`validateQuestionPayload`), when `isUpdate` is `false`, any payload containing `status: APPROVED` throws `DomainValidationError('Questions cannot be created directly with APPROVED status. They must follow the review lifecycle.')`.
2. **Review Gate Guarantee**: Direct creation of approved content is impossible. No question can enter the Question Bank as `APPROVED` without undergoing the human teacher review transition sequence:
   ```text
   DRAFT -> PENDING_REVIEW -> APPROVED
   ```
3. **Preserved Invariants**:
   - Content edits to `APPROVED` questions automatically demote to `PENDING_REVIEW` (`ADR-007`).
   - Soft deletion via `archiveQuestion` / transition to `ARCHIVED`.
   - Reject duplicate `correctOptionIndices` in `MULTI_SELECT`.
   - Durable file persistence across SQLite repository close and reopen.
   - Strict organization/tenant isolation across queries and mutations.
   - Question-level difficulty (`Easy`, `Medium`, `Hard`) and types (`MULTIPLE_CHOICE`, `TRUE_FALSE`, `MULTI_SELECT`).
   - Zero external npm runtime dependencies.

## Tests Added & Updated
Updated `test/question-bank.test.js`:
- Added test: `rejects question creation with explicit APPROVED status` under `Question Domain & Validation`.
- Added test: `creates question defaulting to DRAFT and rejects explicit APPROVED create in repository/service` verifying:
  - Default status is `DRAFT`.
  - Explicit `status: DRAFT` succeeds.
  - Direct create with `status: APPROVED` is rejected.
  - Legitimate lifecycle transition (`DRAFT -> PENDING_REVIEW -> APPROVED`) succeeds.
- Updated all test fixtures (`church-filter-test`, `church-A`, `church-B`, `church-review-safe`, `church-archive-test`, `church-durable-org`) to create questions as `DRAFT` and transition through `PENDING_REVIEW` to `APPROVED`.

## Test Execution Result
`npm test` (`node --test "test/**/*.test.js" "src/**/*.test.js"`) passed cleanly:
```text
> barea@0.1.0 test
> node --test "test/**/*.test.js" "src/**/*.test.js"

PASS Question Domain & Validation
  ✔ accepts valid MCQ question payload
  ✔ accepts valid TRUE_FALSE question payload
  ✔ accepts valid MULTI_SELECT question payload
  ✔ rejects empty organizationId
  ✔ rejects empty stem
  ✔ rejects invalid difficulty
  ✔ rejects invalid question type
  ✔ rejects out of bounds correctOptionIndices
  ✔ rejects duplicate correctOptionIndices in MULTI_SELECT
  ✔ rejects question creation with explicit APPROVED status
PASS Question Lifecycle State Transitions
  ✔ valid transitions succeed
  ✔ invalid transitions are rejected
PASS Question Bank Persistence & Service CRUD Operations
  ✔ creates question defaulting to DRAFT and rejects explicit APPROVED create in repository/service
  ✔ creates and retrieves question with durable persistence
  ✔ updates question content and preserves domain invariants
  ✔ validates lifecycle transition in service
  ✔ filters by topic, difficulty, type, language, status, and search
  ✔ enforces strict organizational ownership isolation
  ✔ modifying approved question content cannot leave it silently approved (demotes to PENDING_REVIEW)
  ✔ archiveQuestion soft-deletes question to ARCHIVED status
PASS Question Bank Durable Persistence Across File Reopen
total tests: 24
pass: 24
fail: 0
```

## Files Changed
- `src/domain/question.js`: Added validation rule rejecting direct creation with `APPROVED` status; removed unused `ApprovedQuestionModificationError`.
- `src/persistence/sqlite-question-repository.js`: Removed unused import of `ApprovedQuestionModificationError`.
- `src/index.js`: Removed unused export of `ApprovedQuestionModificationError`.
- `test/question-bank.test.js`: Added regression tests for creation status invariants, updated all fixtures, and removed unused import.
- `docs/DECISIONS.md`: Documented direct `APPROVED` creation prohibition in ADR-007.
- `.gitignore`: Added `*.log` to prevent stray log files.
- `AGY-REPORT.md`: Created detailed corrective task report.

## Git & Merge Status
- **PR #2 State**: **MERGED**
- **PR #2 URL**: https://github.com/jbr01061981-hue/barea/pull/2
- **Merge Commit SHA on `main`**: `1d9f1f5f3f662bf9c34288c4e55d42e155eac406`
- **Head Reviewed Commit**: `d7130348d8e07aba9a8778cefb8e9d197c6261c4`
- **Local Branch State**: Switched to `main`, pulled latest merge commit, deleted local `barea-002-question-bank` branch.
- **Remote Branch State**: Deleted remote `barea-002-question-bank` and pruned remote tracking branch references.
- **Working Tree**: Clean (`git status` reports working tree clean).
- **Scope Compliance**: Strictly no BAREA-003+ work was introduced (no AI generation, UI, live quiz engine, auth, or realtime transport). No TypeScript migration performed.
