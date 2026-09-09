# BAREA Milestone Roadmap

This document outlines the sequential development phases of the **BAREA** platform.

Milestones must be executed in order. No milestone may proceed into application implementation until its prior dependency is completed and verified.

---

## Roadmap Overview

| Milestone ID | Title | Scope Summary | Status |
|---|---|---|---|
| **BAREA-001** | **Foundation** | Documentation, architecture, agent guidelines, ADRs | **COMPLETED** |
| **BAREA-002** | **Question Bank** | Domain models, storage, tagging, difficulty, search/filter | **COMPLETED** |
| **BAREA-002A** | **TypeScript Migration Gate** | Migrate existing BAREA-002 implementation to TypeScript without changing behavior | **COMPLETED** |
| **BAREA-003** | **AI Quiz Generation** | Structured LLM prompt pipeline, parameter inputs, structural validation | **COMPLETED** |
| **BAREA-004** | **Teacher Review/Approval** | Production frontend foundation, staging UI, editing, Scripture review, approval gate | **COMPLETED — MERGED** |
| **BAREA-005** | **Quiz Authoring** | Quiz playlist composition, timer & scoring configurations, publishing | **COMPLETED — MERGED** |
| **BAREA-006** | **Share/Join** | QR generation, room access codes, URL routing, participant onboarding | NOT STARTED |
| **BAREA-007** | **Live Quiz** | Authoritative state machine, timer sync, real-time transport | NOT STARTED |
| **BAREA-008** | **Host/Participant UI** | Dual-interface UX: host control console & responsive mobile participant app | NOT STARTED |
| **BAREA-009** | **Scoring** | Server-side validation, timestamp verification, score algorithm | NOT STARTED |
| **BAREA-010** | **Results/Leaderboard** | Intermediate standings, final podium, celebration animations | NOT STARTED |
| **BAREA-011** | **Presentation** | Dedicated big-screen projector view, high-contrast layouts | NOT STARTED |
| **BAREA-012** | **Church Validation** | Theological accuracy review, inappropriate content filters, fellowship usability | NOT STARTED |
| **BAREA-013** | **Pilot** | End-to-end dry run with live congregation / Sunday school group | NOT STARTED |

---

## Core AI Workflow Lifecycle

The platform follows a strict canonical lifecycle that governs how AI-generated content enters the platform:

```text
AI Generation
-> Structural/Schema Validation
-> Teacher Review & Edit
-> Teacher Approval
-> Question Bank
-> Quiz Authoring
```

- **Structural validation** is strictly an automated schema check for syntax, required fields, and format compliance; it does not certify biblical truth or theological accuracy.
- **Human teacher review** is strictly required to verify scriptural fidelity and age-appropriateness.
- **Milestone dependency**: AI generation (BAREA-003) places drafts into a staging state (PENDING_REVIEW). Generated questions cannot bypass review or directly enter the Question Bank or active quizzes without the teacher review/approval gate (BAREA-004).
- **TypeScript gate**: BAREA-002A must be completed and independently verified before BAREA-003 application implementation begins.

---

## Detailed Milestone Descriptions

### BAREA-001: Foundation
- Establish repository documentation (README.md, AGENTS.md, docs/*).
- Define product requirements, architectural contracts, and ADRs.
- Initialize clean Git workflow without legacy baggage.
- **Status**: COMPLETED.
- **Deliverable**: Architectural blueprint and repository baseline.

### BAREA-002: Question Bank
- Database schema and persistence layer for stored, approved questions.
- Question attributes: stem text, answer options, correct indicator, explanation, scripture reference, topic, difficulty (Easy, Medium, Hard), and language.
- CRUD APIs, search, and filtering mechanisms.
- Supports manual question authoring and serves as the destination for approved questions.
- **Status**: COMPLETED.
- **Deliverable**: Question persistence layer, schema validation, and Question Bank domain service.

### BAREA-002A: TypeScript Migration Gate
- Establish TypeScript as the BAREA application language before further application milestones.
- Migrate the existing BAREA-002 `.js` source and tests to `.ts` while preserving externally observable behavior and the approved-content lifecycle invariants.
- Add the minimum TypeScript compiler/type-definition tooling needed for a clean, reproducible build.
- Keep the existing CommonJS runtime shape and `node:sqlite` implementation unless a concrete compatibility issue requires a documented decision.
- Add/retain explicit type contracts for the question domain, repository, service, and public exports.
- Ensure compiled output and tests are reproducible and the full existing test suite remains green.
- **Status**: COMPLETED.
- **Deliverable**: TypeScript-based equivalent of the approved BAREA-002 implementation, with no BAREA-003 functionality.

### BAREA-003: AI Quiz Generation
- Core MVP AI generation pipeline with structured output enforcement.
- Teacher prompt parameters: topic/passage, difficulty (Easy, Medium, Hard), question count, question type, and language.
- Automatic structural/schema validation (format, required fields, data types).
- Places all successfully formatted drafts into a staged PENDING_REVIEW state.
- **Mandatory constraint**: AI questions cannot enter the active Question Bank or be published to live quizzes without passing through BAREA-004.
- **Status**: COMPLETED.
- **Deliverable**: Server-authoritative AI quiz generation pipeline with port/adapter architecture (`AIProvider`, `FakeAIProvider`, `GeminiAIProvider`), JSON Schema structural output validation, Question domain validation, PENDING_REVIEW Question Bank staging, and atomic SQLite transaction boundary.

### BAREA-004: Teacher Review/Approval
- Establish the production frontend foundation through the actual Teacher Review experience rather than a throwaway frontend scaffold.
- Use Next.js 16, React 19, TypeScript, Tailwind CSS 4, Next.js App Router, React Aria Components, and BAREA-owned design tokens/visual language.
- Provide an organization-scoped PENDING_REVIEW queue and focused review workspace.
- Allow teachers to inspect Scripture/reference/explanation and edit question content, answers, correct answers, difficulty, and other required metadata.
- Require explicit approval separate from save/edit operations.
- Support individual approval and transactional batch approval.
- Support discard/archive and regeneration without silently overwriting the original question.
- Preserve the human theological/scriptural review gate; no automated theological certification is introduced.
- **Status**: COMPLETED — MERGED into `main` in merge commit `1faff33235378c6061a902a89454e5d62b097b0b`.
- **Deliverable**: Production-ready Teacher Review/Approval workbench and minimal reusable frontend foundation, including runtime payload allowlisting and adversarial authorization tests.

### BAREA-005: Quiz Authoring
- Compiling approved questions from the Question Bank into structured quizzes.
- Configurable settings: per-question countdowns, scoring styles, question ordering, and option shuffling.
- Publishing workflow that snapshots quizzes for active sessions.
- **Status**: COMPLETED — MERGED into `main` in merge commit `94af326e0fed75f5196df549ad370fc6fd7ddc36`.
- **Deliverable**: Complete Quiz Authoring domain, SQLite persistence engine with immutable snapshot triggers and `BEGIN IMMEDIATE` transaction locking, QuizService orchestration, server actions with runtime payload allowlisting, Teacher Authoring UI (`/teacher/quizzes`, `/teacher/quizzes/[id]`), 40 automated tests (`ADV-QZ-01` through `ADV-QZ-30` plus boundary matrix; 122 total test suite), 0 `any` types, and independent multi-agent release verification pass.

### BAREA-006: Share/Join
- Session creation with room access codes.
- Dynamic QR code generation for projector and mobile devices.
- Low-friction mobile landing flow: nickname entry, duplicate name handling, session resumption.
- **Status**: NOT STARTED.

### BAREA-007: Live Quiz
- Server-authoritative state machine (LOBBY, PREVIEW, ACTIVE, RESULT, LEADERBOARD, PODIUM).
- Real-time transport implementation.
- Synchronized question timers and event broadcasts.
- **Status**: NOT STARTED.

### BAREA-008: Host/Participant UI
- Host console: start, pause, advance, and player roster view.
- Participant mobile web UI: high-contrast, large touch targets, optimistic submission feedback.
- **Status**: NOT STARTED.

### BAREA-009: Scoring
- Server-side answer validation and anti-tampering logic.
- Timely scoring calculation based on server expiration rules.
- Participant score accumulation and tracking.
- **Status**: NOT STARTED.

### BAREA-010: Results/Leaderboard
- Live calculation of standings.
- Question-by-question answer distribution overview.
- Final celebratory podium (1st, 2nd, 3rd place).
- **Status**: NOT STARTED.

### BAREA-011: Presentation
- Dedicated auditorium projector view designed for big screens.
- Distance-readable typography and high-contrast styling.
- Responsive layout adapting to standard wide displays.
- **Status**: NOT STARTED.

### BAREA-012: Church Validation
- Community validation for theological consistency across Bible translations.
- Inappropriate name filtering tailored for church settings.
- Accessibility review across diverse age groups.
- **Status**: NOT STARTED.

### BAREA-013: Pilot
- Full end-to-end dry run with a live church group or Sunday school class.
- Performance and connection testing under typical church Wi-Fi conditions.
- User feedback collection and prioritization for production readiness.
- **Status**: NOT STARTED.
