# BAREA Database Architecture

## Status

**Frozen — ADR-014**

This document is the database-focused reference for the BAREA relational persistence architecture. It complements, and does not replace, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

**Runtime correction:** the earlier Node `node:sqlite` local-development path is superseded by the owner-selected Cloudflare-native development architecture. The frozen relational schema and repository/domain boundaries remain authoritative; local development should exercise D1-compatible behavior through Wrangler/local D1 rather than direct application SQLite.

The current implementation baseline is:

- Local development / CI: Workers-compatible local D1 through Wrangler
- Production application runtime: Cloudflare Workers
- Production relational storage target: Cloudflare D1
- Production real-time coordination target: Cloudflare Durable Objects
- Production domain: `growinfaith.app`
- Future large files/media: Cloudflare R2
- Tables: **17**
- Explicit application-created indexes: **18**
  - 16 query-path indexes
  - 2 partial unique invariant indexes
- SQLite internal autoindexes: implementation-generated and not part of the application index inventory
- Triggers: **7**
- Views: **0**

## Source-of-truth hierarchy

1. The current `main` repository is authoritative for implemented schema behavior.
2. This document is the database-focused architectural reference.
3. `docs/ARCHITECTURE.md` is the broader system architecture reference.
4. `docs/DECISIONS.md` ADR-014 records the architectural decision.
5. `test/database-freeze.test.ts` protects the frozen inventory and selected invariants.

A historical report must not override the current repository state.

## 1. Tables

### Identity and authentication

#### `users`

- `id` TEXT PRIMARY KEY
- `email` TEXT UNIQUE
- `email_verified` INTEGER NOT NULL CHECK 0/1
- `password_hash` TEXT
- `display_name` TEXT NOT NULL
- `created_at` TEXT NOT NULL

#### `federated_identities`

- `id` TEXT PRIMARY KEY
- `user_id` TEXT NOT NULL FK -> `users.id` ON DELETE CASCADE
- `provider_type` TEXT NOT NULL
- `provider_sub` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- UNIQUE(`provider_type`, `provider_sub`)

The provider subject binding is immutable identity data.

#### `user_sessions`

- `id` TEXT PRIMARY KEY; stores the session-token hash
- `user_id` TEXT NOT NULL FK -> `users.id` ON DELETE CASCADE
- `auth_provider` TEXT NOT NULL
- `provider_sub` TEXT
- `expires_at` TEXT NOT NULL
- `created_at` TEXT NOT NULL

Session validity is server-authoritative.

#### `oauth_transactions`

- `id` TEXT PRIMARY KEY
- `state_hash` TEXT UNIQUE
- `code_verifier` TEXT
- `nonce_hash` TEXT
- `return_to` TEXT
- `created_at` TEXT
- `expires_at` TEXT
- `consumed_at` TEXT

OAuth transactions are transient, single-use, expiry-bound records.

#### `organization_memberships`

- `organization_id` TEXT
- `user_id` TEXT NOT NULL FK -> `users.id` ON DELETE CASCADE
- `role` TEXT CHECK `teacher` / `admin`
- PRIMARY KEY(`organization_id`, `user_id`)

This is the server-side teacher/admin authorization boundary.

### Question bank and quiz authoring

#### `questions`

Stores reusable question-bank content and its human-review lifecycle.

Key fields:

- `id` TEXT PRIMARY KEY
- `organization_id` TEXT NOT NULL
- `stem` TEXT NOT NULL
- `type` TEXT NOT NULL
- `options_json` TEXT NOT NULL
- `correct_option_indices_json` TEXT NOT NULL
- `explanation` TEXT
- `scripture_reference` TEXT NOT NULL
- `topic` TEXT NOT NULL
- `difficulty` TEXT NOT NULL
- `language` TEXT NOT NULL
- `status` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Question lifecycle is:

`DRAFT -> PENDING_REVIEW -> APPROVED -> ARCHIVED`

Editing approved content returns it to review.

#### `quizzes`

Draft authoring container.

Key fields:

- `id` TEXT PRIMARY KEY
- `organization_id` TEXT NOT NULL
- `title` TEXT
- `description` TEXT
- `status` TEXT: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `default_time_limit_seconds` INTEGER, constrained to 10..120
- `scoring_style` TEXT: `STANDARD` / `SPEED_WEIGHTED`
- `option_shuffle` INTEGER CHECK 0/1
- `created_at` TEXT
- `updated_at` TEXT

#### `quiz_questions`

- `quiz_id` TEXT FK -> `quizzes.id` ON DELETE CASCADE
- `question_id` TEXT FK -> `questions.id` ON DELETE RESTRICT
- `sort_order` INTEGER CHECK >= 1
- `added_at` TEXT
- PRIMARY KEY(`quiz_id`, `question_id`)
- UNIQUE(`quiz_id`, `sort_order`)

Published quizzes do not mutate their question composition.

#### `published_quiz_snapshots`

Immutable published quiz versions.

Key fields:

- `id` TEXT PRIMARY KEY
- `quiz_id` TEXT FK -> `quizzes.id` ON DELETE RESTRICT
- `organization_id` TEXT
- `title` TEXT
- `description` TEXT
- `default_time_limit_seconds` INTEGER
- `scoring_style` TEXT
- `option_shuffle` INTEGER
- `version_number` INTEGER CHECK >= 1
- `snapshot_json` TEXT
- `published_at` TEXT
- `published_by_user_id` TEXT FK -> `users.id` ON DELETE RESTRICT
- UNIQUE(`quiz_id`, `version_number`)

Database triggers prevent update/delete.

### Live sessions

#### `quiz_sessions`

Represents a live quiz room.

Key fields:

- `id` TEXT PRIMARY KEY
- `tenant_type`: `ORGANIZATION` / `PERSONAL`
- `organization_id` TEXT NOT NULL
- `published_quiz_snapshot_id` TEXT FK -> `published_quiz_snapshots.id` ON DELETE RESTRICT
- `host_user_id` TEXT FK -> `users.id` ON DELETE RESTRICT
- `room_code` TEXT
- `participation_mode`: `TEACHER_GROUP` / `INDIVIDUAL_AUTHENTICATED`
- `admission_policy`: `TEACHER_ASSIGNED` / `OPEN` / `RESTRICTED`
- `status`: `LOBBY` / `ACTIVE` / `COMPLETED` / `CLOSED`
- `scheduled_start_at` TEXT
- `is_locked` INTEGER CHECK 0/1
- `state_version` INTEGER CHECK >= 1
- `max_participants` INTEGER CHECK 1..1000
- `created_at` TEXT
- `expires_at` TEXT
- `closed_at` TEXT

Session/snapshot tenant compatibility and immutable tenant binding are database-protected.

#### `session_participants`

Verified individual participants in a session.

Key fields:

- `id` TEXT PRIMARY KEY
- `session_id` TEXT FK -> `quiz_sessions.id` ON DELETE CASCADE
- `user_id` TEXT NOT NULL FK -> `users.id` ON DELETE CASCADE
- `provider_type` TEXT
- `provider_sub` TEXT
- `verified_email` TEXT
- `verified_phone` TEXT
- `display_name` TEXT
- `joined_at` TEXT
- `last_active_at` TEXT
- `token_hash` TEXT
- UNIQUE(`session_id`, `user_id`)
- UNIQUE(`session_id`, `provider_type`, `provider_sub`)

Current individual participation requires verified identity.

#### `session_groups`

Teacher-operated group participation.

- `id` TEXT PRIMARY KEY
- `session_id` TEXT FK -> `quiz_sessions.id` ON DELETE CASCADE
- `group_name` TEXT
- `sort_order` INTEGER
- `created_at` TEXT
- UNIQUE(`session_id`, `group_name`)

#### `session_group_pupils`

Pupils represented inside teacher-operated groups.

- `id` TEXT PRIMARY KEY
- `session_group_id` TEXT FK -> `session_groups.id` ON DELETE CASCADE
- `session_id` TEXT FK -> `quiz_sessions.id` ON DELETE CASCADE
- `pupil_name` TEXT
- `assigned_at` TEXT
- UNIQUE(`session_group_id`, `pupil_name`)

The MVP does not add a `color` field.

#### `session_invitations`

Restricted-session allowlist records.

- `id` TEXT PRIMARY KEY
- `session_id` TEXT FK -> `quiz_sessions.id` ON DELETE CASCADE
- `invitation_type`: `EMAIL` / `PHONE`
- `normalized_identifier` TEXT
- `invited_at` TEXT
- `claimed_by_user_id` TEXT FK -> `users.id` ON DELETE SET NULL
- `claimed_at` TEXT
- UNIQUE(`session_id`, `invitation_type`, `normalized_identifier`)

Restricted-room failures remain generic to avoid room enumeration.

#### `session_live_states`

Persistent recovery checkpoint for live state.

- `session_id` TEXT PRIMARY KEY FK -> `quiz_sessions.id` ON DELETE CASCADE
- `current_question_position` INTEGER
- `current_question_id` TEXT
- `question_state`: `NOT_STARTED`, `PREVIEW`, `ANSWERING`, `LOCKED`, `COMPLETED`
- `question_opened_at` TEXT
- `answer_deadline_at` TEXT
- `time_limit_seconds` INTEGER
- `updated_at` TEXT

In production, Durable Objects remain authoritative for active real-time timers/state. D1 is the durable recovery/checkpoint store.

#### `session_answers`

Server-recorded answers.

Key fields:

- `id` TEXT PRIMARY KEY
- `session_id` TEXT FK -> `quiz_sessions.id` ON DELETE CASCADE
- `question_position` INTEGER
- `question_id` TEXT
- `participant_id` TEXT FK -> `session_participants.id` ON DELETE CASCADE
- `user_id` TEXT FK -> `users.id` ON DELETE CASCADE
- `session_group_id` TEXT FK -> `session_groups.id` ON DELETE CASCADE
- `session_group_pupil_id` TEXT FK -> `session_group_pupils.id` ON DELETE SET NULL
- `selected_option_indices` TEXT
- `submitted_at` TEXT
- `client_submitted_at` TEXT
- `is_within_deadline` INTEGER CHECK 0/1
- UNIQUE(`session_id`, `question_position`, `user_id`)
- UNIQUE(`session_id`, `question_position`, `session_group_id`)

The subject-validity CHECK constraint requires exactly one valid answer subject:

- individual: participant + user, no group subject; or
- group: session group only, with no participant/user/pupil subject.

Server time, not client time, determines deadline acceptance.

### Finalized results

#### `session_results`

Immutable final podium/result records.

- `id` TEXT PRIMARY KEY
- `session_id` TEXT NOT NULL FK -> `quiz_sessions.id` ON DELETE RESTRICT
- `subject_type`: `PARTICIPANT` / `GROUP`
- `participant_id` FK -> `session_participants.id` ON DELETE RESTRICT
- `session_group_id` FK -> `session_groups.id` ON DELETE RESTRICT
- `display_name` TEXT NOT NULL
- `final_score` INTEGER NOT NULL DEFAULT 0
- `correct_count` INTEGER NOT NULL DEFAULT 0
- `total_questions` INTEGER NOT NULL
- `rank` INTEGER NOT NULL CHECK >= 1
- `final_answer_submitted_at` TEXT NOT NULL
- `completed_at` TEXT NOT NULL
- UNIQUE(`session_id`, `rank`)

A subject CHECK constraint requires either a participant result or a group result, never both.

Two partial unique indexes enforce one result per participant/group per session.

Results are immutable and retained through normal session cleanup.

## 2. Explicit indexes

The frozen application inventory contains **18 explicit physical indexes**.

### Query-path indexes

1. `idx_answers_session_pos` — `session_answers(session_id, question_position)`
2. `idx_federated_identities_sub` — `federated_identities(provider_type, provider_sub)`
3. `idx_oauth_transactions_expires_at` — `oauth_transactions(expires_at)`
4. `idx_org_memberships_user` — `organization_memberships(user_id)`
5. `idx_participants_session` — `session_participants(session_id)`
6. `idx_questions_org_diff` — `questions(organization_id, difficulty)`
7. `idx_questions_org_status` — `questions(organization_id, status)`
8. `idx_questions_org_topic` — `questions(organization_id, topic)`
9. `idx_quiz_questions_quiz` — `quiz_questions(quiz_id, sort_order)`
10. `idx_quizzes_org_status` — `quizzes(organization_id, status)`
11. `idx_sessions_active_room_code` — partial unique `quiz_sessions(room_code)` for `LOBBY` / `ACTIVE`
12. `idx_sessions_host` — `quiz_sessions(host_user_id, status)`
13. `idx_sessions_organization` — `quiz_sessions(organization_id, status)`
14. `idx_snapshots_org` — `published_quiz_snapshots(organization_id)`
15. `idx_user_sessions_user_id` — `user_sessions(user_id)`
16. `idx_users_email` — `users(email)`

### Partial unique invariant indexes

17. `uq_session_results_participant` — `session_results(session_id, participant_id)` WHERE `subject_type = 'PARTICIPANT'`
18. `uq_session_results_group` — `session_results(session_id, session_group_id)` WHERE `subject_type = 'GROUP'`

SQLite may also create internal `sqlite_autoindex_*` structures for primary/unique constraints. Those are not part of the explicit application index inventory.

## 3. Triggers

The frozen trigger inventory contains 7 triggers:

1. `prevent_published_quiz_delete`
2. `prevent_session_result_delete`
3. `prevent_session_result_update`
4. `prevent_snapshot_delete`
5. `prevent_snapshot_update`
6. `trg_enforce_session_snapshot_tenant_insert`
7. `trg_prevent_session_tenant_mutation`

They protect published snapshot immutability, finalized result immutability, and session tenant/snapshot binding.

## 4. Views

**No database views are part of the frozen MVP schema.**

Queries remain explicit and parameterized at the repository/service boundary.

## 5. Relationships and tenant boundaries

Core ownership graph:

```text
users
 ├── federated_identities
 ├── user_sessions
 ├── organization_memberships
 ├── published_quiz_snapshots (publisher)
 ├── quiz_sessions (host)
 └── session_participants

questions
 └── quiz_questions
      └── quizzes
           └── published_quiz_snapshots
                └── quiz_sessions
                     ├── session_participants
                     ├── session_groups
                     │    └── session_group_pupils
                     ├── session_invitations
                     ├── session_live_states
                     ├── session_answers
                     └── session_results
```

Tenant-sensitive data must be authorized by server-derived identity/membership and validated against the owning session/organization. Client-supplied tenant, role, timing, scoring, or answer authority is not trusted.

## 6. Transaction boundaries

Public repository interfaces do **not** expose a generic `transaction<T>()` callback.

Atomic domain workflows are exposed as domain-specific operations:

- `createPendingReviewBatch()`
- `approveQuestionBatch()`
- `publishQuiz()`
- `finalizeSessionResults()`

SQLite transaction mechanics remain private to the persistence adapter. The production D1 implementation must preserve the same domain atomicity rather than leaking a database-specific transaction API into application contracts.

## 7. Time boundary

Time-sensitive application behavior uses the injectable `Clock` port:

- `nowMs()`
- `nowIso()`

The persistence layer does not expose `getCurrentTimeMs()` or test-only clock mutation methods.

Active live-session timing remains server-authoritative; client clocks are presentation aids only.

## 8. Data lifecycle

- OAuth transactions: short-lived and single-use; expired records may be pruned.
- User sessions: expire/revoke server-side.
- Questions: review lifecycle through archive.
- Draft quizzes: mutable until publication.
- Published snapshots: immutable historical records.
- Live sessions: progress through lobby/active/completed/closed lifecycle.
- Live state: durable recovery checkpoint.
- Answers: retained as session history.
- Finalized results: immutable and protected by `ON DELETE RESTRICT`.

## 9. SQLite / D1 portability boundary

The schema is intentionally relational and SQLite-compatible.

Application contracts must not depend on SQLite-specific transaction objects. Database-specific transaction mechanics remain inside adapters.

The production migration target is Cloudflare D1, while Durable Objects own active real-time coordination. Any future D1 migration work must preserve:

- tenant isolation;
- foreign-key integrity;
- unique constraints;
- partial unique indexes;
- immutable snapshot/result behavior;
- server-authoritative answer timing;
- domain-level atomic workflows.

## 10. Verification

The frozen database inventory and selected invariants are protected by:

```text
test/database-freeze.test.ts
```

The expected current inventory is:

```text
17 application tables
18 explicit application indexes
7 triggers
0 views
```

The repository's normal quality gates remain:

```text
npm test
npm run typecheck
npx tsc -p tsconfig.test.json
npm run build:next
git diff --check
```

## Related documents

- `docs/ARCHITECTURE.md` — system architecture and authoritative live-state model
- `docs/DECISIONS.md` — ADR-014 database architecture freeze and related decisions
- `docs/ROADMAP.md` — implementation sequencing and milestone status
- `docs/PRODUCT.md` — product behavior and participation model
- `docs/REQUIREMENTS.md` — functional/non-functional requirements
- `test/database-freeze.test.ts` — executable database freeze verification
