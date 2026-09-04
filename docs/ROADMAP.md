# BAREA Milestone Roadmap

This document outlines the sequential development phases of the **BAREA** platform.

Milestones must be executed in order. No milestone may proceed into application implementation until its prior dependency is completed and verified.

---

## Roadmap Overview

| Milestone ID | Title | Scope Summary | Status |
|---|---|---|---|
| **BAREA-001** | **Foundation** | Documentation, architecture, agent guidelines, ADRs | **IN PROGRESS** |
| **BAREA-002** | **Question Bank** | Domain models, storage, tagging, difficulty, search/filter | NOT STARTED |
| **BAREA-003** | **AI Quiz Generation** | Structured LLM prompt pipeline, parameter inputs, validation schema | NOT STARTED |
| **BAREA-004** | **Teacher Review/Approval**| Staging UI, editing, scripture check, approval gate | NOT STARTED |
| **BAREA-005** | **Quiz Authoring** | Quiz playlist composition, timer & scoring configurations, publishing | NOT STARTED |
| **BAREA-006** | **Share/Join** | QR generation, room access codes, URL routing, participant onboarding | NOT STARTED |
| **BAREA-007** | **Live Quiz** | Authoritative state machine, timer sync, real-time socket transport | NOT STARTED |
| **BAREA-008** | **Host/Participant UI** | Dual-interface UX: host control console & responsive mobile participant app | NOT STARTED |
| **BAREA-009** | **Scoring** | Server-side validation, timestamp verification, score algorithm | NOT STARTED |
| **BAREA-010** | **Results/Leaderboard** | Intermediate standings, final podium, celebration animations | NOT STARTED |
| **BAREA-011** | **Presentation** | Dedicated big-screen projector view, high-contrast layouts | NOT STARTED |
| **BAREA-012** | **Church Validation** | Theological accuracy checks, profanity filters, fellowship usability | NOT STARTED |
| **BAREA-013** | **Pilot** | End-to-end dry run with live congregation / Sunday school group | NOT STARTED |

---

## Detailed Milestone Descriptions

### BAREA-001: Foundation (Current)
- Establish repository documentation (README.md, AGENTS.md, docs/*).
- Define product requirements, architectural contracts, and ADRs.
- Initialize clean Git workflow without legacy baggage.
- **Deliverable**: Architectural blueprint and repository baseline.

### BAREA-002: Question Bank
- Database schema and persistence layer for questions.
- Question attributes: stem, options, correct indices, explanation, scripture reference, topic, difficulty (Easy, Medium, Hard), and language.
- CRUD APIs and filtering mechanisms.
- **Deliverable**: Robust, tested question store.

### BAREA-003: AI Quiz Generation
- Integration with LLM providers with structured output enforcement (JSON schema).
- Support teacher prompts: Topic, scripture passage, difficulty distribution, question types, language.
- Automatic verification of schema structure before teacher handoff.
- Staging questions in PENDING_REVIEW state.
- **Deliverable**: Automated question generation pipeline.

### BAREA-004: Teacher Review/Approval
- Interface for teachers to review generated questions before they become part of the library.
- Inline editing of stems, choices, and biblical explanations.
- Single-question and batch approval to APPROVED status.
- Regeneration triggers for unsatisfactory questions.
- **Deliverable**: Human-in-the-loop review workbench.

### BAREA-005: Quiz Authoring
- Compiling approved questions into structured quizzes.
- Configurable settings: per-question countdowns, scoring styles, question ordering.
- Publishing workflow that snapshots quizzes for active sessions.
- **Deliverable**: Complete quiz creation and publishing engine.

### BAREA-006: Share/Join
- Session creation with 6-character room codes.
- Dynamic QR code generation for projector and printout.
- Mobile landing flow: nickname entry, duplicate name handling, session resumption.
- **Deliverable**: Frictionless onboarding for church members.

### BAREA-007: Live Quiz
- Server-authoritative state machine (LOBBY, PREVIEW, ACTIVE, RESULT, LEADERBOARD, PODIUM).
- Real-time transport implementation (WebSockets / real-time channels).
- Synchronized question timers and event broadcasts.
- **Deliverable**: Low-latency live session orchestrator.

### BAREA-008: Host/Participant UI
- Host console: start, pause, advance, and player roster view.
- Participant mobile web UI: high-contrast, large touch targets, optimistic submission feedback.
- **Deliverable**: Fully functional host and player frontends.

### BAREA-009: Scoring
- Server-side answer validation and anti-tampering logic.
- Time-based decay scoring calculation with latency grace buffer.
- Participant score accumulation and tracking.
- **Deliverable**: Tamper-proof scoring service.

### BAREA-010: Results/Leaderboard
- Live calculation of top players and rank movements.
- Question-by-question answer distribution graphs.
- Final celebratory podium (1st, 2nd, 3rd place).
- **Deliverable**: Engaging gamified outcome screens.

### BAREA-011: Presentation
- Dedicated auditorium projector view designed for big screens.
- Distance-readable typography and ambient contrast tuning.
- Responsive layout adapting to standard 16:9 1080p and 4K displays.
- **Deliverable**: Audience-facing visual presentation experience.

### BAREA-012: Church Validation
- Community validation for theological consistency across Bible translations (ESV, NIV, KJV, etc.).
- Profanity / inappropriate name filtering tailored for church settings.
- Accessibility review for elderly and young children.
- **Deliverable**: Church-readiness audit and compliance check.

### BAREA-013: Pilot
- Full end-to-end dry run with a live church group or Sunday school class.
- Performance and connection stress testing under typical church Wi-Fi conditions.
- User feedback collection and prioritization for production readiness.
- **Deliverable**: Successful live pilot demonstration.
