# BAREA Frontend Progress

> **Frontend source of truth:** This file records implemented UI stages, verified repository state, and the agreed sequence for future frontend work. GitHub `main` remains the authoritative code source.

## Current status

| Stage | Frontend scope | Status | GitHub reference |
|---|---|---|---|
| AUTH / PR #15 | Real account authentication, server sessions, login flow | **BACKEND FOUNDATION MERGED** | PR #15 / `acfca79` |
| BAREA-008 | Public homepage / landing foundation | **MERGED** | `9b76e9f` / PR #12 |
| BAREA-008A | Public homepage visual redesign + public entry UX | **IN PROGRESS** | `barea-008a-public-entry` / PR #13 |
| BAREA-009 | Teacher Workspace / Quiz Library redesign | **NEXT** | Not started |
| BAREA-010 | Quiz Builder / Question UX | Planned | Not started |
| BAREA-011 | Teacher Review / Question Bank UX | Planned | Not started |
| BAREA-012 | Share Quiz / Join experience | Planned | Not started |
| BAREA-013 | Host Lobby | Planned | Not started |
| BAREA-014 | Participant mobile quiz | Planned | Not started |
| BAREA-015 | Live Host Console | Planned | Not started |
| BAREA-016 | Results / Leaderboard | Planned | Not started |
| BAREA-017 | Presentation / Projector experience | Planned | Not started |

## Authentication foundation — completed

PR #15 established the real application authentication boundary used by future frontend experiences:

- Email/password registration and authentication.
- Google OAuth / OpenID Connect authentication.
- Cryptographic OIDC verification and required claim validation.
- OAuth state, S256 PKCE, and nonce protection.
- Safe account provisioning and account linking.
- Server-authoritative persisted sessions with secure HttpOnly browser cookies.
- Server-side identity binding; frontend route state and client-supplied identifiers do not grant authorization.
- Logout/session revocation.

Authentication is therefore an existing backend dependency and must be reused by subsequent frontend stages rather than mocked or replaced.

## Account and teacher capability contract

- A registered user is a normal BAREA account, not automatically a teacher.
- Individual authenticated participation does not require teacher capability or organization membership.
- Teacher/Host capability is separate, server-authoritative, and disabled by default for newly registered users.
- Teacher UI must not imply that registration alone grants teacher access.
- Personal workspace access uses the server-authoritative personal tenant model when applicable.
- Organization workspace access requires authoritative membership/role.
- Individual quiz visibility/entry is based on the authenticated BAREA user plus server-side assignment/admission state.
- Anonymous nickname-only individual participation is prohibited.

## BAREA-008A — Public homepage visual redesign + public entry UX

**Status: IN PROGRESS**

Purpose: implement the approved Stitch visual direction while keeping the homepage simple, responsive, Scripture-centered, and honest about authentication state.

### Design reference

The implementation is based on the user-provided Google Stitch export for the BAREA homepage (`Scriptural Editorial` direction).

Key visual decisions carried into the frontend:
- Deep midnight / indigo background for the public homepage.
- Warm ivory Scripture typography.
- Restrained liturgical gold accent.
- Editorial serif treatment for Scripture and major headings.
- Fine borders and tonal layering instead of heavy shadows or decorative SaaS effects.
- One responsive homepage system across mobile, tablet, laptop, and desktop; not separate site designs.
- Projector/presentation remains a separate future experience.

### Homepage implementation

- Hero uses a dedicated client-side Scripture typewriter component with additional breathing room and larger Scripture treatment.
- Scripture cycles through:
  - `Let the Word dwell richly.` — Colossians 3:16
  - `Your word is a lamp to my feet.` — Psalm 119:105
  - `Is not my word like fire?` — Jeremiah 23:29
- Each verse types character-by-character, pauses, deletes, and transitions to the next verse.
- The cycle is continuous as requested.
- A restrained gold cursor and Scripture reference reinforce the animation without adding visual clutter.
- Hero message is intentionally short: `Prepare. Learn. Share.`
- Primary homepage action is `Explore BAREA`.
- General `Log in` entry is used instead of teacher-only login wording.
- No fake OAuth/provider flow or credentials are requested/simulated.
- `The BAREA rhythm` is concise: Prepare → Verify → Play, with one short sentence per step.
- Human-review messaging is simplified to `Human review. Thoughtful preparation.`
- Whole-room experiences are framed as `Host`, `Participant`, and `Sanctuary Display`.
- Closing CTA is intentionally single-action: `Bring your church together around the Word.` / `Explore BAREA`.

### Public entry boundary

- Public UI must reuse the real authentication/session foundation established by PR #15.
- The frontend must not invent a fake login, fake OAuth flow, client-only identity, or teacher-role toggle.
- General `Log in` wording remains appropriate because an account is not inherently a teacher account.
- Teacher UI must be shown only when the backend reports the required server-authoritative teacher capability.

### Files changed on the frontend branch

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/components/scripture-typewriter.tsx`

### Verification

A final local verification is required after pulling the latest branch:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run build:next`
- visual review at mobile and laptop/desktop widths
- reduced-motion/accessibility review

Do not mark BAREA-008A complete until final local verification is reported.

## BAREA-008 — Homepage

**Status: MERGED**

Merged into `main` via PR #12.

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

## Sequencing rule

Progressively expose the completed capabilities through purpose-built experiences:

`Homepage → Real Auth → Teacher Capability/Workspace → Quiz Builder/Question UX → Review/Question Bank → Share/Join → Host Lobby → Participant → Live Host → Results → Projector`

## Product architecture principles

- This chat/workspace is for frontend development and frontend testing only.
- BAREA is not a generic CRUD/admin dashboard.
- Teacher/Host experience is desktop/tablet oriented.
- Participant experience is mobile-first.
- Presentation experience is projector/large-screen oriented.
- Frontend is not a security boundary.
- Backend/session state remains authoritative.
- Never invent backend APIs or silently alter backend/security/domain contracts to support a frontend feature.
- If a frontend experience depends on backend capability that does not yet exist, record it as a frontend dependency/backend gap.
- GitHub `main` and the implementation in the repository are the source of truth; this progress document records frontend sequence and evidence.
