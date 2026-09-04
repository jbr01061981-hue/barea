# BAREA System Architecture

## 1. High-Level System Architecture

BAREA follows a modern, decoupled web architecture optimized for real-time synchronization, low-latency client updates, and strict server-authoritative state management.

`	ext
                               ┌───────────────────────────┐
                               │     Teacher / Host UI     │ (Desktop / Tablet Web)
                               └─────────────┬─────────────┘
                                             │ HTTP / WS
                                             ▼
┌───────────────────────────┐  HTTP / WS   ┌───────────────────────────┐   WS / HTTP    ┌───────────────────────────┐
│ Mobile Participant Client ├─────────────►│     BAREA Core Server     │◄───────────────┤  Projector / Screen View  │
│      (Smartphone Web)     │              │ (API & Live State Machine)│                │     (1080p / 4K Web)      │
└───────────────────────────┘              └─────────────┬─────────────┘                └───────────────────────────┘
                                                         │
                                    ┌────────────────────┼────────────────────┐
                                    │                    │                    │
                                    ▼                    ▼                    ▼
                           ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                           │   AI Pipeline   │  │ Persistent DB   │  │ Live Cache & Pub│
                           │(LLM + Validation│  │ (Question Bank, │  │ (Room States,   │
                           │    Gateways)    │  │  Quizzes, Users)│  │  Timers, Scores)│
                           └─────────────────┘  └─────────────────┘  └─────────────────┘
`

---

## 2. Architecture Layers

### 2.1 Presentation Layer (Multi-Client Interfaces)
The client layer provides three distinct surfaces served from a unified or shared frontend codebase:
1. **Teacher / Host Console**:
   - Question bank curation, AI generation prompt console, quiz builder.
   - Live session control room (Next, Pause, Reveal, Score Adjustment).
2. **Mobile Participant App**:
   - Lightweight, mobile-first responsive web app (PWA-ready).
   - Minimalist answer selection interface (color-coded large tap blocks).
   - Instant optimistic feedback and sync-resumed state.
3. **Projector / Auditorium Display**:
   - Ultra-clean presentation view with auto-scaling fonts for long-distance viewing.
   - Animations for countdown timers, live response counts, and celebratory podiums.

### 2.2 Application & Real-Time Engine Layer
- **REST / tRPC / GraphQL API**:
  - Handles authentication, question CRUD, AI generation jobs, and quiz authoring.
- **Authoritative Live Quiz Engine**:
  - Implements a deterministic finite state machine (FSM) for quiz sessions.
  - Manages room creation, participant socket bindings, timer ticks, and event broadcasts.
  - Controls information flow: answers are stored securely and never leaked before expiry.

### 2.3 AI Generation & Review Pipeline
- Secure LLM gateway with structured outputs (JSON schema enforcement).
- Generates questions with scripture references, multiple choices, and explanations.
- Places results into a staging buffer (PENDING_REVIEW) until the teacher approves.

### 2.4 Data & Persistence Layer
- Relational database storing:
  - Users / Teachers / Organizations.
  - Question Bank (tagged by scripture, topic, difficulty, language).
  - Quizzes and Quiz Question snapshots.
  - Historical Sessions and aggregate analytics.
- Real-time in-memory data store for live room state, ephemeral scores, and socket connection tracking.

---

## 3. Real-Time State Machine

Each live quiz room operates under a server-authoritative state machine:

`	ext
       ┌──────────────┐
       │    LOBBY     │ ◄──── Room opened, participants join via QR/PIN
       └──────┬───────┘
              │ Host initiates start
              ▼
    ┌────────────────────┐
    │  QUESTION_PREVIEW  │ ◄──── 3-2-1 Countdown & Question title display
    └─────────┬──────────┘
              │ Timer ticks to 0
              ▼
    ┌────────────────────┐
    │  QUESTION_ACTIVE   │ ◄──── Answers open; countdown active; live answer count
    └─────────┬──────────┘
              │ Timer ends OR host triggers early close
              ▼
    ┌────────────────────┐
    │  QUESTION_RESULT   │ ◄──── Answers locked; correct option revealed; scripture shown
    └─────────┬──────────┘
              │ Host advances
              ▼
    ┌────────────────────┐
    │    LEADERBOARD     │ ◄──── Top scores and rank deltas displayed
    └─────────┬──────────┘
              │ Next question available?
        ┌─────┴────────────────┐
     [YES]                    [NO]
        │                      │
        ▼                      ▼
[QUESTION_PREVIEW]      ┌──────────────┐
                        │ FINAL_PODIUM │ ◄──── 1st, 2nd, 3rd place awards
                        └──────────────┘
`

---

## 4. Server-Authoritative Scoring Model

To prevent cheating, replay attacks, and clock drift skew:
1. When entering QUESTION_ACTIVE, the server records 	_start and calculates 	_expiry = t_start + question_duration.
2. Mobile clients receive the question text, option choices, and duration, but **never** the correct answer index.
3. When a participant taps an option, client sends { session_id, room_id, question_id, chosen_index, client_timestamp }.
4. The server validates:
   - Does 	_server <= t_expiry + grace_period (e.g., 500ms network buffer)?
   - Has this participant already submitted for this question?
5. The server calculates points:
   \text{Points} = \begin{cases} 0 & \text{if incorrect or late} \\ \text{BasePoints} + \text{SpeedBonus}(t_{\text{server}} - t_{\text{start}}) & \text{if correct} \end{cases}
6. Updated scores and leaderboards are calculated server-side and broadcasted only upon state transitions.

---

## 5. Security & Isolation Boundaries

- **Secret Isolation**: LLM API keys and database credentials reside strictly on the server; zero exposure to client runtimes.
- **Participant Privacy**: Mobile participants do not need email, phone numbers, or passwords. Data is scoped only to display nicknames and temporary session tokens.
- **Content Tampering Prevention**: Live quiz sessions run from immutable frozen snapshots of quizzes, insulating active games from mid-session edits.
- **Input Sanitization**: Nicknames and teacher inputs pass through sanitizers to prevent XSS and inappropriate display on church screens.
