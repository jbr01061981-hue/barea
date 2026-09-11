# BAREA Frontend Architecture & Design Guide

This directory is the long-term reference for BAREA frontend architecture, UX decisions, implementation stages, and frontend/backend boundaries.

## Product principle

BAREA is a synchronized church quiz platform, not a generic CRUD dashboard. The interface is designed around the real church event:

- a **Host/Teacher** needs speed, control, visibility, and reliable live controls;
- a **Participant** needs one obvious action at a time, especially on a phone;
- a **Presentation** screen needs distance-readable typography, high contrast, minimal chrome, and clear QR/join information.

The frontend must make these three experiences feel intentional while sharing one visual language.

## Source of truth

- GitHub repository code is authoritative for implementation state.
- Existing domain/session contracts are authoritative for participation and session semantics.
- Backend/session services remain authoritative for authorization, session state, timing, scoring, and live synchronization.
- These documents record frontend decisions so future contributors do not have to reconstruct design intent from commits.

## Domain rules the frontend must preserve

`ParticipationMode` and `AdmissionPolicy` are separate concepts and must never be collapsed.

- `TEACHER_GROUP` + `TEACHER_ASSIGNED`: teacher-managed groups/pupils; children do not authenticate individually.
- `INDIVIDUAL_AUTHENTICATED` + `OPEN`: authenticated participants may join when the backend permits it.
- `INDIVIDUAL_AUTHENTICATED` + `RESTRICTED`: authenticated participants require backend authorization.

The UI may explain these modes but must not enforce authorization by itself. Hidden buttons, client identifiers, room codes, or IP information are never security boundaries.

## Current frontend foundation

FE-001 establishes:

- semantic BAREA design tokens;
- accessible reusable button, card, and badge primitives;
- contextual public, teacher, and participant shells;
- public landing and initial room-code join experience;
- responsive foundations for desktop/tablet host use and mobile participant use.

FE-001 deliberately does **not** implement realtime gameplay, answer submission, live scoring, or presentation synchronization.

## Frontend/backend boundary

When a required capability is not present in the backend contract, document it explicitly as **FRONTEND DEPENDENCY / BACKEND GAP**. Do not invent API shapes, state transitions, authorization behavior, or synchronization protocols in the UI.

Known dependencies include production authentication UI/integration and the later live/realtime/scoring/presentation contracts.

## Related documents

- [`FRONTEND_ROADMAP.md`](./FRONTEND_ROADMAP.md) — staged implementation plan and acceptance gates.
- [`DESIGN_DECISIONS.md`](./DESIGN_DECISIONS.md) — durable UX/architecture decisions and rationale.

## Review rule

Before implementing a later stage, read this directory and the current repository roadmap. Update the relevant design decision or roadmap entry when a material frontend choice is made. The documentation should evolve with the product, not after it.