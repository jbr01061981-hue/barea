# AGY — BAREA-006 IMPLEMENTATION AUTHORIZATION

## AUTHORIZATION

BAREA-006 design review is complete. The previous personal-workspace tenant inconsistency has been resolved using **Option A**.

**IMPLEMENTATION IS AUTHORIZED.**

AGY may now implement BAREA-006 Share/Join, subject to every constraint below.

## 1. TENANT / SNAPSHOT INVARIANT — MANDATORY

BAREA-005 remains unchanged.

The existing BAREA-005 `quizzes.organization_id` and `published_quiz_snapshots.organization_id` remain the authoritative tenant identity.

A personal workspace MUST be represented by a deterministic, isolated personal tenant ID compatible with that existing `organization_id` column (for example `usr_ten_<user_id>`). An organization workspace uses its existing organization tenant ID.

For every BAREA-006 session:

- `session.organization_id` is the authoritative tenant ID.
- The referenced BAREA-005 published snapshot MUST belong to exactly that same tenant ID.
- Personal A cannot reference Personal B's snapshot.
- Personal cannot reference an organization snapshot.
- Organization cannot reference a personal snapshot.
- Organization A cannot reference Organization B's snapshot.
- The invariant must be enforced server-side and at the persistence boundary where practical.
- Client-supplied workspace/organization identifiers must never establish authorization.

Do NOT introduce a second incompatible ownership model or silently migrate/generalize BAREA-005.

## 2. PARTICIPATION MODES

Implement exactly these modes:

### TEACHER_GROUP

- Teacher/authorized host creates groups and assigns pupils.
- Pupils do not need BAREA accounts, OAuth, phones, laptops, or personal devices.
- Teacher operates the quiz and later records group answers through the appropriate later milestone.
- Group/pupil operations require host authorization.

### INDIVIDUAL_AUTHENTICATED

- Participant authenticates through the existing BAREA OAuth/social-login foundation.
- Canonical identity is the provider stable subject mapped to the BAREA user account.
- Never trust a client-supplied email, phone, display name, or provider subject.
- Duplicate display names are allowed.
- One canonical participant identity may not create multiple seats in the same session unless a future requirement explicitly changes this.

## 3. ADMISSION POLICIES

Keep admission separate from participation mode:

- `TEACHER_ASSIGNED`
- `OPEN`
- `RESTRICTED`

Restricted admission must use server-verified identity claims. Email must be normalized consistently; phone must use verified E.164 identity. Never treat arbitrary client-entered contact information as proof of authorization.

Unauthorized admission failures must not enumerate private allowlist entries, users, emails, phones, quizzes, or sessions.

## 4. ENTRY MECHANISMS

QR code, direct URL, room code, and any future invite code are discovery/transport mechanisms only.

They MUST NOT bypass authentication or admission policy.

Room codes must be cryptographically generated, collision-safe, and protected against enumeration.

Do not resurrect anonymous nickname authorization.

## 5. CHURCH WI-FI / NAT

Do NOT impose a hard successful-participant-per-IP quota.

Many legitimate participants may share one public IP. IP may be used as an anti-abuse signal, together with endpoint/session/identity dimensions, but must not become participant identity.

Rate limiting must have bounded blast radius and no attacker-controlled global kill switch.

Trusted proxy/IP extraction must be explicit; arbitrary client-controlled forwarding headers are not trusted identity.

## 6. PRIVACY

Never expose these through public lookup, join responses, participant views, or projector-facing data:

- provider subject identifiers;
- private email addresses;
- phone numbers;
- invitation/allowlist contents;
- host credentials or session credentials;
- internal tenant identifiers where not required for presentation.

Expose only the minimum safe presentation data.

## 7. SCHEDULED START

Persist validated UTC scheduled-start metadata.

BAREA-006 does NOT implement the authoritative live transition. BAREA-007 owns `LOBBY -> ACTIVE`, authoritative timers, real-time transport, answers, scoring, and live gameplay.

## 8. STRICT BAREA-006 BOUNDARY

Do NOT implement:

- live quiz state machine;
- authoritative question progression;
- participant answer submission;
- live scoring;
- leaderboards/podium;
- WebSockets/SSE/Socket.IO;
- synchronized countdown authority;
- projector live gameplay;
- BAREA-007.

BAREA-006 implements Share/Join/session-entry architecture and the persistence/security contracts required for those capabilities.

## 9. REQUIRED SECURITY / PERSISTENCE TESTS

Before declaring implementation complete, test at minimum:

- cross-personal snapshot rejection;
- personal↔organization snapshot rejection;
- organization A↔organization B snapshot rejection;
- session tenant/snapshot immutability;
- cross-tenant session IDOR rejection;
- personal/organization authorization tampering;
- concurrent cross-tenant creation rollback with no orphan records;
- room-code enumeration resistance;
- restricted admission bypass attempts;
- forged client email/phone/provider-sub rejection;
- unverified contact rejection;
- duplicate authenticated identity rejection;
- teacher/group privilege escalation;
- privacy leakage;
- NAT-safe joining without successful-per-IP seat quota;
- trusted-proxy/IP spoofing defenses;
- participant-token replay/session fixation defenses;
- scheduled-start validation;
- exact BAREA-006 boundary enforcement.

The already-defined ADV-TNT-01 through ADV-TNT-11 findings/tests must remain represented in the implementation test plan where applicable.

## 10. TWO-AGENT REVIEW DISCIPLINE

For implementation review, use exactly the established TWO specialized agents unless the user explicitly authorizes additional agents:

1. Security + Architecture Red Team
2. Persistence + QA / Implementability Reviewer

They must independently review implementation before synthesis. Any blocker must be remediated and re-reviewed by the same two agents.

Do not fabricate agent participation, test results, CI results, or approvals.

## 11. FINAL STOP / REPORTING

When implementation is complete:

- run the relevant test suite;
- run typecheck/build checks;
- report exact results;
- report changed files and commit/PR;
- report any limitations honestly;
- do not claim GO from ChatGPT unless ChatGPT has independently reviewed the implementation.

**Current status: IMPLEMENTATION AUTHORIZED — proceed with BAREA-006 only.**
