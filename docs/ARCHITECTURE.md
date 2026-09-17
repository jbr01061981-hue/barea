# BAREA Conceptual System Architecture

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
  - Development / CI: Native SQLite via `node:sqlite` (pure Promise-based repository contracts).
  - Production Relational Storage: Cloudflare D1 (serverless relational database).
  - Production Real-Time Coordination: Cloudflare Durable Objects (authoritative state machine, timers, live tick loops).
- **Decoupled Architecture Ports**:
  - **Clock Port**: Injectable `Clock` (`nowMs()`, `nowIso()`) decoupling application timing from persistence layer.
  - **Zero Transaction Leakage**: Public repository interfaces contain zero generic `transaction<T>()` callbacks; multi-statement workflows are exposed as domain-specific atomic repository methods (`createPendingReviewBatch`, `approveQuestionBatch`, `publishQuiz`, `finalizeSessionResults`).
- **Relational Schema Freeze**:
  - **17 Tables**: `users`, `federated_identities`, `user_sessions`, `oauth_transactions`, `organization_memberships`, `questions`, `quizzes`, `quiz_questions`, `published_quiz_snapshots`, `quiz_sessions`, `session_participants`, `session_groups`, `session_group_pupils`, `session_invitations`, `session_live_states`, `session_answers`, `session_results`.
  - **16 Explicit Indexes**: 14 regular query-path indexes + 2 partial unique indexes (`uq_session_results_participant` and `uq_session_results_group`). Redundant index definitions are pruned.
  - **7 Immutability & Tenant Triggers**: Snapshot update/delete prevention (`prevent_snapshot_update`, `prevent_snapshot_delete`), published quiz delete prevention (`prevent_published_quiz_delete`), tenant boundary enforcement (`trg_enforce_session_snapshot_tenant_insert`, `trg_prevent_session_tenant_mutation`), and session result immutability (`prevent_session_result_update`, `prevent_session_result_delete`).
  - **0 Views**: Dynamic parameterized queries only.
  - **Deterministic Ranking**: Finalized podium positions in `session_results` strictly resolved by `final_score DESC`, `correct_count DESC`, `final_answer_submitted_at ASC`, and `subject_id ASC`.

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
