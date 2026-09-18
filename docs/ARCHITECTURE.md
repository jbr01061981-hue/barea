# BAREA Conceptual System Architecture

## Current Owner Architecture Baseline — September 2026

The following owner decisions supersede earlier candidate-architecture notes in this document:

- Production platform: **Cloudflare**.
- Application runtime: **Cloudflare Workers**.
- Primary relational database: **Cloudflare D1**.
- Live quiz coordination: **Cloudflare Durable Objects**.
- Production domain: **`growinfaith.app`**.
- Production uses the Cloudflare Worker/custom-domain path; **Cloudflare Tunnel is not the production ingress architecture**.
- No VPS, Windows PC production server, Neon/PostgreSQL, or direct `node:sqlite`/`barea.db` application persistence architecture.
- Local development uses a Workers-compatible runtime with Wrangler and local D1; preview and production use separate D1 resources/bindings.
- One D1 database is the initial deployment shape; horizontal scale-out is conditional on actual workload and platform limits.
- Cloudflare R2 is reserved for future large files/media.
- Email, analytics, advertising/monetization, and worship media are explicit future platform boundaries and are not current quiz-MVP dependencies.

Earlier deployment material retained in ADR-012 is historical and is superseded by ADR-015 for the current production direction.


## 1. High-Level Architecture Overview

BAREA is designed as a decoupled, multi-surface real-time web platform centered on a server-authoritative state machine.

```text
                               ┌───────────────────────────┐
                               │     Teacher / Host UI     │ (Desktop / Tablet Web)
                               └─────────────┬─────────────┘
                                             │ Control & State Sync
                                             ▼
┌───────────────────────────┐   Event Sync  ┌───────────────────────────┐   Display Sync ┌───────────────────────────┐
│ Mobile Participant Client ├──────────────►│     BAREA Core Server     │◄───────────────┤  Projector / Screen View  │
│      (Smartphone Web)     │               │(API & Live State Machine) │                │    (Big Screen Display)   │
└───────────────────────────┘               └─────────────┬─────────────┘                └───────────────────────────┘
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    │                     │                     │
                                    ▼                     ▼                     ▼
                           ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
                           │   AI Pipeline   │   │ Persistent Data │   │ Live Session    │
                           │ (Generation &   │   │ (Question Bank, │   │ State & Sync    │
                           │ Schema Validate)│   │  Quizzes, Users)│   │ (Rooms, Timers) │
                           └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 2. Architectural Layers

### 2.1 Presentation Layer (Role-Dedicated Surfaces)
The system exposes three distinct user experiences:
1. **Teacher / Host Console**:
   - Question bank management, AI prompt generation interface, and quiz authoring.
   - Live session control room (start, advance, pause, and participant monitoring).
2. **Mobile Participant Client**:
   - Mobile-optimized responsive web client requiring no app store installation.
   - Clear, accessible answer buttons with immediate local submission acknowledgment.
   - Reconnection and session state synchronization.
3. **Projector / Presentation View**:
   - Large-screen display tailored for sanctuary, auditorium, and classroom visibility.
   - Synchronized countdown timer, active question stem, answer breakdown chart, and celebratory leaderboard.

### 2.2 Application & State Management Layer
- **Core Application Service**:
  - Handles authentication, question curation, AI generation requests, and quiz configuration.
- **Authoritative Live Quiz Engine**:
  - Implements a deterministic finite state machine (FSM) governing game progression.
  - Enforces synchronized timers and coordinates real-time event broadcasting.
  - Protects answer secrets: correct choices are withheld from participants until the answer reveal state.

### 2.3 AI Generation & Content Review Pipeline
- Generates structured draft questions based on teacher-selected topics, scriptures, question types, and difficulty levels.
- Executes structural validation to ensure response integrity before placing items into pending review.
- Distinguishes structural system validation from human theological review: content is not approved until a teacher reviews and confirms biblical faithfulness.

### 2.4 Data Persistence & Relational Schema Freeze (ADR-014)
- **Persistence Architecture**:
  - Local development / CI: Workers-compatible local D1 through Wrangler; direct `node:sqlite`/`barea.db` is not the application persistence architecture going forward.
  - Production Relational Storage: Cloudflare D1.
  - Production Real-Time Coordination: Cloudflare Durable Objects.
  - Production application runtime: Cloudflare Workers.
  - Future large files/media: Cloudflare R2.
- **Decoupled Architecture Ports**:
  - **Clock Port**: Dedicated injectable `Clock` (`nowMs()`, `nowIso()`) decoupling application timing from persistence layer. Persistence repositories never expose testing mutation methods (`setClockForTesting`) or timing getters (`getCurrentTimeMs`).
  - **Zero Transaction Leakage**: Public repository interfaces contain zero generic `transaction<T>()` callbacks; multi-statement workflows are encapsulated into domain-specific atomic repository methods (`createPendingReviewBatch`, `approveQuestionBatch`, `publishQuiz`, `finalizeSessionResults`). Repository transaction mechanics are private SQLite/D1 implementation details.
- **Relational Schema Freeze**:
  - **17 Tables**:
    1. `users` (`id` TEXT PK, `email` TEXT UNIQUE, `email_verified` INTEGER CHECK(0,1), `password_hash` TEXT, `display_name` TEXT, `created_at` TEXT)
    2. `federated_identities` (`id` TEXT PK, `user_id` TEXT FK->`users.id` ON DELETE CASCADE, `provider_type` TEXT, `provider_sub` TEXT, `created_at` TEXT, UNIQUE(`provider_type`, `provider_sub`))
    3. `user_sessions` (`id` TEXT PK, `user_id` TEXT FK->`users.id` ON DELETE CASCADE, `auth_provider` TEXT, `provider_sub` TEXT, `expires_at` TEXT, `created_at` TEXT)
    4. `oauth_transactions` (`id` TEXT PK, `state_hash` TEXT UNIQUE, `code_verifier` TEXT, `nonce_hash` TEXT, `return_to` TEXT, `created_at` TEXT, `expires_at` TEXT, `consumed_at` TEXT)
    5. `organization_memberships` (`organization_id` TEXT, `user_id` TEXT FK->`users.id` ON DELETE CASCADE, `role` TEXT CHECK('teacher','admin'), PK(`organization_id`, `user_id`))
    6. `questions` (`id` TEXT PK, `organization_id` TEXT, `stem` TEXT, `type` TEXT, `options_json` TEXT, `correct_option_indices_json` TEXT, `explanation` TEXT, `scripture_reference` TEXT, `topic` TEXT, `difficulty` TEXT, `language` TEXT, `status` TEXT, `created_at` TEXT, `updated_at` TEXT)
    7. `quizzes` (`id` TEXT PK, `organization_id` TEXT, `title` TEXT, `description` TEXT, `status` TEXT CHECK('DRAFT','PUBLISHED','ARCHIVED'), `default_time_limit_seconds` INTEGER CHECK(10..120), `scoring_style` TEXT CHECK('STANDARD','SPEED_WEIGHTED'), `option_shuffle` INTEGER CHECK(0,1), `created_at` TEXT, `updated_at` TEXT)
    8. `quiz_questions` (`quiz_id` TEXT FK->`quizzes.id` ON DELETE CASCADE, `question_id` TEXT FK->`questions.id` ON DELETE RESTRICT, `sort_order` INTEGER CHECK(>=1), `added_at` TEXT, PK(`quiz_id`, `question_id`), UNIQUE(`quiz_id`, `sort_order`))
    9. `published_quiz_snapshots` (`id` TEXT PK, `quiz_id` TEXT FK->`quizzes.id` ON DELETE RESTRICT, `organization_id` TEXT, `title` TEXT, `description` TEXT, `default_time_limit_seconds` INTEGER, `scoring_style` TEXT, `option_shuffle` INTEGER, `version_number` INTEGER CHECK(>=1), `snapshot_json` TEXT, `published_at` TEXT, `published_by_user_id` TEXT FK->`users.id` ON DELETE RESTRICT, UNIQUE(`quiz_id`, `version_number`))
    10. `quiz_sessions` (`id` TEXT PK, `tenant_type` TEXT CHECK('ORGANIZATION','PERSONAL'), `organization_id` TEXT, `published_quiz_snapshot_id` TEXT FK->`published_quiz_snapshots.id` ON DELETE RESTRICT, `host_user_id` TEXT FK->`users.id` ON DELETE RESTRICT, `room_code` TEXT, `participation_mode` TEXT CHECK('TEACHER_GROUP','INDIVIDUAL_AUTHENTICATED'), `admission_policy` TEXT CHECK('TEACHER_ASSIGNED','OPEN','RESTRICTED'), `status` TEXT CHECK('LOBBY','ACTIVE','COMPLETED','CLOSED'), `scheduled_start_at` TEXT, `is_locked` INTEGER CHECK(0,1), `state_version` INTEGER CHECK(>=1), `max_participants` INTEGER CHECK(1..1000), `created_at` TEXT, `expires_at` TEXT, `closed_at` TEXT, CHECK compatibility & closed consistency)
    11. `session_participants` (`id` TEXT PK, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE CASCADE, `user_id` TEXT FK->`users.id` ON DELETE CASCADE, `provider_type` TEXT, `provider_sub` TEXT, `verified_email` TEXT, `verified_phone` TEXT, `display_name` TEXT, `joined_at` TEXT, `last_active_at` TEXT, `token_hash` TEXT, UNIQUE(`session_id`, `user_id`), UNIQUE(`session_id`, `provider_type`, `provider_sub`))
    12. `session_groups` (`id` TEXT PK, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE CASCADE, `group_name` TEXT, `sort_order` INTEGER, `created_at` TEXT, UNIQUE(`session_id`, `group_name`))
    13. `session_group_pupils` (`id` TEXT PK, `session_group_id` TEXT FK->`session_groups.id` ON DELETE CASCADE, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE CASCADE, `pupil_name` TEXT, `assigned_at` TEXT, UNIQUE(`session_group_id`, `pupil_name`))
    14. `session_invitations` (`id` TEXT PK, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE CASCADE, `invitation_type` TEXT CHECK('EMAIL','PHONE'), `normalized_identifier` TEXT, `invited_at` TEXT, `claimed_by_user_id` TEXT FK->`users.id` ON DELETE SET NULL, `claimed_at` TEXT, UNIQUE(`session_id`, `invitation_type`, `normalized_identifier`))
    15. `session_live_states` (`session_id` TEXT PK FK->`quiz_sessions.id` ON DELETE CASCADE, `current_question_position` INTEGER, `current_question_id` TEXT, `question_state` TEXT CHECK('NOT_STARTED','PREVIEW','ANSWERING','LOCKED','COMPLETED'), `question_opened_at` TEXT, `answer_deadline_at` TEXT, `time_limit_seconds` INTEGER, `updated_at` TEXT)
    16. `session_answers` (`id` TEXT PK, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE CASCADE, `question_position` INTEGER, `question_id` TEXT, `participant_id` TEXT FK->`session_participants.id` ON DELETE CASCADE, `user_id` TEXT FK->`users.id` ON DELETE CASCADE, `session_group_id` TEXT FK->`session_groups.id` ON DELETE CASCADE, `session_group_pupil_id` TEXT FK->`session_group_pupils.id` ON DELETE SET NULL, `selected_option_indices` TEXT, `submitted_at` TEXT, `client_submitted_at` TEXT, `is_within_deadline` INTEGER CHECK(0,1), CHECK `chk_answer_subject_validity`, UNIQUE(`session_id`,`question_position`,`user_id`), UNIQUE(`session_id`,`question_position`,`session_group_id`))
    17. `session_results` (`id` TEXT PK, `session_id` TEXT FK->`quiz_sessions.id` ON DELETE RESTRICT, `subject_type` TEXT CHECK('PARTICIPANT','GROUP'), `participant_id` TEXT FK->`session_participants.id` ON DELETE RESTRICT, `session_group_id` TEXT FK->`session_groups.id` ON DELETE RESTRICT, `display_name` TEXT, `final_score` INTEGER, `correct_count` INTEGER, `total_questions` INTEGER, `rank` INTEGER CHECK(rank >= 1), `final_answer_submitted_at` TEXT, `completed_at` TEXT, CHECK `chk_result_subject`, UNIQUE(`session_id`, `rank`))
  - **18 Explicit Physical Indexes (16 Query-Path + 2 Partial Unique Invariant Indexes)**:
    1. `idx_answers_session_pos`: `session_answers(session_id, question_position)` -> submission count and answer lookup per question.
    2. `idx_federated_identities_sub`: `federated_identities(provider_type, provider_sub)` -> OIDC federated login lookup.
    3. `idx_oauth_transactions_expires_at`: `oauth_transactions(expires_at)` -> OAuth TTL pruning.
    4. `idx_org_memberships_user`: `organization_memberships(user_id)` -> Teacher/admin organization resolution on login.
    5. `idx_participants_session`: `session_participants(session_id)` -> Roster listing and participant count queries.
    6. `idx_questions_org_diff`: `questions(organization_id, difficulty)` -> Difficulty-based question generation filtering.
    7. `idx_questions_org_status`: `questions(organization_id, status)` -> Review queue and question bank filtering.
    8. `idx_questions_org_topic`: `questions(organization_id, topic)` -> Topic-based question bank curation.
    9. `idx_quiz_questions_quiz`: `quiz_questions(quiz_id, sort_order)` -> Ordered quiz questions retrieval.
    10. `idx_quizzes_org_status`: `quizzes(organization_id, status)` -> Organization quiz dashboard filtering.
    11. `idx_sessions_active_room_code`: `quiz_sessions(room_code)` WHERE `status IN ('LOBBY', 'ACTIVE')` -> Participant room code join.
    12. `idx_sessions_host`: `quiz_sessions(host_user_id, status)` -> Teacher active sessions management dashboard.
    13. `idx_sessions_organization`: `quiz_sessions(organization_id, status)` -> Tenant session isolation and monitoring.
    14. `idx_snapshots_org`: `published_quiz_snapshots(organization_id)` -> Curriculum snapshot tenant validation.
    15. `idx_user_sessions_user_id`: `user_sessions(user_id)` -> User session lifecycle and revocation.
    16. `idx_users_email`: `users(email)` -> User lookup by email and collision defense.
    17. `uq_session_results_participant`: `session_results(session_id, participant_id)` WHERE `subject_type = 'PARTICIPANT'` -> Invariant: single result per participant per session.
    18. `uq_session_results_group`: `session_results(session_id, session_group_id)` WHERE `subject_type = 'GROUP'` -> Invariant: single result per group per session.
  - **7 Immutability & Tenant Triggers**:
    1. `prevent_published_quiz_delete`: Aborts physical deletion of published or historically snapshotted quizzes.
    2. `prevent_session_result_delete`: Aborts deletion of finalized session results.
    3. `prevent_session_result_update`: Aborts update of finalized session results.
    4. `prevent_snapshot_delete`: Aborts deletion of published quiz snapshots.
    5. `prevent_snapshot_update`: Aborts update of published quiz snapshots.
    6. `trg_enforce_session_snapshot_tenant_insert`: Aborts session creation referencing cross-tenant snapshot.
    7. `trg_prevent_session_tenant_mutation`: Aborts update of session tenant or snapshot binding.
  - **0 Views**: Dynamic parameterized queries only.
  - **Deterministic Ranking**: Finalized podium positions in `session_results` strictly resolved by:
    1. `final_score DESC`
    2. `correct_count DESC`
    3. `final_answer_submitted_at ASC`
    4. stable subject ID ASC (`participantId` or `sessionGroupId`)
  - **Cross-Session Ownership Integrity**: Finalizing results validates that referenced participants and groups belong strictly to the target session. Foreign references fail closed with `SessionAccessDeniedError`.
  - **Historical Preservation**: `session_results.session_id` enforces `ON DELETE RESTRICT` ensuring finalized results survive normal session cleanup.

---

## 3. Real-Time State Machine

Each live quiz room operates under a server-authoritative state machine:

```text
       ┌──────────────┐
       │    LOBBY     │ <---- Room opened, participants join via QR/Code
       └──────┬───────┘
              │ Host initiates start
              ▼
    ┌────────────────────┐
    │  QUESTION_PREVIEW  │ <---- Countdown cue & Question introduction
    └─────────┬──────────┘
              │ Countdown reaches 0
              ▼
    ┌────────────────────┐
    │  QUESTION_ACTIVE   │ <---- Answering active; server timer ticking; answer progress
    └─────────┬──────────┘
              │ Timer expires OR host closes early
              ▼
    ┌────────────────────┐
    │  QUESTION_RESULT   │ <---- Answering locked; correct answer revealed; scripture shown
    └─────────┬──────────┘
              │ Host advances
              ▼
    ┌────────────────────┐
    │    LEADERBOARD     │ <---- Scores and rank standings displayed
    └─────────┬──────────┘
              │ Next question available?
        ┌─────┴────────────────┐
      [YES]                   [NO]
        │                      │
        ▼                      ▼
[QUESTION_PREVIEW]      ┌──────────────┐
                        │ FINAL_PODIUM │ <---- Final 1st, 2nd, 3rd place awards
                        └──────────────┘
```

---

## 4. Server-Authoritative Scoring Model

To ensure fairness, tamper resistance, and timing accuracy:
1. When entering QUESTION_ACTIVE, the server records the start timestamp and determines the expiration timestamp.
2. Mobile clients receive question text and choices, but never the correct answer index.
3. Participant submits answer payload: { session_id, room_id, question_id, chosen_option }.
4. Server validates submission timeliness against server question expiration and confirms the participant has not already answered.
5. Server computes score points based on answer correctness and configured quiz scoring rules.
6. Aggregated scores and leaderboard ranks are computed server-side and broadcast upon state progression.

---

## 5. Security & Boundary Principles

- **Secret Isolation**: AI provider credentials and backend secrets remain strictly on the server.
- **Answer Secrecy**: Correct answers are never sent to participants during the answering window.
- **Participant Simplicity**: Participants join with a room code and nickname; no personal account registration required for casual participation.
- **Quiz Snapshot Integrity**: Live quiz sessions run from immutable frozen snapshots to prevent unexpected behavior during active gameplay.
- **Input Sanitization**: Display names and user-authored content are sanitized against injection and inappropriate language.

---

## 6. Future Platform Capability Boundaries

### 6.1 Transactional Email

Email is a first-class platform capability. Transactional delivery is asynchronous, retryable, idempotent, auditable, and must never block authoritative user, quiz, session, or result transactions. Initial categories include registration, organization invitations when available, quiz participation/completion, result availability, and future resource-download notifications. Provider selection remains deferred.

### 6.2 Product Analytics and Technical Observability

Product analytics is a first-class capability based on server-authoritative business events. Analytics is never an authorization mechanism, cannot establish authoritative quiz outcomes, and must not block core transactions. Events must minimize PII and avoid unnecessary collection of child/student data. Product analytics remains distinct from technical observability and logs.

### 6.3 Advertising and Monetization

Advertising is a future monetization capability, not an MVP dependency. No advertising provider or ad-serving subsystem is required now. Advertising must not participate in authoritative quiz/session state, interrupt synchronized live gameplay, or use unnecessary profiling of children/students. Future options may include suitable non-live placements, sponsorships, and premium/ad-free plans.

### 6.4 Worship and Music Content

Future BAREA capabilities may include song lyrics, licensed sing-along lyric videos, downloadable lyric videos, and stem-based music tracks for church singing without live instruments. Publication/download requires appropriate copyright/licensing rights. Large media assets belong in R2 rather than D1, and private media access must remain server-authorized.

These capabilities are deliberately future-facing and do not expand the current quiz MVP scope.
