# BAREA — Project Roadmap

This roadmap reconciles the core product phases with the implementation milestones already present in the repository. **GitHub `main` is authoritative for actual implementation state; this document defines the intended task sequence and current development status.**

## Current Development Status

**Main branch baseline: PR #20 merged on 2026-09-14.**

Merge commit: `298eccbabc7090531c9c31c2bc94c79592d11edb`

The unified authentication/home and hardened Google OAuth milestone is now part of `main`.

**Mobile LAN development-origin fix: PR #21 is reviewed and pending merge.**

PR #21 (`c040ec7e2ee5d92e5950d8b4886bda191e4fcbfe`) adds explicit development-origin resolution so a Next.js server bound to `0.0.0.0` cannot redirect a browser to the non-routable `0.0.0.0` address. It also enables LAN HMR through `allowedDevOrigins` and adds four focused regression tests. Until PR #21 is merged, these changes are branch state rather than `main` implementation state.

The verified PR #21 gates are:
- `npm test` — **259 passing / 0 failing**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **PASS**

**Google Web OAuth does not use a private LAN IP as the authoritative Web-client redirect URI.** Do not add `https://192.168.1.7:3000/api/auth/callback/google` to the Google Web OAuth client. LAN IP access remains suitable for mobile UI/responsive development; complete Google OAuth testing remains on an approved hostname such as local `https://localhost:3000` until a proper development hostname/tunnel is available.

Verified on the merged branch before/after merge:
- `npm test` — **255 passing / 0 failing**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **PASS**
- Local HTTPS Google OAuth flow — **PASS**
- Logout and server-side session invalidation — **PASS**

Cloudflare public HTTPS testing is **not yet completed**. Discovery found no active Cloudflare DNS zone or suitable custom domain in the current Cloudflare account, so no Cloudflare tunnel or DNS infrastructure was provisioned. This does not block the completed application milestone.

## Phase 1 — Unified Account & Access

**Status: COMPLETE — REVIEWED, VERIFIED, MERGED**

Established capabilities:
- Unified BAREA user identity and server-authoritative sessions.
- **Google-only federated authentication for current individual login.** Legacy email/password authentication is no longer an active authentication mechanism.
- Google OAuth/OIDC with authorization-code exchange, PKCE S256, state and nonce handling, cryptographic ID-token verification, issuer/audience/algorithm/expiration/issued-at/subject validation, JWKS key handling, and timeout protection.
- Server-side OAuth transaction lifecycle with replay/expiry protection and atomic consumption.
- No silent Google-account linking by email; unknown Google identities that collide with an existing BAREA email are rejected for explicit account-collision handling.
- Session persistence, expiration and revocation.
- Teacher/admin authorization derived server-side from authenticated membership; client-supplied role or organization data cannot establish authority.
- Explicit fail-closed behavior for missing, invalid, expired, or unauthorized sessions.
- Logout session revocation and cookie clearing.
- Unified authenticated `/home` for individual users and Create & Host capability presentation.
- Create & Host remains server-authorized; the UI lock is not a security boundary.
- Host cannot participate in their own real live session as a normal participant.

The milestone was implemented in PR #20, merged to `main` as commit `298eccbabc7090531c9c31c2bc94c79592d11edb`. Local HTTPS development support was also added for OAuth testing.

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

**Status: NEXT MAJOR FRONTEND MILESTONE**

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

- Improve the BAREA landing experience.
- Clearly explain what BAREA does.
- Provide clear teacher/host entry.
- Provide clear participant entry.
- Connect landing naturally to create, sign-in, and join flows.

Existing BAREA-008/008A homepage work is foundation, not a declaration that the complete Phase 5 product flow is finished.

## Phase 6 — Church Pilot & Feedback

**Status: PLANNED**

- Run BAREA in a real church environment.
- Display the QR code to a real congregation.
- Have real participants join using their phones.
- Run real quizzes.
- Observe joining, concurrency, host controls, answer submission, results, and usability.
- Collect church/user feedback.
- Fix the highest-value problems.
- Re-test with the church.

## Infrastructure Validation — Cloudflare HTTPS

**Status: DEFERRED — DOMAIN REQUIRED**

The intended architecture remains:

```text
PUBLIC INTERNET (HTTPS)
        ↓
CLOUDFLARE EDGE
        ↓
CLOUDFLARE TUNNEL
        ↓
PRIVATE BAREA ORIGIN
        ↓
Next.js App Router :3000
```

Cloudflare discovery on 2026-09-14 confirmed:
- Cloudflare account is accessible.
- No active DNS zones/domains are currently present in the account.
- No existing BAREA named tunnel exists.
- `berea-api-production.jbr01061981.workers.dev` is a separate backend/legacy Worker and remains untouched.
- No DNS, tunnel, Worker, or Google OAuth configuration was changed.

A persistent public HTTPS/OAuth test should resume only when a suitable custom domain is available. A Quick Tunnel may be used later for non-OAuth connectivity smoke testing, but its ephemeral hostname is not the authoritative Google OAuth validation path.

## Sequencing and scope rules

1. Do not bypass authentication or teacher authorization to make frontend work appear complete.
2. Do not treat client-controlled identity, role, organization, timing, scoring, or answer data as authoritative.
3. Do not introduce anonymous nickname-only individual participation.
4. Preserve the human-in-the-loop AI review gate.
5. Preserve tenant isolation and server-authoritative live state.
6. Resolve open design/architecture decisions before implementing dependent screens when those decisions materially affect routes or contracts.
7. Every completed milestone requires repository inspection, tests/build verification, and independent review; an agent completion report is not itself approval.
8. **When implementation state and historical reports differ, the current `main` branch and the latest verified repository state take precedence; historical reports remain historical evidence and must not be rewritten to make them current.**
