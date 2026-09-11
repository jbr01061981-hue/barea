# BAREA Frontend Staged Development Plan

This is the frontend execution plan. It complements the repository's product roadmap; it does not replace backend milestones.

## Stage 0 — Foundation and contract alignment
**Status: In progress — FE-001 PR #10**

Deliver:
- semantic design tokens;
- accessible core primitives;
- public/teacher/participant shells;
- responsive foundations;
- public landing;
- initial room-code lookup/join entry;
- documentation of durable UX decisions.

Gate:
- no backend/security behavior changed;
- existing session semantics preserved;
- CI/typecheck/test/build pass before merge.

## Stage 1 — Share & Join experience (FE-002)
**Status: Next frontend stage**

Build the complete contract-backed entry journey:
- join by room/access code;
- shareable URL entry;
- quiz/session summary;
- admission-policy messaging;
- authenticated participant entry states;
- teacher-group entry states;
- loading, invalid-code, closed, locked, expired, and unavailable states;
- recovery/navigation back to join;
- share/QR UI when the backend exposes the corresponding data.

Important boundary:
- production authentication UI/integration is a **FRONTEND DEPENDENCY / BACKEND GAP** until the repository exposes the production auth contract.

Acceptance gate:
A real user can understand how to get from a QR/link/code to the correct authorized join path without anonymous individual participation.

## Stage 2 — Teacher workspace and dashboard (FE-003)

Build:
- teacher home/dashboard;
- quiz list and filtering;
- clear draft/published/archived lifecycle presentation;
- quiz workspace navigation;
- configuration summaries;
- empty/loading/error states;
- responsive tablet/desktop behavior.

Acceptance gate:
A teacher can find a quiz, understand its lifecycle/status, and enter the correct next action quickly.

## Stage 3 — Quiz Builder redesign (FE-004)

Build:
- efficient question authoring flow;
- reusable Question Bank selection;
- quiz-level configuration;
- validation and unsaved-change UX;
- clear draft/published boundaries;
- authoring accessibility.

Acceptance gate:
A teacher can create/reuse a quiz efficiently without changing the persistent Question Bank architecture.

## Stage 4 — Session creation + host share/lobby (FE-005 / FE-006)

Build against the existing session contracts:
- session configuration;
- participation mode and admission policy controls;
- create-session flow;
- share screen;
- QR presentation;
- room/access code;
- host lobby;
- roster/group management where supported;
- locked/closed states.

Do not invent live synchronization behavior here.

Acceptance gate:
The host can configure a valid session and reach a clear lobby/share experience.

## Stage 5 — Live host console (FE-007)
**Blocked/contract-gated by live backend**

Build only after explicit BAREA-007 live state contracts exist:
- synchronized question state;
- server-authoritative countdown display;
- start/pause/resume/reveal/next/finish controls;
- participant status;
- connection/recovery states;
- stale-state/version handling;
- safe confirmation for consequential controls.

Acceptance gate:
Host controls reflect authoritative server state and recover cleanly from delayed/reconnected clients.

## Stage 6 — Mobile participant gameplay (FE-008)
**Blocked/contract-gated by live backend**

Build:
- waiting/lobby;
- synchronized question display;
- large answer targets;
- submission confirmation;
- time/state feedback;
- locked/late/submitted/waiting states;
- reconnect/recovery;
- completion transition.

Acceptance gate:
A participant can play an entire quiz on a phone with one obvious action at each step.

## Stage 7 — Results and scoring UX (FE-009)
**Blocked/contract-gated by scoring backend**

Build:
- participant completion/results;
- host results;
- leaderboard;
- ties/ranking presentation according to backend contract;
- authoritative-score messaging;
- post-quiz navigation.

Acceptance gate:
Displayed results are demonstrably derived from authoritative server-side scoring.

## Stage 8 — Presentation mode (FE-010)
**Blocked/contract-gated by live backend**

Build dedicated projector experience:
- very large typography;
- high contrast;
- minimal chrome;
- question/answer/reveal states;
- countdown visibility;
- QR/join display when applicable;
- completion/results display.

Acceptance gate:
A congregation can read the essential state from normal church viewing distance.

## Stage 9 — Accessibility and responsive hardening (FE-011)

Audit the complete product:
- keyboard navigation;
- focus order and visible focus;
- screen-reader semantics;
- touch targets;
- contrast;
- reduced-motion behavior;
- mobile widths/orientations;
- tablet host layouts;
- projector readability;
- error and recovery messaging.

Acceptance gate:
Critical paths are usable without relying on color, hover, precise pointer interaction, or hidden state.

## Stage 10 — Browser/E2E critical paths (FE-012)

Automate the highest-value journeys:
1. public landing → join;
2. invalid/valid room lookup;
3. authenticated individual join once auth contract exists;
4. teacher quiz list → workspace;
5. session creation → share/lobby;
6. host live controls once live backend exists;
7. participant gameplay once live backend exists;
8. completion → results;
9. presentation mode.

Acceptance gate:
Critical church-event paths are repeatably verifiable in CI.

## Delivery discipline

For every stage:

1. Read the current repository roadmap and this document.
2. Inspect the actual current implementation and backend contract.
3. Record any material UX/architecture decision in `DESIGN_DECISIONS.md`.
4. Implement the smallest coherent vertical slice.
5. Preserve existing domain/security semantics.
6. Add loading, error, empty, and recovery states as part of the feature, not later.
7. Validate with typecheck/tests/build or CI where available.
8. Independently review the diff before merge.
9. Do not merge without explicit authorization.
10. Update this roadmap status and the relevant documentation after the stage is completed.

## Current dependency map

| Frontend area | Backend prerequisite |
|---|---|
| Landing | None beyond existing routes |
| Room lookup/join | Existing BAREA-006 session contract |
| Individual auth UI | Production authentication contract |
| Host lobby | Session creation/roster contract |
| Live host | BAREA-007 live state contract |
| Participant gameplay | BAREA-007 live state + answer contract |
| Results/leaderboard | Scoring/results contract |
| Presentation synchronization | Live/presentation contract |

This dependency map prevents frontend work from silently inventing backend behavior.