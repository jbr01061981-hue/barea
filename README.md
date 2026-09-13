# BAREA

BAREA is a synchronized church quiz platform designed for Sunday schools, youth ministries, Bible study groups, and church-wide fellowship events.

---

## Overview

BAREA bridges biblical education and interactive engagement. It empowers teachers and hosts to generate biblically faithful questions, manage a reusable question bank, author customized quizzes, and host live quiz sessions with real-time projector display and mobile participant experiences.

### Key Pillars

1. **Biblical Faithfulness & Content Verification**: Human-in-the-loop review ensures that every AI-generated or manually authored question is verified by a teacher for scriptural accuracy and church-level appropriateness.
2. **Unified Account & Access**: BAREA uses one canonical authenticated user identity with real email/password and Google OAuth/OIDC authentication, secure OAuth state/PKCE/nonce protection, safe account linking, and server-authoritative persisted sessions.
3. **Separate Teacher Capability**: An authenticated account is not automatically a teacher account. Teacher/Host capability is a separate server-authoritative capability and is disabled by default for newly registered users. Organization membership and personal workspace ownership are separate authorization concepts.
4. **Dedicated Church Modes**:
   - **Teacher / Host View**: Controls for question approval, quiz assembly, live session pacing, and participant roster oversight when the required capability is available.
   - **Mobile Participant Experience**: Responsive web experience for authenticated individual participation.
   - **Projector / Presentation View**: Big-screen display in sanctuaries, auditoriums, and classrooms.
5. **Frictionless Joining**: Rapid participation via QR code, direct URL, or room access code, subject to server-side admission and authentication requirements.
6. **Server-Authoritative Live State & Scoring**: Tamper-resistant scoring, synchronized timers, and live leaderboard calculations driven by authoritative server state.
7. **AI-Powered Generation with Teacher Control**: AI generates questions based on topic, difficulty, question type, and language. AI questions are never published directly without structural validation and human review/approval.

---

## Authentication Foundation — Completed

PR #15 established the real authentication foundation now used by subsequent BAREA work:

- Email/password registration and authentication.
- Google OAuth / OpenID Connect.
- Cryptographic OIDC ID-token verification and required claim validation.
- OAuth state, S256 PKCE, and nonce protection.
- Safe account provisioning and account linking.
- Server-authoritative persisted sessions using secure HttpOnly cookies.
- Server-side identity binding; client-supplied user IDs or roles do not establish authorization.
- Logout/session revocation.
- Production callback configuration and environment separation.

Authentication proves account identity. It does not by itself grant teacher/host capability.

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

Conceptual architecture, product requirements, roadmap, and design specifications are located in the docs/ directory:

- [**docs/PRODUCT.md**](./docs/PRODUCT.md): Product vision, user personas, roles, and core experiences.
- [**docs/REQUIREMENTS.md**](./docs/REQUIREMENTS.md): Functional and non-functional requirements, including authentication and authorization boundaries.
- [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md): Conceptual system architecture, identity/capability/workspace model, state machine, and server-authoritative scoring.
- [**docs/ROADMAP.md**](./docs/ROADMAP.md): Current product roadmap, including the completed Unified Account & Access phase.
- [**docs/DECISIONS.md**](./docs/DECISIONS.md): Architecture Decision Records capturing architectural principles and open decisions.
- [**docs/FRONTEND_PROGRESS.md**](./docs/FRONTEND_PROGRESS.md): Frontend implementation sequence and verified frontend progress.
- [**AGENTS.md**](./AGENTS.md): Development guidance and guardrails for AI agents working in this repository.

---

## Current Implementation Status

**Authentication foundation is complete and merged through PR #15.**

- BAREA-001 Foundation — COMPLETED
- BAREA-002 Question Bank — COMPLETED
- BAREA-002A TypeScript Migration Gate — COMPLETED
- BAREA-003 AI Quiz Generation — COMPLETED
- BAREA-004 Teacher Review & Approval — COMPLETED and merged
- BAREA-005 Quiz Authoring — COMPLETED and merged
- BAREA-006 Share/Join foundation — COMPLETED and merged
- BAREA-007 Live Quiz foundation — COMPLETED and merged
- PR #15 Unified Account & Access / real authentication foundation — COMPLETED and merged

The next product phase is Share, Join & Live Quiz completion. See `docs/ROADMAP.md` for the authoritative sequence and `docs/FRONTEND_PROGRESS.md` for the frontend sequence.
