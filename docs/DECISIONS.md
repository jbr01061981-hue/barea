# BAREA Architecture Decision Records (ADR)

This document tracks key architectural decisions, context, and rationales for the BAREA platform.

---

## Record Index

- [ADR-001: Strict Human-in-the-Loop Review for AI Content](#adr-001-strict-human-in-the-loop-review-for-ai-content)
- [ADR-002: Question-Level Difficulty Granularity](#adr-002-question-level-difficulty-granularity)
- [ADR-003: Zero-Friction Mobile Participation Without Authentication](#adr-003-zero-friction-mobile-participation-without-authentication)
- [ADR-004: Server-Authoritative State and Scoring Engine](#adr-004-server-authoritative-state-and-scoring-engine)
- [ADR-005: Separate Viewport Presentation Roles](#adr-005-separate-viewport-presentation-roles)
- [Unresolved Architectural Decisions](#unresolved-architectural-decisions)

---

## ADR-001: Strict Human-in-the-Loop Review for AI Content

### Status
**ACCEPTED**

### Context
LLMs can generate plausible-sounding biblical statements that may contain subtle theological misinterpretations, incorrect chapter/verse references, or denominationally sensitive phrasing. In a church education context, scriptural accuracy and theological trust are paramount.

### Decision
All AI-generated questions must be held in an immutable PENDING_REVIEW staging state. Questions cannot be assigned to an active quiz or published live until explicitly reviewed, verified, potentially edited, and approved by an authorized teacher or host.

### Consequences
- **Positive**: Guarantees theological fidelity; builds deep trust with church leadership and teachers.
- **Negative**: Adds a manual review step between generation and gameplay; requires an intuitive, rapid-editing UI to minimize teacher effort.

---

## ADR-002: Question-Level Difficulty Granularity

### Status
**ACCEPTED**

### Context
Quizzes in educational settings typically ramp up in difficulty or include a balanced mix of questions (e.g., 5 easy, 3 medium, 2 hard). If difficulty is applied only to the quiz as a whole, individual question reusability across varied age groups is compromised.

### Decision
Assign difficulty attributes directly to each individual **question** (Easy, Medium, Hard). A quiz inherits its aggregate difficulty profile from its constituent questions.

### Consequences
- **Positive**: Enables rich filtering in the Question Bank; allows teachers to assemble dynamically paced quizzes with progressive difficulty.
- **Negative**: Requires AI generation and authoring workflows to specify and tag difficulty per item.

---

## ADR-003: Zero-Friction Mobile Participation Without Authentication

### Status
**ACCEPTED**

### Context
Church attendees, visitors, and youth have diverse devices, varying technical familiarity, and limited patience for account sign-ups or app store downloads before a game starts.

### Decision
Participants join via QR code, direct URL, or a 6-character room code. They provide only a display nickname. Ephemeral session tokens stored in browser memory/storage manage reconnects and identity for the duration of the room session.

### Consequences
- **Positive**: Maximizes participant engagement and allows joining within seconds.
- **Negative**: No long-term cross-session participant profiles in MVP; requires robust client-side session reconnection logic in case of network drops.

---

## ADR-004: Server-Authoritative State and Scoring Engine

### Status
**ACCEPTED**

### Context
Client-side timers or client-calculated scores are vulnerable to device clock drift, network latency discrepancies, and manipulation. Furthermore, broadcasting the correct answer along with the question creates cheat vulnerabilities via client inspect tools.

### Decision
The backend server acts as the authoritative source of truth for the game state machine, countdown timers, answer validation, and score calculation. Correct answers are never sent to participant devices during an active question window.

### Consequences
- **Positive**: Fair, tamper-proof gameplay; synchronized countdown across all screens; reliable leaderboards.
- **Negative**: Requires real-time bi-directional transport (WebSockets / real-time channels) and robust handling of network jitter.

---

## ADR-005: Separate Viewport Presentation Roles

### Status
**ACCEPTED**

### Context
A church quiz has three fundamentally different viewing contexts:
1. The Teacher running the room needs controls (pause, next, participant list).
2. The Audience looking at the sanctuary screen needs large fonts, animations, and clean presentation.
3. The Participant looking at a phone needs immediate, responsive touch targets.

### Decision
Design three distinct, role-specialized views:
- **Host Console**
- **Mobile Participant View**
- **Projector / Big Screen View**

### Consequences
- **Positive**: Optimized ergonomics for every participant type without visual compromise.
- **Negative**: Requires maintaining three synchronized view presentations driven by the same real-time event stream.

---

## Unresolved Architectural Decisions

The following technical decisions are intentionally deferred to subsequent milestones (BAREA-002 onwards) and will be documented in future ADRs:

1. **Tech Stack Selection**:
   - Primary language/framework for application runtime (e.g., TypeScript with Next.js / Node.js vs. alternative backend runtimes).
   - Real-time transport implementation (e.g., native WebSockets with Socket.IO, Fastify WS, or a managed real-time service).
2. **Database Engine & ORM**:
   - Choice of relational database (e.g., PostgreSQL with Prisma / Drizzle) for Question Bank and Quiz snapshots.
   - Cache layer for ephemeral room state (e.g., Redis or in-memory server state).
3. **AI LLM Gateway Provider**:
   - Provider selection (e.g., Gemini API, Anthropic, or OpenAI) and specific model choice for structured JSON generation.
4. **Church Data Isolation**:
   - Single-tenant vs. multi-tenant schema partitioning for church organizations and private question banks.
