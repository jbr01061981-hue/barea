# AGENTS.md - Agent Operating Guidelines for BAREA

Welcome to the **BAREA** project repository (jbr01061981-hue/barea).

This document outlines mandatory guidelines, architectural principles, development conventions, and operational guardrails for any automated agent or AI assistant contributing to this repository.

---

## 1. Fresh Implementation Policy

- **No Legacy Inheritance**: BAREA is a completely clean, fresh implementation. It does NOT inherit code, Git history, branches, configuration, agents, or tools from project-berea.
- **Reference Only**: Any prior research or notes from project-berea may be treated as domain knowledge / product reference only. Do not attempt to port old scripts or outdated build files.
- **Milestone Discipline**: Do NOT skip ahead or introduce application code, database connections, live transport logic, or UI frameworks until the corresponding roadmap milestone has been formally initiated.

---

## 2. Core Product Principles

Every implementation decision must respect these foundational pillars:

1. **Human-in-the-Loop AI**:
   - AI generation is a core accelerator for quiz preparation, but AI must **NEVER** publish directly to a live quiz or active question bank without human teacher review.
   - The required lifecycle is strictly:
     AI generates -> structural validation -> teacher review -> teacher edit/regenerate -> teacher approval -> Question Bank -> Quiz.
   - Structural schema validation verifies formatting, presence of fields, and data types, but does not substitute for human biblical/scriptural verification.
2. **Question-Level Difficulty**:
   - Difficulty (Easy, Medium, Hard) belongs directly to the **question**, not merely the quiz. A single quiz can contain varied difficulty distributions.
3. **Church-First User Experience**:
   - The platform serves three distinct viewports/contexts simultaneously:
     - **Host / Teacher Console**: Management, pacing controls, participant roster monitoring.
     - **Mobile Participant**: Ultra-low friction (QR / room code join, no mandatory app store download), clear touch targets.
     - **Big Screen / Projector**: Clean typography, high contrast, readable from the back of a church sanctuary or hall.
4. **Server-Authoritative Live State & Scoring**:
   - Scoring, timing, question transitions, and answer acceptances are strictly determined and recorded by the server. The client never computes its own score or dictates question expiry.

---

## 3. Engineering & Architectural Standards

### Strict Documentation & Contract First
- Never implement an API or live protocol without updating the technical documentation in docs/ first.
- Keep docs/DECISIONS.md updated with Architecture Decision Records (ADRs) whenever establishing architectural choices or recording open decisions.
- Keep docs/ROADMAP.md synchronized with task statuses.

### TypeScript Standard
- **BAREA application code is TypeScript-first.** New application code must use `.ts`/`.tsx` as appropriate.
- BAREA-002A is the required migration gate before BAREA-003 begins.
- Preserve behavior and public contracts during migration; do not use the migration as an excuse to introduce frameworks, APIs, live transport, or unrelated refactors.

### Git & Branch Workflow
- Feature branches must follow the naming convention: `barea-<milestone-number>-<short-description>` (e.g., `barea-001-foundation`).
- Commits must adhere to Conventional Commits (e.g., `feat`, `fix`, `docs`, `chore`, `refactor`).
- Open Pull Requests against main for review. Do not self-merge unless explicitly instructed by the user.

---

## 4. Current Milestone Scope

Refer to [docs/ROADMAP.md](./docs/ROADMAP.md) for the active milestone:
- **Active**: BAREA-002A TypeScript Migration Gate.
- **Purpose**: Convert the approved BAREA-002 implementation from JavaScript to TypeScript while preserving behavior and test coverage.
- **Next**: BAREA-003 AI Quiz Generation remains **NOT STARTED** and must not be implemented during BAREA-002A.
