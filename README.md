# BAREA

BAREA is a synchronized church quiz platform designed for Sunday schools, youth ministries, Bible study groups, and church-wide fellowship events.

---

## Overview

BAREA bridges biblical education and interactive engagement. It empowers teachers and hosts to generate biblically faithful questions, manage a reusable question bank, author customized quizzes, and host live quiz sessions with real-time projector display and mobile participant experiences.

### Key Pillars

1. **Biblical Faithfulness & Content Verification**: Human-in-the-loop review ensures that every AI-generated or manually authored question is verified by a teacher for scriptural accuracy and church-level appropriateness. Structural validation by the system checks formatting and schema integrity, but cannot replace human theological review.
2. **Dedicated Church Modes**:
   - **Teacher / Host View**: Controls for question approval, quiz assembly, live session pacing, and participant roster oversight.
   - **Mobile Participant Experience**: Responsive web experience accessible via smartphones with zero install friction.
   - **Projector / Presentation View**: Big-screen display in sanctuaries, auditoriums, and classrooms showing questions, timers, leaderboards, and celebratory feedback.
3. **Frictionless Joining**: Rapid participation via QR code, direct URL, or room access code without requiring participant app store downloads.
4. **Server-Authoritative Live State & Scoring**: Tamper-proof scoring, synchronized timers, and live leaderboard calculations driven by an authoritative server state machine.
5. **AI-Powered Generation with Teacher Control**: AI generates questions based on topic, difficulty, question type, and language. AI questions are never published directly without explicit structural validation and teacher review, editing, and approval.

---

## Core AI Workflow

```text
AI generates
-> structural validation
-> teacher review
-> teacher edit/regenerate
-> teacher approval
-> Question Bank
-> Quiz Authoring
```

---

## Project Documentation

Conceptual architecture, product requirements, and design specifications are located in the docs/ directory:

- [**docs/PRODUCT.md**](./docs/PRODUCT.md): Product vision, user personas, roles, and core experiences.
- [**docs/REQUIREMENTS.md**](./docs/REQUIREMENTS.md): Functional and non-functional requirements and conceptual boundaries.
- [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md): Conceptual system architecture, state machine, and server-authoritative scoring models.
- [**docs/ROADMAP.md**](./docs/ROADMAP.md): Milestone tracker from Foundation (BAREA-001) through Pilot (BAREA-013).
- [**docs/DECISIONS.md**](./docs/DECISIONS.md): Architecture Decision Records (ADRs) capturing architectural principles and open decisions.
- [**AGENTS.md**](./AGENTS.md): Development guidance, guardrails, and instructions for AI agents working in this repository.

---

## Implementation Status

**Completed through BAREA-004.**

- BAREA-001 Foundation — COMPLETED
- BAREA-002 Question Bank — COMPLETED
- BAREA-002A TypeScript Migration Gate — COMPLETED
- BAREA-003 AI Quiz Generation — COMPLETED
- BAREA-004 Teacher Review & Approval — COMPLETED and merged into `main`
- BAREA-005 Quiz Authoring — NOT STARTED

BAREA-004 was merged into `main` in commit `1faff33235378c6061a902a89454e5d62b097b0b`.

The current implementation provides the AI generation, structural validation, Question Bank, and teacher review/approval workflow. Quiz authoring, sharing/joining, live gameplay, scoring, leaderboard, presentation, church validation, and pilot milestones remain future work according to the roadmap.
