# BAREA

BAREA is a synchronized church quiz platform designed for Sunday schools, youth ministries, Bible study groups, and church-wide fellowship events.

---

## Overview

BAREA bridges biblical education and interactive engagement. It empowers teachers and hosts to generate biblically faithful questions, manage a reusable Question Bank, author quizzes, and run synchronized live quiz experiences with projector and mobile participant surfaces.

### Key Pillars

1. **Biblical Faithfulness & Content Verification**: Human-in-the-loop review ensures that AI-generated or manually authored questions are verified by a teacher for scriptural accuracy and church-level appropriateness. Structural validation checks schema integrity but does not replace human theological review.
2. **Dedicated Church Modes**:
   - **Teacher / Host View**: Question approval, quiz assembly, live-session control, and participant/group oversight.
   - **Mobile Participant Experience**: Responsive web participation without app installation.
   - **Projector / Presentation View**: Big-screen display for questions, timers, answer reveals, leaderboards, and celebration.
3. **Flexible Entry**: QR code, direct URL, and room access code provide low-friction entry while server-side admission rules remain authoritative.
4. **Server-Authoritative Live State & Scoring**: Live state, timing, answer acceptance, and scoring are authoritative on the server.
5. **AI-Powered Generation with Teacher Control**: AI-generated questions are structurally validated and staged for human review; they cannot bypass the approval lifecycle.

---

## Identity & Participation

BAREA separates **participation mode** from **admission policy**.

- **Teacher-controlled group participation (`TEACHER_GROUP`)**: The teacher creates/groups and records group answers. Children do not need BAREA accounts, OAuth identities, or personal devices.
- **Authenticated individual participation (`INDIVIDUAL_AUTHENTICATED`)**: Each participant uses an authenticated BAREA identity. Anonymous nickname-only individual play is not permitted.
- Admission policies include `TEACHER_ASSIGNED`, `OPEN`, and `RESTRICTED` as defined by the product and server-side authorization contracts.

Authentication is real server-side authentication. Google OAuth/OIDC is implemented with state, PKCE, nonce, cryptographic ID-token verification, trusted identity binding, and server-authoritative sessions.

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

Conceptual architecture, product requirements, decisions, and roadmap are located in `docs/`:

- `docs/PRODUCT.md` — product vision, personas, participation modes, admission policies, and core experiences.
- `docs/REQUIREMENTS.md` — functional and non-functional requirements.
- `docs/ARCHITECTURE.md` — conceptual system architecture, state machine, and server-authoritative models.
- `docs/ROADMAP.md` — current phase roadmap and frontend milestone sequence.
- `docs/DECISIONS.md` — architecture decision records.
- `docs/FRONTEND_PROGRESS.md` — frontend implementation sequence and evidence.
- `AGENTS.md` — development guidance and repository guardrails.

---

## Current Implementation Status

### Phase 1 — Unified Account & Access

**COMPLETE — REVIEWED, VERIFIED, MERGED**

The repository contains the unified account/session foundation, email/password authentication, Google OAuth/OIDC, secure state/PKCE/nonce handling, cryptographic Google ID-token verification, trusted account linking, server-authoritative sessions, teacher/admin authorization boundaries, and logout session revocation/cookie clearing.

Task 4 logout correction is merged in `ef175b6183c85a8cde309e645d89256fb6fbc946`. Fresh local verification after clearing the development database and Next.js build artifacts completed with:

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run build:next` — PASS
- `npm test` — **240/240 PASS**
- Fresh Next.js Server Action manifest contains `logoutAction`.
- Fresh browser verification confirmed Google authentication/session handoff and correct fail-closed teacher authorization for an authenticated user without teacher/admin membership.

### Core Quiz Foundations

The repository also contains the implemented foundations represented by BAREA-005, BAREA-006, and BAREA-007: quiz authoring/snapshots, share/join/admission foundations, and authoritative live-session state/transport. Their frontend end-to-end experiences continue through the frontend milestone sequence below.

### Frontend Sequence

- BAREA-008 — Public homepage / landing foundation — **MERGED**
- BAREA-008A — Public homepage visual redesign + public entry UX — **MERGED**
- BAREA-008B — Public homepage refinement — **CURRENT / DESIGN REFINEMENT; not merged to `main`**
- BAREA-009 — Teacher Workspace / Quiz Library redesign — **NEXT MAJOR**
- BAREA-010 — Quiz Builder / Question UX — Planned
- BAREA-011 — Teacher Review / Question Bank UX — Planned
- BAREA-012 — Share Quiz / Join — Planned
- BAREA-013 — Host Lobby — Planned
- BAREA-014 — Participant mobile quiz — Planned
- BAREA-015 — Live Host Console — Planned
- BAREA-016 — Results / Leaderboard — Planned
- BAREA-017 — Presentation / Projector experience — Planned

---

## Next Major Product Direction

The next major product phase is **Share, Join & Live Quiz**, while the frontend sequencing currently settles the public homepage refinement track before the **BAREA-009 Teacher Workspace / Quiz Library** redesign.

Frontend work must preserve the existing authentication, authorization, tenant isolation, human-review, live-state, timing, scoring, and answer-secrecy contracts. A frontend screen must not invent or weaken backend behavior to make the UI appear complete.
