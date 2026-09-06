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
- [ADR-007: Approved Question Immutability & Content Modification Invariants](#adr-007-approved-question-immutability--content-modification-invariants)
- [ADR-008: TypeScript as BAREA Application Language](#adr-008-typescript-as-barea-application-language)
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

## ADR-007: Approved Question Immutability & Content Modification Invariants

### Status
**ACCEPTED (BAREA-002)**

### Context
In BAREA, approved questions represent vetted, theologically accurate, and age-appropriate content ready for live quiz sessions. If an APPROVED question's stem, options, correct answer indices, scripture references, explanation, difficulty, or topic could be silently updated while retaining APPROVED status, modified and unvetted content would leak into live quizzes, defeating the teacher-approval gate.

### Decision
1. **Content Modification Demotion**: Modifying any content attribute (stem, options, correct indices, scripture reference, explanation, topic, difficulty, type, language) on an `APPROVED` question automatically resets the question status to `PENDING_REVIEW` unless an explicit valid status transition (such as `ARCHIVED`) is specified.
2. **Review Gate Preservation**: Content-modified questions cannot silently remain `APPROVED`. They re-enter the review queue and must be re-verified and re-approved by a human teacher before they can be retrieved as approved Question Bank content or added to active quizzes.
3. **Soft Deletion**: Questions are soft-deleted by transitioning to `ARCHIVED`. Archived questions can be restored to `DRAFT` for re-editing, but cannot jump directly to `APPROVED`.
4. **No Direct APPROVED Creation**: Questions can never be created directly with `APPROVED` status. All newly created questions default to `DRAFT` and any attempt to supply `status: APPROVED` during creation is rejected by domain validation. `APPROVED` status can only be achieved by progressing through the legitimate review lifecycle (`DRAFT -> PENDING_REVIEW -> APPROVED`).

### Consequences
- **Positive**: Guarantees theological fidelity; prevents unreviewed edits from appearing in live quizzes; enforces consistent lifecycle state transitions.
- **Negative**: Teachers editing an existing approved question must re-approve it before using it in quizzes.

---

## ADR-008: TypeScript as BAREA Application Language

### Status
**ACCEPTED (PRE-BAREA-003)**

### Context
BAREA-002 established the first executable domain and persistence layer in JavaScript. The upcoming BAREA milestones will introduce AI contracts, service boundaries, HTTP APIs, real-time state, shared client/server models, and multiple presentation surfaces. The project also requires maintainable public contracts and safe refactoring across work performed by multiple automated agents.

### Decision
1. **TypeScript is the standard application language for BAREA going forward.** New BAREA application code must use `.ts`/`.tsx` as appropriate rather than `.js`.
2. Migrate the existing BAREA-002 JavaScript implementation to TypeScript before BAREA-003 begins, preserving behavior and public contracts.
3. Keep the migration deliberately small: use TypeScript for compile-time type safety and explicit domain/repository/service contracts, while retaining the existing CommonJS runtime shape and Node.js built-in SQLite implementation unless a compatibility issue requires a documented change.
4. TypeScript compiler output is the runtime artifact; source remains under `src/` and compiled output under `dist/`. Tests must continue to run in CI/local development against the compiled output or an explicitly justified TypeScript test runner.
5. Avoid framework selection, frontend scaffolding, ORM adoption, database replacement, real-time transport selection, or AI provider selection as part of this decision.

### Consequences
- **Positive**: Stronger domain contracts, earlier error detection, safer refactoring, clearer interfaces for future agents, and better maintainability as BAREA expands.
- **Negative**: Adds a compile step and development dependencies for TypeScript and Node.js type definitions; the existing BAREA-002 source must be migrated carefully without changing behavior.

---

## ADR-009: AI LLM Gateway Provider Port & Architecture

### Status
**ACCEPTED (BAREA-003)**

### Context
BAREA-003 introduces the server-side AI quiz generation pipeline. The project requires high-quality, structured biblical questions generated on demand, while avoiding tight coupling to any single proprietary LLM provider SDK or cloud API. Automated testing must be deterministic and must not depend on live credentials or external network access.

### Decision
1. **Port/Adapter Architecture**: The AI generation pipeline connects to LLMs through a strongly-typed port interface (`AIProvider`), which defines `generateRaw(request: GenerationRequest): Promise<unknown>`.
2. **Provider Implementations**:
   - `FakeAIProvider`: In-memory deterministic mock provider for automated unit, validation, and failure-mode testing without network or credentials.
   - `GeminiAIProvider`: Production adapter for Google Gemini API (`gemini-1.5-flash` by default) using native fetch and standard HTTP endpoints without heavy third-party SDK dependencies.
3. **Configuration & Credentials**:
   - Provider credentials and models are purely configuration-driven via `GeminiProviderConfig` or environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`).
   - Secrets are never hard-coded or logged.
4. **Structured Output & Two-Stage Validation**:
   - Provider outputs are strictly validated in two stages: first via JSON schema / structural validation (`validateStructuralOutput`), and second through Question domain validation (`validateQuestionPayload`).
   - Automated structural validation only certifies schema format; it does NOT certify biblical truth or theological accuracy.
5. **Lifecycle Gate**:
   - Generated questions are always persisted as `PENDING_REVIEW`, preserving the human teacher review and approval gate (BAREA-004). AI questions can never be created directly as `APPROVED`.
6. **Future Provider Substitution**:
   - Alternative providers (e.g. OpenAI, Anthropic, local open-weights models) can be added as `AIProvider` implementations without altering the Question Bank domain, service, or validation layers.

### Consequences
- **Positive**: Complete provider decoupling, test suite speed and determinism with zero network dependencies, strict lifecycle safety, and clean credential isolation.
- **Negative**: Adds provider adapter interface maintenance and requires mapping model outputs to the common BAREA schema.

---

## Open Technical Decisions

The following technical selections remain intentionally deferred:

1. **Application Framework**: Specific backend/frontend framework(s) and application composition.
2. **Real-Time Communication Transport**: Specific protocol/library implementation.
3. **Database & Data Layer for Distributed Environments**: Relational database engine, schema management, and live session state storage for multi-server deployment.
