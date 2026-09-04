# BAREA Architecture Decision Records (ADR)

This document tracks architectural principles, established decisions, and open technical items for the BAREA platform.

---

## Record Index

- [ADR-001: Strict Human-in-the-Loop Review for AI Content](#adr-001-strict-human-in-the-loop-review-for-ai-content)
- [ADR-002: Question-Level Difficulty Granularity](#adr-002-question-level-difficulty-granularity)
- [ADR-003: Participant Access and Authentication Direction](#adr-003-participant-access-and-authentication-direction)
- [ADR-004: Server-Authoritative State and Scoring Engine](#adr-004-server-authoritative-state-and-scoring-engine)
- [ADR-005: Separate Viewport Presentation Roles](#adr-005-separate-viewport-presentation-roles)
- [ADR-006: Question Bank Durable Storage & Organizational Isolation](#adr-006-question-bank-durable-storage--organizational-isolation)
- [Open Technical Decisions](#open-technical-decisions)

---

## ADR-001: Strict Human-in-the-Loop Review for AI Content

### Status
**ACCEPTED**

### Context
LLMs can generate plausible-sounding statements that may contain subtle theological inaccuracies, incorrect scriptural references, or age-inappropriate phrasing. In church education, scriptural fidelity and theological trust are essential.

### Decision
All AI-generated questions must be held in a pending review staging state. Automated system checks perform structural validation on the schema, but cannot certify biblical truth. Questions cannot be published live or added to an active quiz until explicitly reviewed, verified, edited as needed, and approved by a teacher.

### Consequences
- **Positive**: Protects theological fidelity; ensures trust with pastors, teachers, and parents.
- **Negative**: Requires human review before questions can be used; requires an efficient teacher review interface.

---

## ADR-002: Question-Level Difficulty Granularity

### Status
**ACCEPTED**

### Context
Educational quizzes often ramp up in difficulty or combine questions of varying complexity. Applying difficulty only at the quiz level limits flexibility and prevents question reuse across different age groups.

### Decision
Difficulty (Easy, Medium, Hard) is an attribute of the individual **question**, not only the quiz. A quiz derives its overall challenge from its collection of questions.

### Consequences
- **Positive**: Enables granular filtering in the Question Bank; allows teachers to assemble varied and progressive quizzes.
- **Negative**: Requires difficulty metadata for every question created manually or via AI.

---

## ADR-003: Participant Access and Authentication Direction

### Status
**PROPOSED / MVP DIRECTION**

### Context
Church events include visitors, youth, and elderly attendees using diverse devices. Requiring account creation or app installation creates significant entry friction before a live game. However, future features (such as multi-week leaderboards or student history) might benefit from optional participant profiles.

### Decision
For MVP live quiz participation, adopt an unauthenticated, frictionless joining flow via QR code, direct link, or room access code with a display name and ephemeral session token. Long-term participant accounts remain an open decision for post-MVP evaluation rather than an irreversible architecture lock.

### Consequences
- **Positive**: Minimizes barrier to entry during church events.
- **Negative**: No cross-session historical tracking for participants in initial release.

---

## ADR-004: Server-Authoritative State and Scoring Engine

### Status
**ACCEPTED**

### Context
Client-side timers or client-side score calculations are vulnerable to clock drift, latency differences, and tampering. Additionally, sending correct answers to clients before answering closes creates cheating vulnerabilities.

### Decision
The server acts as the authoritative source of truth for the game state machine, countdown timers, answer acceptance, and score calculations. Correct answers are never sent to participants during an active question window.

### Consequences
- **Positive**: Fair, tamper-proof gameplay; synchronized timers and reliable leaderboards across all displays.
- **Negative**: Requires reliable bidirectional communication and handling of client reconnections.

---

## ADR-005: Separate Viewport Presentation Roles

### Status
**ACCEPTED**

### Context
A live church quiz involves three distinct viewing contexts:
1. The Teacher needs management and pacing controls.
2. The Audience needs high-contrast presentation visible from distance.
3. The Participant needs clear, responsive touch controls on a mobile device.

### Decision
Establish three dedicated presentation experiences:
- **Host View**: Session orchestration and participant roster oversight.
- **Participant View**: Mobile-optimized answering experience.
- **Projector View**: Big-screen display for group engagement.

### Consequences
- **Positive**: Tailored ergonomics and readability for each participant role.
- **Negative**: Requires maintaining synchronized state across three distinct client presentation surfaces.

---

## ADR-006: Question Bank Durable Storage & Organizational Isolation

### Status
**ACCEPTED (BAREA-002)**

### Context
BAREA-002 requires durable persistence for the Question Bank with strict organizational isolation so that questions from one church or context do not leak into another. To keep the project lightweight, dependency-free, and cross-platform without imposing complex external database server setups during early milestones, we evaluated built-in persistence options.

### Decision
1. Implement durable storage using Node.js built-in synchronous SQLite (`node:sqlite` via `DatabaseSync`), requiring zero external dependencies or native compilation steps.
2. Establish strict tenant/organizational isolation using mandatory `organizationId` on all domain operations, queries, and composite indices (`idx_questions_org`, `idx_questions_org_status`, `idx_questions_org_topic`, `idx_questions_org_diff`).
3. Domain validation and repository contracts encapsulate SQL details, allowing the storage engine to be substituted or evolved into client-server databases in future scaling phases without domain layer breakage.

### Consequences
- **Positive**: Zero external dependencies; instant local testability in memory (`:memory:`) or file; ACID transactions; strict organizational boundary enforcement.
- **Negative**: SQLite is file-based/single-instance; migration to client-server RDBMS (e.g., PostgreSQL) will be needed if distributed multi-region server clusters are introduced.

---

## Open Technical Decisions

The following technical selections are intentionally deferred to future milestones:

1. **Application Runtime & Framework**: Choice of backend and frontend frameworks.
2. **Real-Time Communication Transport**: Specific protocol implementation for low-latency state synchronization.
3. **Database & Data Layer**: Relational database engine, schema management, and live session state storage for distributed multi-server environments.
4. **AI LLM Gateway**: Specific model provider and API integration for question generation.
