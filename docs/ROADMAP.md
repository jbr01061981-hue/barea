# BAREA Milestone Roadmap

This document outlines the sequential development phases of the **BAREA** platform.

Milestones must be executed in order. No milestone may proceed into application implementation until its prior dependency is completed and verified.

---

## Roadmap Overview

| Milestone ID | Title | Scope Summary | Status |
|---|---|---|---|
| **BAREA-001** | **Foundation** | Documentation, architecture, agent guidelines, ADRs | **IN PROGRESS** |
| **BAREA-002** | **Question Bank** | Domain models, storage, tagging, difficulty, search/filter | NOT STARTED |
| **BAREA-003** | **AI Quiz Generation** | Structured LLM prompt pipeline, parameter inputs, structural validation | NOT STARTED |
| **BAREA-004** | **Teacher Review/Approval**| Staging UI, editing, scripture check, approval gate | NOT STARTED |
| **BAREA-005** | **Quiz Authoring** | Quiz playlist composition, timer & scoring configurations, publishing | NOT STARTED |
| **BAREA-006** | **Share/Join** | QR generation, room access codes, URL routing, participant onboarding | NOT STARTED |
| **BAREA-007** | **Live Quiz** | Authoritative state machine, timer sync, real-time transport | NOT STARTED |
| **BAREA-008** | **Host/Participant UI** | Dual-interface UX: host control console & responsive mobile participant app | NOT STARTED |
| **BAREA-009** | **Scoring** | Server-side validation, timestamp verification, score algorithm | NOT STARTED |
| **BAREA-010** | **Results/Leaderboard** | Intermediate standings, final podium, celebration animations | NOT STARTED |
| **BAREA-011** | **Presentation** | Dedicated big-screen projector view, high-contrast layouts | NOT STARTED |
| **BAREA-012** | **Church Validation** | Theological accuracy review, inappropriate content filters, fellowship usability | NOT STARTED |
| **BAREA-013** | **Pilot** | End-to-end dry run with live congregation / Sunday school group | NOT STARTED |

---

## Detailed Milestone Descriptions

### BAREA-001: Foundation (Current Milestone)
- Establish repository documentation (README.md, AGENTS.md, docs/*).
- Define product requirements, architectural contracts, and ADRs.
- Initialize clean Git workflow without legacy baggage.
- **Deliverable**: Architectural blueprint and repository baseline.

### BAREA-002: Question Bank
- Database schema and persistence layer for questions.
- Question attributes: stem, options, correct indicator, explanation, scripture reference, topic, difficulty (Easy, Medium, Hard), and language.
- CRUD APIs and filtering mechanisms.
- **Status**: NOT STARTED.

### BAREA-003: AI Quiz Generation
- LLM prompt pipeline with structured output enforcement.
- Support teacher prompts: topic/passage, difficulty (Easy, Medium, Hard), question count, question type, language.
- Automatic structural schema validation before teacher handoff.
- Staging questions in pending review state.
- **Status**: NOT STARTED.

### BAREA-004: Teacher Review/Approval
- Interface for teachers to review generated questions before they become part of the library.
- Inline editing of stems, choices, and biblical explanations.
- Single-question and batch approval into Question Bank.
- Regeneration triggers for unsatisfactory questions.
- **Status**: NOT STARTED.

### BAREA-005: Quiz Authoring
- Compiling approved questions into structured quizzes.
- Configurable settings: per-question countdowns, scoring styles, question ordering.
- Publishing workflow that snapshots quizzes for active sessions.
- **Status**: NOT STARTED.

### BAREA-006: Share/Join
- Session creation with room access codes.
- Dynamic QR code generation for projector and mobile devices.
- Mobile landing flow: nickname entry, duplicate name handling, session resumption.
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
