# AGY — BAREA-006 Share/Join — TWO-AGENT DESIGN GATE

## STATUS

**BAREA-006 IS DESIGN-ONLY. DO NOT IMPLEMENT APPLICATION CODE.**

The previous BAREA-006 design was based on anonymous participants entering nicknames. That model is now obsolete and must not be patched incrementally.

BAREA-006 must be redesigned around the clarified BAREA product model below. This prompt deliberately uses **TWO specialized agents**, not six, to reduce AGY token consumption while preserving independent security and persistence/QA review.

Current design document:
- `docs/BAREA-006-DESIGN-GATE.md`

Related product documentation:
- `docs/PRODUCT.md`

BAREA-005 is completed and merged. Do not start BAREA-007.

**ABSOLUTE RULE: ZERO BAREA-006 APPLICATION CODE until the user/ChatGPT independently reviews the completed design and gives GO.**

---

# 1. CLARIFIED PRODUCT MODEL — MANDATORY

BAREA supports two fundamentally different participation modes.

## A. TEACHER-CONTROLLED GROUP MODE

A Sunday School teacher, youth leader, or other authorized host:

- creates/selects the quiz;
- creates groups/teams;
- assigns pupils to groups;
- may have pupils who have no Google account, phone, laptop, or personal device;
- displays questions on a projector/screen;
- records or marks each group's answer through the teacher/host interface;
- controls the participating groups.

Children in this mode **do not authenticate to BAREA and do not individually join the session**.

The design must not force a child account, OAuth login, phone, QR scan, or personal device in teacher-controlled group mode.

## B. INDIVIDUAL AUTHENTICATED MODE

An individual creator or authorized organization user can publish a quiz/session for individual participation.

Participants:

- authenticate to BAREA using the existing OAuth/social-login architecture already established in the earlier BAREA login work;
- use their own BAREA/provider-backed identity;
- do not rely on a self-entered nickname as their security identity;
- may enter through a link, QR code, room code, or a future quiz invite code.

Google is an existing provider. The identity-provider architecture should remain abstract enough to support additional providers such as Facebook or X/Twitter without making provider-specific assumptions the domain cannot support.

**Never identify or authorize an individual participant by display name or an arbitrary client-supplied email/phone number.**

The canonical external identity must use the provider's stable subject/identifier (`sub` or equivalent), mapped to a BAREA identity/account.

---

# 2. ADMISSION POLICY — SEPARATE FROM PARTICIPATION MODE

Do not conflate "how the quiz is played" with "who may enter".

The design must support an explicit admission policy independently from participation mode.

At minimum define:

### TEACHER_ASSIGNED

For teacher-controlled group mode. The teacher determines group membership. Pupils do not individually authenticate or join.

### OPEN

For individual authenticated mode. Anyone who can reach the published quiz/session can attempt to participate, subject to normal BAREA authentication and anti-abuse controls.

### INVITED / RESTRICTED

For individual authenticated mode. Only explicitly permitted people may participate.

The creator may specify allowed participants by:

- email address;
- phone number;
- or both.

The server must match an authenticated, verified identity against the stored invitation/allowlist. An arbitrary email or phone number typed by the client is **not proof of identity**.

For email admission:
- use the verified email associated with the authenticated BAREA/provider identity;
- define normalization/case rules explicitly;
- do not expose allowlist contents to other participants.

For phone admission:
- require a verified phone identity/verification mechanism;
- normalize to a defined international representation such as E.164;
- never trust an arbitrary client-entered phone number as proof of authorization.

If the existing BAREA authentication implementation has provider-specific verified-claim semantics, inspect and reuse those established semantics rather than inventing a second authentication system.

---

# 3. CREATOR / TENANT MODEL

The product now permits quizzes to be created by:

- a church/organization;
- a teacher or authorized organization member;
- an individual creator outside an organization.

The design must therefore preserve strict tenant isolation while supporting individual creators.

Prefer a model in which every account has an isolated personal workspace/tenant, while church/organization workspaces are separate tenants. Do not weaken existing organization isolation merely to support personal creators.

The design must explicitly answer:

- who owns a quiz/session;
- who may publish it;
- who may configure admission;
- how organization users are authorized;
- how personal workspaces are isolated;
- how a session references an immutable BAREA-005 published quiz snapshot;
- how cross-tenant snapshot/session references fail closed.

Do not expose whether another tenant's quiz/snapshot/session exists.

---

# 4. ENTRY MECHANISMS

The design must treat entry mechanisms as transport/discovery mechanisms, not authorization mechanisms.

Support/design for:

1. **QR code**
2. **Direct/shareable URL**
3. **Room/session access code**
4. **Future quiz invite code**

The future invite-code feature may be **designed but not implemented in BAREA-006**.

Mandatory security invariant:

> Entry mechanism does not determine authorization.

A room code, QR code, URL, or future invite code must never bypass the configured admission policy, authentication requirement, or invitation allowlist.

For future invite codes, define where the code resolves and how it is bound to the quiz/session, but do not implement a second authorization system around the code.

Do not resurrect the old anonymous-nickname security model merely because a room code is used.

---

# 5. SCHEDULED START

The quiz creator may optionally specify a future start time.

BAREA-006 must define and persist the schedule metadata needed for this capability, including an unambiguous timezone/UTC representation and validation of scheduling boundaries.

However:

- BAREA-006 must not implement the live quiz state machine;
- BAREA-006 must not implement authoritative question timers;
- BAREA-006 must not implement real-time transport;
- the authoritative `LOBBY -> ACTIVE` transition remains a BAREA-007 responsibility;
- BAREA-007 may later use the stored scheduled start time to transition the session automatically.

The design must define what participants see before the scheduled start and what happens at/after the scheduled boundary without implementing live gameplay.

---

# 6. CHURCH WI-FI / NAT REQUIREMENT

This is mandatory.

Many legitimate participants may share one public IP address through church Wi-Fi, carrier NAT, school Wi-Fi, or a family hotspot.

Therefore:

**Do NOT impose a hard successful-participant-per-IP quota.**

IP address is an anti-abuse signal, not a participant identity.

Rate limiting may use IP, subnet, session, identity, room code, endpoint, and other bounded dimensions as appropriate, but legitimate users behind the same NAT must be able to participate.

The design must explain how a malicious actor is constrained without blocking a congregation sharing one public IP.

Avoid global kill switches that allow one attacker to disable joining for unrelated sessions.

---

# 7. INDIVIDUAL IDENTITY MODEL

For authenticated individual mode:

- reuse the existing BAREA OAuth/login foundation;
- map provider identity to a BAREA account;
- use stable provider subject/identifier as identity;
- do not use display name as identity;
- do not use email as the sole immutable identity key unless the existing identity architecture explicitly guarantees the required semantics;
- define provider-account linking/unlinking considerations;
- define behavior when the provider email/display name changes;
- define duplicate/rejoin behavior for the same authenticated identity in the same session;
- prevent two participant records for the same canonical identity in one session unless the product explicitly supports multiple seats/accounts, which it currently does not.

Display names may be shown to hosts/participants where appropriate, but they are presentation data and must not become an authorization primitive.

Duplicate display names are therefore allowed. Security must never depend on adding `(2)`, `(3)`, etc. to a name.

---

# 8. TEACHER GROUP MODEL

Design explicit domain concepts for:

- teacher-controlled group/team;
- group membership/assigned pupil;
- session group roster;
- teacher authorization to create/update/delete groups and assignments;
- teacher recording/marking a group's answer;
- protection against a child or public participant invoking teacher/group operations.

The design must distinguish:

**Teacher identity** from **pupil membership/seat identity**.

A pupil assignment is not an OAuth account.

Do not require persistent BAREA accounts for children merely to represent a group member.

Do not implement live answer/scoring mechanics in BAREA-006; define only the identity/authorization boundary necessary for BAREA-007 and later milestones.

---

# 9. PRIVACY REQUIREMENTS

The design must explicitly protect:

- participant email addresses;
- participant phone numbers;
- invitation/allowlist entries;
- provider subject identifiers;
- authentication/session credentials.

These must never be exposed in public join responses, participant rosters visible to other participants, QR payloads, room-code responses, or projector views.

Only the minimum safe presentation identity should be exposed, such as a display name.

Define safe error behavior so an unauthorized user cannot use the join/admission endpoint to enumerate invited email addresses, phone numbers, accounts, or private quizzes.

---

# 10. ROOM CODE / INVITE CODE SECURITY

If room/session codes remain six characters, preserve a cryptographically generated unambiguous alphabet and collision-safe persistence constraints.

However, do not assume a short room code is itself an authentication credential.

Define:

- lookup behavior;
- anti-enumeration controls;
- rate limiting with bounded blast radius;
- session binding;
- expiration/recycling rules;
- generic failure responses.

For the future quiz invite code:

- explicitly mark it as FUTURE / NOT IMPLEMENTED;
- define that it maps to a quiz/session invitation context rather than granting universal authority;
- define that restricted sessions still require authenticated identity and allowlist authorization;
- define that the code alone cannot impersonate another user or bypass admission.

---

# 11. PERSISTENCE DESIGN

The design must specify a coherent SQLite model for the redesigned architecture.

At minimum reason about:

- quiz sessions;
- immutable published quiz snapshot reference;
- creator/owner/workspace/tenant;
- participation mode;
- admission policy;
- scheduled start;
- individual participant identity binding;
- teacher-controlled groups;
- pupil/group assignments;
- invitation/allowlist records;
- session/group authorization boundaries;
- room-code uniqueness;
- future invite-code reservation/design if appropriate.

Maintain:

- `PRAGMA foreign_keys = ON`;
- WAL/busy timeout where appropriate;
- transactional integrity;
- direct persistence constraints where practical;
- cross-tenant integrity;
- bounded state.

Do not duplicate organization IDs merely because it is convenient. If denormalized tenant fields are required, define the invariant and enforce it.

---

# 12. SECURITY / RATE LIMITING

Use layered, bounded anti-abuse controls.

Consider dimensions such as:

- trusted client IP;
- endpoint;
- session/room;
- authenticated identity;
- tenant/workspace;
- invitation lookup;
- failed authentication/admission attempts.

Requirements:

- no hard successful-participant-per-IP quota;
- no attacker-controlled global kill switch;
- bounded memory/state;
- deterministic test seams;
- generic errors for unauthorized/private resources;
- concurrency-safe accounting;
- trusted proxy/IP extraction only at a defined deployment boundary.

Do not treat arbitrary `X-Forwarded-For` or similar client-controlled headers as trusted identity.

---

# 13. BAREA-006 STRICT BOUNDARY

BAREA-006 is Share/Join/session-entry architecture only.

It may design/persist the information needed for later live gameplay, but must not implement:

- live quiz state machine;
- authoritative question progression;
- live answer submission;
- live scoring;
- leaderboard/podium;
- WebSockets;
- SSE;
- Socket.IO;
- synchronized countdown/timer authority;
- projector live gameplay state;
- BAREA-007 implementation.

The only exception is that BAREA-006 may persist scheduled-start metadata and define the contract that BAREA-007 will later use.

---

# 14. TWO-AGENT WORKFLOW — MANDATORY

Do NOT launch six agents. Do NOT launch twelve agents.

Use exactly **TWO specialized sub-agents** for the BAREA-006 design challenge.

## Agent 1 — SECURITY + ARCHITECTURE RED TEAM

Independently challenge:

- OAuth/OIDC identity binding;
- provider subject handling;
- account linking edge cases;
- verified email/phone invitation bypass;
- allowlist enumeration;
- teacher/group privilege escalation;
- child/pupil account assumptions;
- tenant/workspace isolation;
- room-code enumeration;
- future invite-code bypass;
- QR/link security;
- scheduled-start boundary;
- replay/session fixation;
- authentication/session credential handling;
- privacy leakage;
- church Wi-Fi/NAT behavior;
- rate limiting and denial-of-service;
- trusted proxy/IP spoofing;
- BAREA-006 vs BAREA-007 boundary.

The agent must identify concrete contradictions, missing invariants, and adversarial scenarios. It must not approve merely because the design sounds plausible.

## Agent 2 — PERSISTENCE + QA / IMPLEMENTABILITY REVIEWER

Independently challenge:

- domain model completeness;
- SQLite schema and foreign keys;
- tenant/workspace ownership;
- session/quiz snapshot integrity;
- individual identity uniqueness;
- group/member assignment integrity;
- invitation allowlist storage and normalization;
- email/phone verification representation;
- room-code uniqueness/collision handling;
- scheduled-start persistence;
- transactions and concurrency;
- rate-limit state boundedness;
- deterministic test seams;
- testability of authorization boundaries;
- migration/backward-compatibility impact on BAREA-005;
- exact adversarial tests required for implementation;
- whether the design can actually be implemented without silently inventing missing rules.

The agent must identify concrete schema, transaction, testing, or implementability defects.

## Agent independence

Agents must review independently before AGY synthesizes their findings.

Record only actual agent participation and findings. Never fabricate IDs, transcripts, tools, or conclusions.

---

# 15. DESIGN REMEDIATION

After the two agents report:

1. AGY must synthesize the findings.
2. Resolve every blocker in `docs/BAREA-006-DESIGN-GATE.md`.
3. Update the design coherently rather than adding isolated patches.
4. Ensure the new model replaces the obsolete anonymous nickname architecture.
5. Preserve BAREA-005 compatibility and tenant/security invariants.
6. Add explicit adversarial tests/specifications for every blocker.

Do not write application source code.

---

# 16. TWO-AGENT SECOND-PASS VERIFICATION — MANDATORY

After remediation, launch the **same TWO agents again**, independently.

### Agent 1 second pass
Re-audit all security/architecture findings and every changed boundary.

### Agent 2 second pass
Re-audit persistence/QA/implementability and every changed schema/test requirement.

The second pass must specifically verify:

- teacher-controlled groups without child authentication;
- authenticated individual identity using existing BAREA OAuth foundation;
- open vs invited/restricted admission;
- verified email/phone matching;
- no identity based on nickname/display name;
- personal workspace + organization tenant isolation;
- link/QR/room code/future invite-code separation from authorization;
- scheduled-start contract without live-state implementation;
- church Wi-Fi/NAT compatibility;
- bounded rate limiting;
- privacy guarantees;
- cross-tenant persistence integrity;
- exact BAREA-006 boundary.

If either agent finds a blocker, fix the design and repeat the two-agent verification. Do not implement.

Do not add additional agents unless explicitly authorized by the user.

---

# 17. REQUIRED ADVERSARIAL TEST MATRIX

The final design must specify tests covering at least:

### Authentication / identity
- provider subject spoofing;
- forged client email;
- forged client phone;
- unverified email attempting restricted admission;
- unverified phone attempting restricted admission;
- provider identity mismatch;
- account-linking confusion;
- same authenticated identity joining twice;
- changed provider display name/email behavior;
- session credential replay.

### Admission
- open session accepts authenticated individual;
- restricted session rejects non-allowlisted identity;
- restricted session accepts correctly verified allowlisted identity;
- generic errors prevent allowlist enumeration;
- invite code cannot bypass restricted admission;
- room code cannot bypass restricted admission.

### Teacher groups
- authorized teacher creates group;
- unauthorized user cannot create group;
- teacher assigns pupil;
- unauthorized user cannot change assignment;
- pupil has no required BAREA login/device;
- group membership is session-scoped;
- group operations cannot cross tenant/session boundaries.

### Tenant/security
- cross-tenant snapshot reference rejected;
- cross-tenant session access rejected;
- personal workspace isolation;
- organization isolation;
- private quiz/session enumeration prevented;
- email/phone/provider identifiers never appear in public responses.

### Entry mechanisms
- QR contains no secrets;
- canonical URL construction cannot be host-header poisoned;
- room-code normalization/enumeration protection;
- future invite-code contract does not grant authority by itself.

### NAT/rate limiting
- dozens of legitimate participants behind one IP can join when otherwise authorized;
- attacker cannot exhaust a global limiter to disable unrelated sessions;
- per-IP anti-abuse controls still function;
- identity/session limits remain bounded;
- spoofed forwarding headers cannot bypass controls.

### Scheduling / boundary
- invalid scheduled time rejected;
- timezone/UTC representation is deterministic;
- pre-start session remains non-active;
- BAREA-006 cannot transition live gameplay state;
- BAREA-007 receives a clear scheduled-start contract.

### Persistence/concurrency
- room-code collision;
- duplicate identity race;
- group assignment race;
- invitation insertion/update race;
- tenant integrity at persistence level;
- transaction rollback leaves no partial authorization state;
- bounded rate-limit state.

---

# 18. DOCUMENTATION REQUIRED

Update the following files as part of the design-only task:

- `docs/BAREA-006-DESIGN-GATE.md`
- `docs/PRODUCT.md`
- `AGY-REPORT.md`

Do not modify application source files.

`docs/PRODUCT.md` must accurately describe:

- teacher-controlled group quizzes;
- authenticated individual quizzes;
- open and restricted/invited admission;
- verified email/phone invitations;
- existing OAuth/social login foundation;
- creator/organization/personal-workspace model;
- QR/link/room-code entry;
- future quiz invite-code capability;
- optional scheduled start;
- distinction between participation mode and admission policy.

`AGY-REPORT.md` must record:

1. the two-agent pre-remediation findings;
2. exact design corrections;
3. the two-agent post-remediation findings;
4. remaining non-blocking observations, if any;
5. final design recommendation;
6. confirmation that ZERO BAREA-006 application code was written.

Never claim implementation has begun.

---

# 19. FINAL DESIGN-GATE CHECKLIST

Before stopping, verify:

- [ ] obsolete anonymous nickname architecture removed from the proposed model;
- [ ] teacher-controlled group mode defined;
- [ ] no child authentication/device requirement in group mode;
- [ ] individual authenticated mode defined;
- [ ] existing BAREA OAuth foundation explicitly reused;
- [ ] stable provider subject is canonical identity;
- [ ] display name is not an authorization primitive;
- [ ] admission policy separated from participation mode;
- [ ] OPEN policy defined;
- [ ] INVITED/RESTRICTED policy defined;
- [ ] verified email allowlisting defined;
- [ ] verified phone allowlisting defined;
- [ ] allowlist privacy/enumeration protection defined;
- [ ] personal workspace + organization tenant model defined;
- [ ] strict tenant/snapshot integrity defined;
- [ ] QR/link/room-code entry defined;
- [ ] future quiz invite code explicitly reserved without implementation;
- [ ] invite/room code cannot bypass authorization;
- [ ] optional scheduled start defined;
- [ ] BAREA-007 owns LOBBY -> ACTIVE;
- [ ] no live gameplay implementation;
- [ ] church Wi-Fi/NAT requirement satisfied;
- [ ] no hard successful-participant-per-IP quota;
- [ ] bounded layered rate limiting defined;
- [ ] trusted proxy boundary defined;
- [ ] privacy requirements defined;
- [ ] SQLite schema/transactions defined;
- [ ] adversarial tests cover the new architecture;
- [ ] two-agent pre-remediation review completed;
- [ ] two-agent post-remediation review completed;
- [ ] PRODUCT.md updated;
- [ ] AGY-REPORT.md updated;
- [ ] ZERO application code written.

---

# 20. STOP CONDITION

If both second-pass agents find no blocker and the design is internally consistent:

**STOP — DO NOT IMPLEMENT.**

Return:

- final design-gate commit SHA;
- Agent 1 pre-remediation findings;
- Agent 2 pre-remediation findings;
- exact design remediation summary;
- Agent 1 second-pass findings;
- Agent 2 second-pass findings;
- final design status;
- confirmation of zero BAREA-006 application code.

The next step is the user's/ChatGPT's independent review.

If any blocker remains:

**DO NOT IMPLEMENT.** Fix the design and repeat the two-agent verification.

## FINAL SEQUENCE

`INDEPENDENT DESIGN NO-GO → 2-AGENT CHALLENGE → DESIGN REMEDIATION → 2-AGENT VERIFICATION → USER/CHATGPT INDEPENDENT REVIEW → GO/NO-GO → IMPLEMENTATION`
