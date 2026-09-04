# AGENTS.md - Agent Operating Guidelines for BAREA

Welcome to the **BAREA** project repository (jbr01061981-hue/barea).

This document outlines mandatory guidelines, architectural principles, development conventions, and operational guardrails for any automated agent or AI assistant contributing to this repository.

---

## 1. Fresh Implementation Policy

- **No Legacy Inheritance**: BAREA is a completely clean, fresh implementation. It does NOT inherit code, Git history, branches, configuration, agents, or tools from project-berea.
- **Reference Only**: Any prior research or notes from project-berea may be treated as domain knowledge / product reference only. Do not attempt to port old scripts or outdated build files.
- **Milestone Discipline**: Do NOT skip ahead or introduce application code, database connections, live WebSockets, or UI frameworks until the corresponding roadmap milestone has been formally initiated.

---

## 2. Core Product Principles

Every implementation decision must respect these foundational pillars:

1. **Human-in-the-Loop AI**:
   - AI generation is a core accelerator for quiz preparation, but AI must **NEVER** publish directly to a live quiz or active question bank without human teacher review.
   - The required lifecycle is strictly:
     AI Generation ➔ Schema Validation ➔ Teacher Review & Edit ➔ Teacher Approval ➔ Question Bank ➔ Quiz Authoring.
2. **Question-Level Difficulty**:
   - Difficulty (easy, medium, hard) belongs directly to the **question**, not merely the quiz. A single quiz can contain varied difficulty distributions.
3. **Church-First User Experience**:
   - The platform serves three distinct viewports/contexts simultaneously:
     - **Host / Teacher Console**: High-control management, pace control, participant monitoring.
     - **Mobile Participant**: Ultra-low friction (QR / 6-char PIN, no login required), large tap targets, battery-efficient.
     - **Big Screen / Projector**: Clean typography, high contrast, readable from the back of a church sanctuary or hall.
4. **Server-Authoritative Real-Time Engine**:
   - Scoring, timing, question transitions, and answer acceptances are strictly determined and recorded by the server. The client never computes its own score or dictates question expiry.

---

## 3. Engineering & Architectural Standards

### Strict Documentation & Contract First
- Never implement an API or live socket protocol without updating the technical documentation in docs/ first.
- Keep docs/DECISIONS.md updated with Architecture Decision Records (ADRs) whenever introducing major libraries, database engines, or transport protocols.
- Keep docs/ROADMAP.md synchronized with task statuses.

### Code Quality & Simplicity
- Prefer straightforward, well-typed, and maintainable structures over premature abstractions.
- Ensure all public interfaces and core domain entities have clear type contracts.
- Respect environment configuration best practices (12-factor app): no hardcoded secrets, database credentials, or AI provider keys.

### Git & Branch Workflow
- Feature branches must follow the naming convention: area-<milestone-number>-<short-description> (e.g., area-001-foundation).
- Commits must adhere to Conventional Commits (e.g., eat:, ix:, docs:, chore:, efactor:).
- Open Pull Requests against main for review. Do not self-merge unless explicitly instructed by the user.

---

## 4. Current Milestone Scope

Refer to [docs/ROADMAP.md](./docs/ROADMAP.md) for the active milestone:
- **Active**: BAREA-001 Foundation (Documentation & Architecture Foundation only).
- **Future**: BAREA-002 through BAREA-013 are currently **NOT STARTED**. Do not generate application code or scaffold mock backends during BAREA-001.
