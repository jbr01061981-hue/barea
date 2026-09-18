# BAREA

BAREA (Grow in Faith) is a synchronized church quiz platform designed for Sunday schools, youth ministries, Bible study groups, and church-wide fellowship events.

**Current production architecture:** Cloudflare Workers + D1 + Durable Objects, with `growinfaith.app` as the owner-designated production domain. Local development uses Wrangler/local D1. Production does not use a VPS, Windows PC server, Cloudflare Tunnel, Neon/PostgreSQL, or direct `node:sqlite`/`barea.db` persistence.

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

Authentication is real server-side authentication. **Google OAuth/OIDC is the current individual login mechanism**, implemented with state, PKCE S256, nonce, cryptographic ID-token verification, server-side OAuth transactions, replay/expiry protection, explicit account-collision handling, secure cookies, and server-authoritative sessions.

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
- `docs/DATABASE.md` — frozen relational database schema, indexes, triggers, relationships, lifecycle, and SQLite/D1 boundary.
- `docs/ROADMAP.md` — current phase roadmap, implementation status, and frontend milestone sequence.
- `docs/DECISIONS.md` — architecture decision records.
- `docs/FRONTEND_PROGRESS.md` — frontend implementation sequence, current status, and verification evidence.
- `AGENTS.md` — development guidance and repository guardrails.

---

## Current Implementation Status

### Phase 1 — Unified Account & Access

**COMPLETE — REVIEWED, VERIFIED, MERGED**

PR #20, **"Unify authenticated home and remove legacy password auth,"** is merged into `main` as commit `298eccbabc7090531c9c31c2bc94c79592d11edb`.

The merged milestone establishes:
- Unified authenticated `/home` for all authenticated users.
- Google-only individual authentication; legacy email/password authentication is no longer an active login mechanism.
- Hardened Google OAuth/OIDC with PKCE S256, state and nonce validation, strict cryptographic ID-token verification, server-side OAuth transaction handling, replay/expiry protection, atomic transaction consumption, explicit account-collision handling, secure transient cookies, return-to protection, and token-exchange timeout protection.
- Server-authoritative sessions, teacher/admin authorization boundaries, and authoritative logout/session invalidation.
- Create & Host capability presentation with server-side authorization remaining authoritative.
- Host protection preventing a live-session host from joining their own session as a normal participant.

### Logout / Browser History / bfcache Hardening

**COMPLETE — REVIEWED, VERIFIED, MERGED**

PR #22, **"fix(auth): harden logout history restoration,"** is merged into `main` as commit `345f72d0f86de61373a6ed080a42372492ab017b` using a standard merge commit.

The milestone adds:
- Logout history replacement using `RedirectType.replace`.
- Restrictive cache headers for `/home` and `/teacher/*` protected surfaces.
- A minimal server-authoritative `/api/auth/session` validity probe returning only `{ authenticated: true }` or `{ authenticated: false }`.
- `HistoryBfcacheGuard` protection for authenticated navigation restored from browser Back/Forward Cache.
- Synchronous suppression of authenticated shells before the session probe completes.
- Fail-closed invalid-session handling and server-authoritative reload behavior on probe/network failure.
- Stale-probe race protection.
- Authenticated shell coverage for global navigation, `/home`, and the teacher workspace.
- Eight dedicated `LOGOUT-HISTORY` regression tests covering invalidation, protected access, history replacement, cache headers, session-probe minimization, guard lifecycle, race handling, and shell coverage.

Final PR #22 verification:
- `npm test` — **263/263 PASS**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **CLEAN**
- No LAN OAuth changes from PR #21 entered `main` through PR #22.

### Mobile LAN Development

**PR #21 — APPROVED / OPEN / NOT YET MERGED**

PR #21 (`c040ec7e2ee5d92e5950d8b4886bda191e4fcbfe`) addresses mobile LAN development when Next.js is bound to `0.0.0.0`. It adds explicit `BAREA_DEV_APP_URL` origin resolution, prevents `0.0.0.0` from being emitted as a browser redirect destination, fails closed when no explicit development origin is available, and allows the LAN origin through Next.js `allowedDevOrigins` for HMR/Fast Refresh.

PR #21 verification:
- `npm test` — **259/259 PASS**
- `npm run typecheck` — **PASS**
- `npm run build:next` — **PASS**
- `git diff --check` — **PASS**

**Google Web OAuth limitation:** Do not register a private LAN IP such as `https://192.168.1.7:3000/api/auth/callback/google` as the Web OAuth redirect URI. Use the LAN origin for mobile UI/responsive development, but use an approved hostname such as local `https://localhost:3000` for complete Google OAuth testing until a suitable development hostname/tunnel is available.

### Cloudflare HTTPS Validation

**DEFERRED — CUSTOM DOMAIN REQUIRED**

Cloudflare discovery confirmed that the current Cloudflare account has no active DNS zones/domains and no existing named tunnel. The existing `berea-api-production.jbr01061981.workers.dev` service is a separate backend/legacy Worker and remains untouched.

No Cloudflare DNS, tunnel, Worker, or Google OAuth configuration was modified. A future stable public HTTPS/OAuth test can proceed when a suitable custom domain is available. An ephemeral Quick Tunnel may be used for non-OAuth connectivity smoke testing, but it is not the authoritative Google OAuth validation path.

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


---

## Future Platform Capabilities

BAREA's architecture deliberately reserves the following future capabilities without making them current MVP dependencies:

- **Transactional email** for registration, invitations, quiz participation/completion, results, and future resource notifications. Delivery will be asynchronous and auditable.
- **Product analytics** through server-authoritative events, with privacy/data minimization and separation from technical observability.
- **Advertising and monetization** as a future option; ads must not interrupt synchronized live gameplay or become part of authoritative quiz/session state. Sponsorship and premium/ad-free options may also be evaluated.
- **Worship/music content** including song lyrics, licensed sing-along lyric videos, downloadable video, and stem-based music tracks for church singing without live instruments. Large media will use R2 when implemented and requires appropriate licensing.

These capabilities are future directions and should be implemented only through authorized milestones.
