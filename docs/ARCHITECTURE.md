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

### 2.2 Identity, Authorization & Workspace Model
BAREA separates **account identity**, **capability/entitlement**, **workspace membership**, and **quiz participation**. A BAREA account is not inherently a teacher account and does not require organization membership merely to exist or participate individually.

#### Canonical Account Identity
- Every authenticated person has one canonical BAREA user identity.
- Email/password and federated identities authenticate the BAREA user; provider stable subjects are used as federated identity anchors.
- Display name is presentation data and is never an authorization credential.
- A user may authenticate and participate individually without belonging to a church or organization workspace.

#### Teacher / Host Capability
- Teacher/Host is an **authorized capability**, not the default identity of every BAREA user.
- A user becomes eligible for teacher/host functionality only when the applicable BAREA qualification, entitlement, payment, approval, or other product rule grants that capability.
- The exact commercial/eligibility mechanism is a product decision separate from the authentication system.
- Authorization checks must derive the capability from trusted server-side state; a client-selected role, route, organization ID, or UI state cannot grant teacher authority.

#### Workspace / Tenant Model
- BAREA supports both **organization workspaces** and **personal workspaces**.
- A teacher operating in an organization workspace must have an authoritative membership/role granting access to that workspace.
- A teacher-capable user may also create and manage quizzes in a personal workspace without requiring organization membership.
- Personal workspaces use an isolated deterministic tenant identity derived server-side from the authenticated user (for example, `usr_ten_<user_id>`), compatible with the existing tenant/`organization_id` persistence model.
- Every quiz, published snapshot, and derived live session belongs to exactly one authoritative tenant/workspace identity.
- Cross-tenant access fails closed regardless of whether the tenant is personal or organizational.

#### Participation Modes
BAREA distinguishes how a quiz is played from who is admitted:

1. **Teacher-Controlled Group Mode** (`TEACHER_GROUP`):
   - A qualified/authorized teacher or host operates the quiz.
   - Pupils do not need BAREA accounts, OAuth/social login, or individual devices.
   - Groups and pupil membership are controlled by the authorized host boundary.
2. **Authenticated Individual Mode** (`INDIVIDUAL_AUTHENTICATED`):
   - Each participant authenticates as a BAREA user.
   - The server binds the participant to the authenticated BAREA identity, not a nickname or client-supplied user identifier.

Admission policy (`TEACHER_ASSIGNED`, `OPEN`, or `RESTRICTED`) is a separate authorization decision and must not be conflated with participation mode.

### 2.3 Application & State Management Layer
- **Core Application Service**:
  - Handles authentication, capability/authorization checks, question curation, AI generation requests, workspace/tenant ownership, and quiz configuration.
- **Authoritative Live Quiz Engine**:
  - Implements a deterministic finite state machine (FSM) governing game progression.
  - Enforces synchronized timers and coordinates real-time event broadcasting.
  - Protects answer secrets: correct choices are withheld from participants until the answer reveal state.

### 2.4 AI Generation & Content Review Pipeline
- Generates structured draft questions based on teacher-selected topics, scriptures, question types, and difficulty levels.
- Executes structural validation to ensure response integrity before placing items into pending review.
- Distinguishes structural system validation from human theological review: content is not approved until a teacher reviews and confirms biblical faithfulness.

### 2.5 Data Persistence & Session State
- Persistent storage for user accounts, federated identities, sessions, workspaces/tenants, question bank items, quizzes, and session history.
- Live session state store managing active room memberships, connection mappings, and live timer ticks.
- Tenant/workspace identity is server-authoritative and must be derived from authenticated ownership/membership state rather than request-body values.
- Specific database engines, ORMs, and caching technologies remain open decisions deferred to future milestones.

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

- **Identity Binding**: Individual authenticated participation is bound to the server-resolved BAREA user and federated provider subject where applicable; display names are never identity or authorization credentials.
- **Capability Authorization**: Authentication proves who the user is; it does not by itself grant teacher/host authority. Teacher capability and workspace membership/ownership are separate server-authoritative checks.
- **Tenant Isolation**: Personal and organization workspaces use the same fail-closed tenant isolation guarantees. Client-supplied tenant, organization, creator, role, group, or participant identifiers cannot establish authorization.
- **Secret Isolation**: AI provider credentials and backend secrets remain strictly on the server.
- **Answer Secrecy**: Correct answers are never sent to participants during the answering window.
- **Teacher-Controlled Groups**: Child/pupil participation may occur without child accounts, but group membership and teacher-entered group answers are controlled exclusively through the authorized host boundary.
- **Admission Separation**: Participation mode and admission policy are independent. QR codes, links, room codes, and future invite codes are entry mechanisms, not authorization grants.
- **Quiz Snapshot Integrity**: Live quiz sessions run from immutable frozen snapshots to prevent unexpected behavior during active gameplay.
- **Input Sanitization**: Display names and user-authored content are sanitized against injection and inappropriate language.
