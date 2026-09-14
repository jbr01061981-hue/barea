# BAREA Frontend Progress

> **Frontend source of truth:** This file records implemented UI stages, verified repository state, and the agreed sequence for future frontend work. GitHub `main` remains the authoritative code source.

## Current status

| Stage | Frontend scope | Status | Repository state |
|---|---|---|---|
| BAREA-008 | Public homepage / landing foundation | **MERGED** | Present on `main` |
| BAREA-008A | Public homepage visual redesign + public entry UX | **MERGED** | Present on `main`; the former `barea-008a-public-entry` branch is behind `main` |
| BAREA-008B | Public homepage refinement | **CURRENT / DESIGN REFINEMENT** | Active work exists on dedicated `barea-008b-*` branches; not merged to `main` |
| BAREA-009 | Teacher Workspace / Quiz Library redesign | **NEXT MAJOR** | Not started on `main` |
| BAREA-010 | Quiz Builder / Question UX | Planned | Not started |
| BAREA-011 | Teacher Review / Question Bank UX | Planned | Not started |
| BAREA-012 | Share Quiz / Join experience | Planned | Not started as the next frontend milestone |
| BAREA-013 | Host Lobby | Planned | Not started |
| BAREA-014 | Participant mobile quiz | Planned | Not started |
| BAREA-015 | Live Host Console | Planned | Not started |
| BAREA-016 | Results / Leaderboard | Planned | Not started |
| BAREA-017 | Presentation / Projector experience | Planned | Not started |

## BAREA-008B — Public homepage refinement

**Status: CURRENT / DESIGN REFINEMENT**

BAREA-008 and BAREA-008A are already incorporated into `main`. The current 008B work is a refinement track rather than a completed milestone on `main`.

Dedicated 008B branches exist for responsive, Stitch, and Living Water homepage refinements. These branches are not yet part of `main`; their changes must not be treated as merged implementation state until independently reviewed and merged.

The current design exploration proposes a Living Waterscape direction while preserving the established BAREA product invariants:
- Scripture/content primacy.
- Human-in-the-loop review and approval.
- Three distinct Host, Participant, and Sanctuary presentation roles.
- No anonymous nickname-only individual participation.
- Teacher-controlled group mode does not require child accounts or devices.
- Authenticated individual participation uses the authoritative BAREA identity/session system.

Any 008B implementation must preserve existing teacher workspace contracts and must not invent or weaken backend authentication, authorization, tenant isolation, or live-session behavior.

## BAREA-008A — Public homepage visual redesign + public entry UX

**Status: MERGED**

Implemented on the public homepage and incorporated into `main` before the current authentication/logout work.

Key established UI behavior:
- Scripture-centered public homepage.
- General `Log in` language rather than teacher-only login wording.
- No fake OAuth/provider flow or simulated credentials.
- Responsive homepage treatment across mobile, tablet, laptop, and desktop.
- Teacher/Host, Participant, and Sanctuary Display experiences are presented as distinct product roles.
- Public UI does not bypass protected teacher authorization.

## Sequencing rule

Do not jump directly from the homepage to the live quiz console. Progressively expose the existing BAREA capabilities through purpose-built experiences:

`Homepage → Public Entry/Auth UX → Teacher Workspace → Quiz Builder/Question UX → Review/Question Bank → Share/Join → Host Lobby → Participant → Live Host → Results → Projector`

## Product architecture principles

- This frontend track is responsible for frontend development and frontend testing; backend/security/domain contracts remain authoritative elsewhere in the repository.
- BAREA is not a generic CRUD/admin dashboard.
- Teacher/Host experience is desktop/tablet oriented.
- Participant experience is mobile-first.
- Presentation experience is projector/large-screen oriented.
- Frontend is not a security boundary.
- Backend/session state remains authoritative.
- Never invent backend APIs or silently alter backend/security/domain contracts to support a frontend feature.
- If a frontend experience depends on backend capability that does not yet exist, record it as a dependency/backend gap.
- GitHub `main` and the implementation in the repository are the source of truth; this progress document records frontend sequence and evidence.

## Authentication and access status

Phase 1 authentication/access is complete on `main`. The repository now contains the unified account/session foundation, Google OAuth/OIDC verification, server-authoritative sessions, account linking rules, teacher authorization boundaries, and the Task 4 logout/session-revocation correction.

A user who authenticates successfully but has no teacher/admin membership must remain denied from `/teacher/*`; frontend work must not introduce a teacher bypass. Individual authenticated participation and teacher authorization remain separate concerns.

## Open human/design decisions

Before implementing the next major workspace redesign or generating new live-session screens, resolve any still-open design decisions documented in the applicable design sources, including the Teacher Workspace theme decision, Stitch project allocation, and formal live-session role-route convention. Do not silently convert an exploratory design proposal into an implementation contract.
