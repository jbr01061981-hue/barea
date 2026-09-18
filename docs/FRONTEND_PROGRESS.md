# BAREA Frontend Progress

> **Frontend source of truth:** This file records implemented UI stages, verified repository state, and the agreed sequence for future frontend work. **GitHub `main` remains the authoritative code source.**

## Current status

**Main baseline:** PR #26 merged on 2026-09-18 as `21450c3df9c3adfefd8bef7ef59a07c07f946f33`.

PR #20 established the unified authenticated home, Google-only authentication, hardened OAuth flow, and server-authoritative session handling. PR #22 completed logout/browser-history/bfcache hardening; PR #23 and PR #24 completed repository/database stabilization; PR #25 added the database architecture reference; and PR #26 completed the Teacher Workspace MVP.

### PR #22 — Logout / Browser History / bfcache Hardening

**Status: COMPLETE / REVIEWED / VERIFIED / MERGED**

Merge commit: `345f72d0f86de61373a6ed080a42372492ab017b`

The implementation improvements now present on `main` include:
- `logoutAction` uses `RedirectType.replace` after server-side session revocation and cookie deletion.
- Protected `/home` and `/teacher/*` routes emit restrictive `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, and `Expires: 0` headers.
- New `/api/auth/session` provides a minimal server-authoritative session-validity probe and returns only `{ authenticated: true }` or `{ authenticated: false }`.
- New `HistoryBfcacheGuard` detects `pageshow` events restored from bfcache and synchronously suppresses authenticated shells before probing the server.
- Active sessions restore authenticated shells only after a successful server probe.
- Invalid/revoked sessions remain hidden and are redirected with `window.location.replace('/login')`.
- Probe/network failure reloads through the normal server-authoritative route checks.
- Sequence tracking prevents stale asynchronous probes from restoring a superseded history state.
- Authenticated shell coverage includes global authenticated navigation, `/home`, and the teacher workspace.
- Regression tests `LOGOUT-HISTORY-01` through `LOGOUT-HISTORY-08` cover session invalidation, protected access, history replacement, cache rules, probe data minimization, production guard behavior, race conditions, and shell markers.

Final verification after cleanup and merge:
- `npm test` — **263 passing / 0 failing**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **CLEAN**
- Standard merge commit used; no squash or rebase.
- Only the intended eight implementation/test files entered `main` through PR #22.
- LAN OAuth changes from PR #21 were not introduced by PR #22 and remain isolated in PR #21 / `barea-dev-lan-origin`.

The core security invariant is preserved: logout revokes the server-side session, and browser history, reload, direct navigation, or stale bfcache state cannot resurrect that session as an authenticated/usable BAREA page. Some mobile OS/compositor gesture snapshots remain outside JavaScript control; this is a platform rendering limitation, not an authorization mechanism.

## Mobile LAN Development

**PR #21 — APPROVED / OPEN / NOT YET MERGED**

PR #21 (`c040ec7e2ee5d92e5950d8b4886bda191e4fcbfe`) addresses mobile LAN development when Next.js is bound to `0.0.0.0`. It adds explicit `BAREA_DEV_APP_URL` origin resolution, prevents `0.0.0.0` from being emitted as a browser redirect destination, fails closed when no explicit development origin is available, and allows the LAN origin through Next.js `allowedDevOrigins` for HMR/Fast Refresh.

PR #21 verification:
- `npm test` — **259 passing / 0 failing**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **PASS**

**Google Web OAuth limitation for LAN development:** Do not register a private LAN IP such as `https://192.168.1.7:3000/api/auth/callback/google` as the Web OAuth redirect URI. LAN IP access is appropriate for mobile UI/responsive development, but complete Google OAuth testing must use an approved hostname such as local `https://localhost:3000` until a suitable development hostname/tunnel is available.

PR #21 remains a branch/PR state and must not be described as part of `main` until separately merged and verified.

## Milestone sequence

| Stage | Frontend scope | Status | Repository state |
|---|---|---|---|
| Phase 1 / Auth | Unified authenticated identity/session + Google-only login + hardened OAuth + unified `/home` | **COMPLETE / MERGED** | PR #20 merged; further logout/history hardening merged via PR #22 |
| Logout / History | Logout replacement + bfcache/session restoration privacy hardening | **COMPLETE / MERGED** | PR #22 merged as `345f72d` |
| Mobile LAN Dev | Explicit development origin + LAN HMR/origin resolution | **APPROVED / PR OPEN** | PR #21 `c040ec7`; not yet merged to `main` |
| BAREA-008 | Public homepage / landing foundation | **MERGED** | Present on `main` |
| BAREA-008A | Public homepage visual redesign + public entry UX | **MERGED** | Present on `main` |
| BAREA-008B | Public homepage refinement | **CURRENT / DESIGN REFINEMENT** | Dedicated 008B branches; not merged to `main` |
| BAREA-009 | Teacher Workspace / Quiz Library redesign | **COMPLETE / REVIEWED / VERIFIED / MERGED** | PR #26 merged to `main` as `21450c3` |
| BAREA-010 | Quiz Builder / Question UX | **NEXT** | Not started |
| BAREA-011 | Teacher Review / Question Bank UX | Planned | Not started |
| BAREA-012 | Share Quiz / Join experience | Planned | Not started |
| BAREA-013 | Host Lobby | Planned | Not started |
| BAREA-014 | Participant mobile quiz | Planned | Not started |
| BAREA-015 | Live Host Console | Planned | Not started |
| BAREA-016 | Results / Leaderboard | Planned | Not started |
| BAREA-017 | Presentation / Projector experience | Planned | Not started |

## Phase 1 / Unified Authentication & Access — COMPLETE

**Status: COMPLETE — REVIEWED, VERIFIED, MERGED**

PR #20 completed the unified authentication/access milestone. The current `main` additionally includes PR #22 logout/history hardening.

Established user-facing and access behavior includes:
- Google-only federated individual authentication.
- No active email/password authentication flow.
- Unified authenticated `/home` rather than a separate participant landing page.
- Individual workspace presentation for authenticated users.
- Create & Host capability presentation with a locked state when teacher authorization is unavailable.
- Server-side teacher/admin authorization remains authoritative; the frontend lock is not a security boundary.
- Authenticated users without teacher/admin authorization are not redirected into a teacher workspace by normal login.
- Authoritative logout and session invalidation.
- Multiple tabs/windows/devices remain allowed; no blanket single-session restriction is introduced.
- Workspace query parameters are UI state only and cannot grant privileges.
- Host cannot participate in their own real live session as a normal participant.
- Preview/test behavior remains distinct from real participant admission.

### OAuth verification status

The merged implementation includes:
- PKCE S256.
- State and nonce validation.
- Strict Google ID-token verification and JWKS handling.
- Server-side OAuth transaction lifecycle.
- Transaction replay and expiry protection.
- Atomic transaction consumption and session creation.
- No silent email-based Google account linking; account collisions are explicitly rejected.
- Fresh session token creation.
- Secure transient OAuth/session cookies.
- Return-to/open-redirect protection.
- Google token exchange timeout protection.

Local HTTPS browser verification completed successfully against `https://localhost:3000`, including Google login, callback, authenticated home, workspace navigation, logout, second login, and post-logout session invalidation.

## BAREA-009 — Teacher Workspace / Quiz Library

**Status: COMPLETE — REVIEWED / VERIFIED / MERGED**

PR #26 was independently reviewed and merged to `main` on 2026-09-18 as `21450c3df9c3adfefd8bef7ef59a07c07f946f33`.

The MVP implementation introduces a server-authorized Teacher Workspace landing page at `/teacher` and makes it the entry point for the existing Create & Host capability.

Implemented scope:
- Server-side teacher authorization before any workspace data is loaded.
- Workspace summary for draft quizzes, published quizzes, and questions awaiting teacher review.
- Recent quiz list linked to the existing quiz editor/inspector routes.
- Quick actions for quiz creation and question review.
- Existing Quiz Library remains the authoritative quiz-management surface.
- Existing Question Review remains the authoritative human-review surface.
- Create & Host navigation now enters `/teacher` instead of bypassing the workspace.
- No new database tables, APIs, authentication flows, authorization mechanisms, or live-session behavior were introduced.
- No client-supplied organization or role data is used to establish authorization.

The implementation is intentionally MVP-sized: it composes existing backend/domain capabilities rather than creating a new dashboard data layer.

Independent AGY review verified scope, authorization, tenant isolation, accessibility structure, tests, typechecks, build, and diff cleanliness. No correction was required.

**Next frontend milestone: BAREA-010 — Quiz Builder / Question UX.**

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

## Infrastructure validation status

Cloudflare public HTTPS validation is now the next operational step using the owner-designated domain `growinfaith.app`. Deployment has not yet been provisioned or modified by this documentation update.

The intended deployment topology remains Cloudflare Edge → Cloudflare Tunnel → private Node.js Next.js origin. The existing `berea-api-production.jbr01061981.workers.dev` service is a separate backend/legacy Worker and remains untouched.

A stable HTTPS/OAuth validation will use `growinfaith.app` after DNS and tunnel configuration is verified. Ephemeral Quick Tunnels remain suitable only for non-OAuth connectivity smoke testing.

## Open human/design decisions

Before implementing the next major workspace redesign or generating new live-session screens, resolve any still-open design decisions documented in the applicable design sources, including the Teacher Workspace theme decision, Stitch project allocation, and formal live-session role-route convention. Do not silently convert an exploratory design proposal into an implementation contract.
