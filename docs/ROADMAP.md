# BAREA — Project Roadmap

## 1. Phase 1 — Unified Account & Access

**Status: COMPLETE — PR #15 MERGED**

BAREA now has a real authentication and server-session foundation. Authentication establishes identity; it does not automatically grant teacher/host capability.

### Implemented authentication flow

- One canonical BAREA user identity.
- Email/password registration and authentication.
- Google OAuth / OpenID Connect authentication.
- Cryptographic Google ID-token verification with required OIDC claim validation.
- Secure OAuth authorization-code flow with state protection, S256 PKCE, and nonce protection.
- Safe Google account provisioning and federated-identity persistence.
- Safe account linking using trusted verified identity data; provider stable subject remains the federated identity anchor.
- Server-authoritative persisted sessions using an HttpOnly session cookie.
- Session identity is resolved server-side and is not established by client-supplied user identifiers.
- Logout/session revocation support.
- Production callback configuration and environment separation.
- Authentication and authorization failure paths fail closed.

### Account, participant, teacher and workspace contract

- A newly registered/authenticated user is a normal BAREA account, not automatically a teacher.
- Individual authenticated participation does not require organization membership or teacher capability.
- Teacher/Host capability is a separate server-authoritative capability and is **disabled by default for newly registered users**.
- Client routes, request parameters, organization IDs, roles, or UI state cannot grant teacher capability.
- A future trusted qualification/entitlement/approval mechanism may enable teacher capability; that mechanism is not part of Phase 1.
- Personal workspaces use the canonical isolated tenant model `usr_ten_<user_id>` when applicable.
- Organization workspace access requires authoritative organization membership/role.
- Individual quiz assignment/admission is bound to the authenticated BAREA user.
- Anonymous nickname-only individual participation is prohibited.

### Security verification

Phase 1 authentication was reviewed and hardened for cryptographic OIDC verification, claim validation, nonce/PKCE/state binding, safe account linking, transactional provisioning, server-side session identity binding, fail-closed environment separation, and removal of caller-controlled authorization seams.

---

## 2. Phase 2 — Share, Join & Live Quiz

**Status: NEXT MAJOR PRODUCT PHASE**

### 2.1 Shareable Access & Join Authorization

1. Authorized creator creates and publishes a quiz.
2. System provides the applicable share URL, QR code, and access code.
3. Participant enters through QR, URL, or access code.
4. Participant authenticates when authenticated individual participation is required.
5. Server resolves the canonical BAREA user and configured admission policy.
6. Server checks assignment/admission, session lifecycle, capacity, and scheduled-start rules.
7. Participant joins only after server authorization.

**Deliverable:** A real person can get from the church entry mechanism to an authorized quiz join without anonymous nickname-only authorization.

### 2.2 Synchronized Live Quiz

Build the server-authoritative church gameplay: host lobby, synchronized participants, authoritative timers, answer submission, host controls, live state updates, server validation, question progression, completion, and realistic concurrent-participant testing.

**Deliverable:** A congregation can play together while the authorized host controls the session.

---

## 3. Phase 3 — Results & Leaderboard

**Status: PLANNED**

Finalize authoritative scores, participant/host results, leaderboard, and post-quiz completion experience.

---

## 4. Phase 4 — Unified Question Creation

**Status: PLANNED**

Improve unified question creation and reuse while preserving the persistent Question Bank and mandatory human review gate.

---

## 5. Phase 5 — Landing Experience

**Status: PLANNED**

Provide truthful general sign-in, clear participant entry, clear teacher/host entry only when capability is available, and natural paths to create, sign in, and join.

---

## 6. Phase 6 — Church Pilot & Feedback

**Status: PLANNED**

Run BAREA with a real congregation, observe joining/live use/results/usability, collect feedback, fix the highest-value issues, and re-test.

---

## Roadmap rules

- Git repository state is authoritative for implementation status.
- Future milestones must reuse the existing authentication/session boundary rather than create a second identity system.
- Account identity, teacher capability, organization membership, personal workspace ownership, and quiz participation are separate concepts.
- Teacher capability is server-authoritative and disabled by default for newly registered users.
- Client/UI state and client-supplied identity, role, tenant, organization, creator, or participant identifiers never establish authorization.
- Participation mode and admission policy remain separate.
- Teacher-controlled group participation may use pupils without BAREA accounts; authenticated individual participation requires a canonical authenticated BAREA identity.
- Server-authoritative timing and answer/secret protection remain mandatory for live-quiz milestones.

## Historical implementation mapping

| Milestone | Scope | Status |
|---|---|---|
| BAREA-002A | TypeScript Migration Gate | COMPLETED |
| BAREA-003 | AI Quiz Generation | COMPLETED |
| BAREA-004 | Teacher Review/Approval | COMPLETED — MERGED |
| BAREA-005 | Quiz Authoring | COMPLETED — MERGED |
| BAREA-006 | Share/Join foundation | COMPLETED — MERGED |
| BAREA-007 | Live Quiz foundation | COMPLETED — MERGED |
| PR #15 | Unified Account & Access / real authentication foundation | COMPLETED — MERGED |

The historical milestone identifiers remain for repository traceability; the phase sequence above is the current product roadmap.