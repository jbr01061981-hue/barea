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
   - **Projector / Presentation View**: Big-screen display for sanctuaries, auditoriums, and classrooms showing questions, timers, leaderboards, and celebratory feedback.
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
-> Quiz
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

## Status

The project is currently in the **Foundation** phase (BAREA-001). No application code or database migrations are deployed. All subsequent milestones (BAREA-002 through BAREA-013) are marked as **NOT STARTED** in [docs/ROADMAP.md](./docs/ROADMAP.md).
