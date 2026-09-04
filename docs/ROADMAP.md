# BAREA Milestone Roadmap

This document outlines the sequential development phases of the **BAREA** platform.

Milestones must be executed in order. No milestone may proceed into application implementation until its prior dependency is completed and verified.

---

## Roadmap Overview

| Milestone ID | Title | Scope Summary | Status |
|---|---|---|---|
| **BAREA-001** | **Foundation** | Documentation, architecture, agent guidelines, ADRs | **COMPLETED** |
| **BAREA-002** | **Question Bank** | Domain models, storage, tagging, difficulty, search/filter | **IN PROGRESS** |
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

---

## Detailed Milestone Descriptions

### BAREA-001: Foundation
- Establish repository documentation (README.md, AGENTS.md, docs/*).
- Define product requirements, architectural contracts, and ADRs.
- Initialize clean Git workflow without legacy baggage.
- **Status**: COMPLETED.
- **Deliverable**: Architectural blueprint and repository baseline.

### BAREA-002: Question Bank (Current Milestone)
- Database schema and persistence layer for stored, approved questions.
- Question attributes: stem text, answer options, correct indicator, explanation, scripture reference, topic, difficulty (Easy, Medium, Hard), and language.
- CRUD APIs, search, and filtering mechanisms.
- Supports manual question authoring and serves as the destination for approved questions.
- **Status**: IN PROGRESS.
- **Deliverable**: Question persistence layer, schema validation, and Question Bank domain service.

### BAREA-003: AI Quiz Generation
- Core MVP AI generation pipeline with structured output enforcement.
- Teacher prompt parameters: topic/passage, difficulty (Easy, Medium, Hard), question count, question type, and language.
- Automatic structural/schema validation (format, required fields, data types).
- Places all successfully formatted drafts into a staged PENDING_REVIEW state.
- **Mandatory constraint**: AI questions cannot enter the active Question Bank or be published to live quizzes without passing through BAREA-004.
- **Status**: NOT STARTED.

### BAREA-004: Teacher Review/Approval
- Review workbench for teachers to inspect AI-generated question drafts.
- Theological and scriptural fidelity verification by the teacher.
- Inline editing of question stem, answer choices, correct option, scripture reference, and explanation.
- Question-level difficulty adjustments (Easy, Medium, Hard).
- Explicit single-item and batch approval into the Question Bank (APPROVED).
- Rejection or regeneration requests for unsatisfactory drafts.
- **Status**: NOT STARTED.

### BAREA-005: Quiz Authoring
- Compiling approved questions from the Question Bank into structured quizzes.
- Configurable settings: per-question countdowns, scoring styles, question ordering, and option shuffling.
- Publishing workflow that snapshots quizzes for active sessions.
- **Status**: NOT STARTED.

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
