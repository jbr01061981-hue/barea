# BAREA

BAREA is a modern, real-time, synchronized church quiz platform designed for Sunday schools, youth ministries, Bible study groups, and church-wide fellowship events.

---

## Overview

BAREA bridges biblical education and interactive engagement. It empowers teachers and hosts to effortlessly generate biblically faithful questions, manage a reusable question bank, author customized quizzes, and host live, low-latency, multiplayer quiz sessions with real-time projector display and mobile participant experiences.

### Key Pillars

1. **Biblical Faithfulness & Quality**: Strict human-in-the-loop review ensures that every AI-generated or manually authored question is verified for scriptural accuracy and church-level appropriateness.
2. **Dedicated Church Modes**:
   - **Teacher / Host Dashboard**: Full control over question approval, quiz assembly, live session pacing, and real-time oversight.
   - **Mobile Participant Experience**: Fast, responsive, accessible web-app optimized for smartphones with zero install friction.
   - **Projector / Presentation View**: Clean, engaging big-screen display for sanctuaries, auditoriums, and classrooms showing questions, timers, leaderboards, and celebratory feedback.
3. **Seamless Joining**: Quick participation via QR code, direct URL, or 6-character room access codes without requiring participant accounts.
4. **Server-Authoritative Real-Time Architecture**: Tamper-proof scoring, synchronized countdown timers, and live leaderboard calculations driven by an authoritative game loop.
5. **AI-Powered Generation with Teacher Control**: AI generates questions based on scripture topic, difficulty, question type, and language, but **never** publishes directly without explicit teacher validation, editing, and approval.

---

## Core Workflow

`	ext
[AI Generation]
       │
       ▼
[System Validation & Schema Check]
       │
       ▼
[Teacher Review, Edit & Scripture Check]
       │
       ▼
[Teacher Approval] ────► [Question Bank]
                               │
                               ▼
                       [Quiz Authoring]
                               │
                               ▼
                        [Live Session]
                         ├── Host Controls (Next/Pause/End)
                         ├── Projector Display (Big Screen)
                         └── Mobile Participants (Real-Time Answers)
`

---

## Project Documentation

Detailed design specifications, product requirements, and architecture plans are located in the [docs/](./docs/) directory:

- [**docs/PRODUCT.md**](./docs/PRODUCT.md): Product vision, user personas, roles, and core experiences.
- [**docs/REQUIREMENTS.md**](./docs/REQUIREMENTS.md): Functional and non-functional requirements, constraints, and acceptance criteria.
- [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md): System architecture, real-time engine design, scoring models, and security boundaries.
- [**docs/ROADMAP.md**](./docs/ROADMAP.md): Milestone tracker from Foundation (BAREA-001) through Pilot (BAREA-013).
- [**docs/DECISIONS.md**](./docs/DECISIONS.md): Architecture Decision Records (ADRs) capturing key architectural choices and open decisions.
- [**AGENTS.md**](./AGENTS.md): Development guidance, guardrails, and instructions for AI agents working in this repository.

---

## Status

The project is currently in the **Foundation** phase (BAREA-001). No application code or database migrations are deployed yet. All subsequent milestones (BAREA-002 through BAREA-013) are tracked in [docs/ROADMAP.md](./docs/ROADMAP.md).
