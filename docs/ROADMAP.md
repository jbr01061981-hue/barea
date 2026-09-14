# BAREA — Project Roadmap

This roadmap reconciles the core product phases with the implementation milestones already present in the repository. GitHub `main` is authoritative for actual implementation state; this document defines the intended task sequence.

## Phase 1 — Unified Account & Access

**Status: COMPLETE — REVIEWED, VERIFIED, MERGED**

Established capabilities:
- Unified BAREA user identity and server-authoritative sessions.
- Email/password authentication.
- Google OAuth/OIDC with authorization-code exchange, PKCE, state and nonce handling, cryptographic ID-token verification, issuer/audience/algorithm/expiration/issued-at/subject validation, and JWKS key handling.
- Safe Google account linking only from trusted verified identity data.
- Session persistence, expiration and revocation.
- Teacher/admin authorization derived server-side from authenticated membership; client-supplied role or organization data cannot establish authority.
- Explicit fail-closed behavior for missing, invalid, expired, or unauthorized sessions.
- Logout session revocation and cookie clearing, including the Next.js Server Action discovery correction.

Task 4 verification on the current `main` commit includes a fresh Next.js build with `logoutAction` registered and a complete automated suite of **240/240 passing tests**. Local browser verification also confirmed successful Google authentication/session handoff and correct denial of teacher capability for an authenticated account without teacher/admin membership.

## Phase 2 — Share, Join & Live Quiz

**Status: NEXT MAJOR PRODUCT PHASE**

The backend/domain foundation for BAREA-005, BAREA-006, and BAREA-007 is already merged. The remaining work is to expose these capabilities through the intended frontend experiences and complete end-to-end church gameplay.

### 2.1 Shareable Access & Join Authorization

Required product flow:
1. Teacher creates a quiz.
2. Teacher publishes the quiz.
3. System generates a shareable quiz/session URL.
4. System generates a QR code.
5. System generates a unique room/access code.
6. Teacher configures the applicable participation mode and admission policy.
7. Teacher opens the Share Quiz experience.
8. Share experience presents QR code, URL, and access code as applicable.
9. Congregation member scans the QR code, opens the URL, or enters the access code.
10. Participant reaches the BAREA entry flow.
11. For `INDIVIDUAL_AUTHENTICATED` participation, the participant authenticates through the BAREA identity/session system.
12. Server checks the configured admission policy and session lifecycle.
13. Participant is admitted only when the server-authoritative checks succeed.

Participation mode and admission policy remain separate concepts:
- `TEACHER_GROUP`: teacher operates the experience for assigned pupils; children do not need individual accounts or devices.
- `INDIVIDUAL_AUTHENTICATED`: each participant uses an authenticated BAREA identity.

Admission policies remain:
- `TEACHER_ASSIGNED`
- `OPEN`
- `RESTRICTED`

No anonymous nickname-only individual participation is introduced.

### 2.2 Synchronized Live Quiz

Required gameplay:
1. Host opens the quiz lobby.
2. Participants/groups enter the applicable lobby.
3. Host sees the applicable participant/group status.
4. Host starts the quiz.
5. Server-authoritative countdown begins.
6. Question becomes active.
7. Participants answer simultaneously where applicable.
8. Answers are received and validated by the server.
9. Host can control start, pause, resume, answer reveal, next question, and finish as supported by the authoritative live-session contract.
10. Participants and projector receive synchronized state updates.
11. Quiz progresses question-by-question.
12. Quiz reaches completed state.
13. Concurrent participants and answer submissions are tested at realistic church-group scale.

The server remains authoritative for state, timing, answer acceptance, scoring, and answer secrecy. Client clocks and UI state are presentation mechanisms, not authority.

## Frontend implementation sequence

The frontend track progresses through these purpose-built experiences:

| Milestone | Scope | Status |
|---|---|---|
| BAREA-008 | Public homepage / landing foundation | **MERGED** |
| BAREA-008A | Public homepage visual redesign + public entry UX | **MERGED** |
| BAREA-008B | Public homepage refinement | **CURRENT / DESIGN REFINEMENT** |
| BAREA-009 | Teacher Workspace / Quiz Library redesign | **NEXT MAJOR** |
| BAREA-010 | Quiz Builder / Question UX | Planned |
| BAREA-011 | Teacher Review / Question Bank UX | Planned |
| BAREA-012 | Share Quiz / Join experience | Planned |
| BAREA-013 | Host Lobby | Planned |
| BAREA-014 | Participant mobile quiz | Planned |
| BAREA-015 | Live Host Console | Planned |
| BAREA-016 | Results / Leaderboard | Planned |
| BAREA-017 | Presentation / Projector experience | Planned |

### BAREA-009 — Teacher Workspace / Quiz Library redesign

This is the next major frontend milestone after the current 008B refinement track is settled.

Target experience:
- Authenticated, authorized teacher workspace.
- Quiz library at `/teacher/quizzes`.
- Clear workspace navigation and organization/tenant context derived from server-authorized state.
- Search and filtering appropriate to the existing quiz library contract.
- Quiz lifecycle visibility for draft/published/archived states as supported by the backend.
- Clear `Create New Quiz` entry point.
- Logout remains a real server-side session operation.

BAREA-009 must not invent authentication, authorization, tenant, quiz, or live-session behavior. It must consume existing server contracts and fail closed when authorization is unavailable.

## Phase 3 — Results & Leaderboard

**Status: PLANNED**

- Finalize participant/group scores from authoritative server state.
- Display participant and host results.
- Display leaderboard and final podium.
- Provide the post-quiz completion experience.
- Ensure all result calculations remain server-authoritative.

## Phase 4 — Unified Question Creation

**Status: PLANNED**

- Improve Question Bank/question creation workflow.
- Provide unified question creation.
- Make question creation reusable across quizzes.
- Improve authoring efficiency.
- Preserve the existing persistent Question Bank architecture and review gate.

## Phase 5 — Landing Experience

**Status: PLANNED / PARTIALLY REPRESENTED BY EXISTING HOMEPAGE WORK**

- Improve the Berea landing experience.
- Clearly explain what Berea does.
- Provide clear teacher/host entry.
- Provide clear participant entry.
- Connect landing naturally to create, sign-in, and join flows.

Existing BAREA-008/008A homepage work is foundation, not a declaration that the complete Phase 5 product flow is finished.

## Phase 6 — Church Pilot & Feedback

**Status: PLANNED**

- Run Berea in a real church environment.
- Display the QR code to a real congregation.
- Have real participants join using their phones.
- Run real quizzes.
- Observe joining, concurrency, host controls, answer submission, results, and usability.
- Collect church/user feedback.
- Fix the highest-value problems.
- Re-test with the church.

## Sequencing and scope rules

1. Do not bypass authentication or teacher authorization to make frontend work appear complete.
2. Do not treat client-controlled identity, role, organization, timing, scoring, or answer data as authoritative.
3. Do not introduce anonymous nickname-only individual participation.
4. Preserve the human-in-the-loop AI review gate.
5. Preserve tenant isolation and server-authoritative live state.
6. Resolve open design/architecture decisions before implementing dependent screens when those decisions materially affect routes or contracts.
7. Every completed milestone requires repository inspection, tests/build verification, and independent review; an agent completion report is not itself approval.
