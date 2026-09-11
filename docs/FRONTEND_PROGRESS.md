# BAREA Frontend Progress

> **Frontend source of truth:** This file records implemented UI stages, verified repository state, and the agreed sequence for future frontend work. GitHub `main` remains the authoritative code source.

## Current status

| Stage | Frontend scope | Status | GitHub reference |
|---|---|---|---|
| BAREA-008 | Public homepage / landing foundation | **MERGED** | `9b76e9f` / PR #12 |
| BAREA-009 | Teacher Workspace / Quiz Library redesign | **NEXT** | Not started |
| BAREA-010 | Quiz Builder / Question UX | Planned | Not started |
| BAREA-011 | Teacher Review / Question Bank UX | Planned | Not started |
| BAREA-012 | Share Quiz / Join experience | Planned | Not started |
| BAREA-013 | Host Lobby | Planned | Not started |
| BAREA-014 | Participant mobile quiz | Planned | Not started |
| BAREA-015 | Live Host Console | Planned | Not started |
| BAREA-016 | Results / Leaderboard | Planned | Not started |
| BAREA-017 | Presentation / Projector experience | Planned | Not started |

## BAREA-008 — Homepage

**Status: MERGED**

Merged into `main` via PR #12.

Merge commit: `9b76e9f671cd004e5d58cb25f8ac723a81f2259d`

Implemented:
- Public BAREA homepage at `/`.
- Public application shell/header/footer.
- BAREA-owned visual tokens and responsive styling.
- Hero and primary product positioning.
- Prepare → Verify → Play workflow explanation.
- Teacher, participant, and projector experience framing.
- Public CTAs deliberately kept away from protected teacher routes until an appropriate authentication/entry experience exists.
- Responsive/mobile presentation and accessibility-focused states.

Verification completed before merge:
- `npm run typecheck` — PASS
- `npm test` — 149/149 PASS
- `npm run build` — PASS
- `npm run build:next` — PASS
- Rendered homepage visual review — PASS

Important implementation corrections before merge:
- Removed stale negative layout offsets after the root layout changed.
- Replaced public homepage/header links that incorrectly entered protected `/teacher/quizzes` with public workflow anchors.

## Repository capability audit after BAREA-008

The merged repository already contains substantial backend/domain capability from BAREA-001 through BAREA-007.

### Existing teacher capabilities

The repository currently contains:
- `/teacher/quizzes` teacher quiz management page.
- Quiz creation and archive actions.
- Quiz filtering by All / Draft / Published / Archived.
- Quiz search.
- Quiz configuration for title, description, timer, scoring style, and option shuffle.
- Per-quiz editor at `/teacher/quizzes/[id]`.
- Separate quiz editor and inspector client experiences.
- Teacher review experience at `/teacher/review`.

The existing quiz-management UI is functional but currently reads as a basic management/catalog interface rather than the intended purpose-built BAREA teacher workspace.

### Existing session/live capabilities

The domain already defines:
- `ParticipationMode.TEACHER_GROUP`
- `ParticipationMode.INDIVIDUAL_AUTHENTICATED`
- `AdmissionPolicy.TEACHER_ASSIGNED`
- `AdmissionPolicy.OPEN`
- `AdmissionPolicy.RESTRICTED`
- `SessionStatus.LOBBY`
- `SessionStatus.ACTIVE`
- `SessionStatus.COMPLETED`
- `SessionStatus.CLOSED`

The repository also contains session actions and live-session actions/SSE transport.

These are **backend/domain foundations**. They must not be represented in the UI as completed user experiences until the corresponding frontend is implemented and verified.

## Next frontend stage — BAREA-009

### Teacher Workspace / Quiz Library redesign

Goal: turn the existing teacher quiz-management entry point into the primary BAREA teacher workspace without duplicating backend functionality.

The intended experience should make the teacher's preparation journey obvious:

```text
Teacher Workspace
    ├── Create quiz
    ├── Continue draft
    ├── Question Bank
    ├── Review AI questions
    ├── Published quizzes
    └── Run / share a quiz
```

This is a **frontend redesign/experience layer** over capabilities that already exist. It must not invent backend APIs or alter security boundaries.

### Sequencing rule

Do not jump directly from the homepage to the live quiz console. Progressively expose the already-completed BAREA capabilities through purpose-built experiences:

`Homepage → Teacher Workspace → Quiz Builder/Question UX → Review/Question Bank → Share/Join → Host Lobby → Participant → Live Host → Results → Projector`

## Product architecture principles

- BAREA is not a generic CRUD/admin dashboard.
- Teacher/Host experience is desktop/tablet oriented.
- Participant experience is mobile-first.
- Presentation experience is projector/large-screen oriented.
- Frontend is not a security boundary.
- Backend/session state remains authoritative.
- `ParticipationMode` and `AdmissionPolicy` remain separate concepts.
- Never add anonymous nickname-only individual participation.
- Do not claim frontend support for backend capabilities that have not been wired into a verified UI.
- Preserve the existing BAREA-001→007 backend/security contracts.

## Development workflow

For each frontend stage:

1. Inspect the current merged `main` implementation and domain contracts.
2. Define the narrow frontend slice before coding.
3. Create a dedicated frontend branch from `main`.
4. Implement directly in the repository.
5. Run typecheck, tests, production build, and Next build.
6. Perform rendered visual review at desktop and mobile sizes.
7. Review accessibility/responsive behavior and primary user journeys.
8. Fix issues found during review before requesting merge.
9. Merge only the verified stage into `main`.
10. Update this file with the resulting status, commit/PR, verification evidence, and decisions affecting subsequent stages.

## Source-of-truth rule

This document is the **frontend progress/sequence record**. It complements, but does not replace:
- the Git repository as implementation source of truth;
- the main project roadmap as product/backend roadmap;
- domain models and ADRs as architectural/security contracts.

When this file conflicts with actual code, inspect the code and authoritative project roadmap and correct the discrepancy rather than guessing.
