# AGY — BAREA-006 SHARE/JOIN — DESIGN GATE & MULTI-AGENT REVIEW

## STATUS

**BAREA-005 is COMPLETED — MERGED.**

Begin **BAREA-006 Share/Join design work only**. Do not implement application code until the design gate has passed independent review and received an explicit GO.

Current roadmap boundary:
- BAREA-006: Share/Join — NOT STARTED
- BAREA-007: Live Quiz — NOT STARTED
- BAREA-008+: NOT STARTED

BAREA-006 scope from `docs/ROADMAP.md`:
- session creation with room access codes;
- dynamic QR code generation for projector/mobile entry;
- low-friction mobile landing flow;
- nickname entry and validation;
- duplicate-name handling;
- session resumption.

Do **not** implement BAREA-007 live state machine, WebSockets/realtime transport, synchronized timers, scoring, leaderboard, podium, or participant game-answer APIs in this milestone.

---

# 1. MANDATORY MULTI-AGENT DESIGN CHALLENGE

Before proposing or writing implementation code, MUST use available specialized sub-agents to independently challenge the BAREA-006 design.

Use these roles:

1. **Security Architect / Red Team**
   - threat-model room codes and join URLs;
   - participant/session-token security;
   - session enumeration/brute force resistance;
   - tenant isolation;
   - authorization boundaries between teacher/host and participant;
   - nickname abuse/inappropriate input;
   - replay, fixation, impersonation, and session-resumption attacks;
   - verify that no correct answers or future live-game secrets are exposed.

2. **SQLite / Persistence Architect**
   - design session/participant persistence;
   - organization/session ownership constraints;
   - uniqueness and lifecycle rules;
   - transaction boundaries and concurrent joins;
   - room-code generation/storage;
   - token persistence or hashing strategy;
   - foreign keys, indexes, and cleanup/expiry strategy.

3. **QA / Test Architect**
   - define an adversarial test matrix before implementation;
   - duplicate nickname races;
   - invalid/expired/unknown room codes;
   - cross-tenant access;
   - session-resumption edge cases;
   - malformed runtime payloads;
   - concurrent joins;
   - deterministic randomness/time seams;
   - identify where integration tests must exercise real production repositories/services.

4. **TypeScript / Code Quality Specialist**
   - define strong domain contracts;
   - runtime validation strategy;
   - reject unsafe casts and `any` shortcuts;
   - inspect serialization boundaries;
   - identify ownership/lifecycle risks in repositories and services.

5. **Frontend / Next.js Specialist**
   - design the mobile join route and teacher/host sharing surface;
   - QR generation/rendering strategy;
   - server/client boundaries;
   - URL routing and safe navigation;
   - accessibility and mobile-first UX;
   - ensure participant pages receive only data appropriate to BAREA-006.

6. **Independent Product/Architecture Reviewer**
   - compare the proposal against `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and existing BAREA-001..005 implementation;
   - identify scope drift;
   - challenge assumptions about unauthenticated participant access;
   - provide a design GO/NO-GO recommendation.

Record only actual sub-agent participation, findings, and recommendations. **Never fabricate agent IDs, transcripts, tool results, or conclusions.**

After the initial design is revised, run the same six roles again for a **post-remediation design verification pass**.

---

# 2. REQUIRED DESIGN ARTIFACT

Create/update a dedicated design gate document:

`docs/BAREA-006-DESIGN-GATE.md`

It must be a design specification, not implementation code.

The document must define at minimum:

### A. Canonical BAREA-006 workflow

Specify the complete flow, for example:

`Published Quiz -> Host creates Share Session -> Server generates room code + join URL -> QR displayed -> Participant opens join page -> enters nickname -> server validates/normalizes -> participant identity/session token established -> participant can resume the same session`

Clearly identify which steps belong to BAREA-006 and where BAREA-007 begins.

### B. Session domain model

Define the proposed session entity and lifecycle, including:
- session ID;
- organization ID;
- published quiz ID/snapshot reference;
- room access code;
- status/lifecycle appropriate to BAREA-006;
- created/updated/expiry metadata;
- host ownership/authorization;
- any required session configuration.

Do not duplicate published quiz content unnecessarily. Sessions must reference the immutable BAREA-005 published quiz snapshot rather than mutable Question Bank data.

### C. Participant identity model

Define:
- participant ID;
- session association;
- display name rules;
- duplicate-name behavior;
- participant session token/resumption mechanism;
- token entropy and lifetime;
- whether raw tokens are persisted or only hashes/digests;
- revocation/expiry behavior.

Participant identity must remain scoped to a single session and must not become a global account system.

### D. Room code security

Specify:
- exact code alphabet;
- exact length;
- entropy target;
- generation method using a cryptographically secure RNG;
- collision handling;
- lookup behavior;
- rate limiting/brute-force considerations;
- whether codes are case-insensitive and how normalization works.

Do not use predictable IDs, timestamps, counters, or `Math.random()` as security-sensitive room-code generation.

### E. Join URL and QR contract

Define:
- canonical join URL shape;
- what data is encoded in the QR code;
- whether QR contains only the join URL/code and never a privileged token;
- URL validation and routing;
- QR generation location/library strategy;
- host/projector presentation contract.

Do not implement the BAREA-011 projector experience here; provide only the reusable share surface required by BAREA-006.

### F. Nickname validation

Define exact runtime rules:
- minimum/maximum length;
- whitespace normalization;
- Unicode handling;
- control-character rejection;
- HTML/script safety;
- inappropriate-language filtering boundary;
- duplicate comparison rules;
- whether duplicate names receive a suffix, are rejected, or require user choice.

Do not claim church-specific inappropriate-language certification in BAREA-006; BAREA-012 owns broader church validation.

### G. Session resumption

Define precisely how a participant resumes after:
- page refresh;
- browser restart;
- temporary network loss;
- reopening the join URL;
- token expiry;
- session closure/expiration.

The design must prevent one participant from resuming another participant's identity.

### H. Authorization / tenant isolation

Define separate authority boundaries for:
- teacher/host session creation;
- participant joining;
- participant session resumption;
- reading public join metadata.

Host/teacher organization identity must come from the server-authorized context, never from browser-supplied `organizationId`, `tenantId`, role, or user ID.

Participant requests must be scoped to the resolved session and participant token.

Cross-tenant session access must fail closed.

### I. Persistence and concurrency

Define:
- tables and columns;
- primary/foreign keys;
- unique constraints;
- indexes;
- transaction boundaries;
- concurrent room-code collision handling;
- concurrent duplicate-name handling;
- cleanup/expiry behavior.

Do not claim universal `BEGIN IMMEDIATE` usage unless the implementation actually adopts it. Specify the exact transaction semantics required for each race-sensitive operation.

### J. API/server-action boundaries

For every BAREA-006 route/action, define:
- caller;
- trusted server context;
- runtime input schema;
- output schema;
- sensitive fields excluded from responses;
- authorization checks;
- failure behavior.

Client input must never be trusted merely because a TypeScript interface says it is valid.

### K. Security boundary with BAREA-007

Explicitly state that BAREA-006 does **not** expose:
- answer keys;
- explanations intended to be withheld during active questions;
- live state transitions;
- authoritative timers;
- answer submission/scoring APIs;
- leaderboard data.

If a participant object contains a future session token, it must not itself authorize access to privileged quiz content.

### L. Adversarial test matrix

Define named tests, including at minimum:
- cross-tenant host session creation;
- forged organization/user/role fields;
- invalid room code;
- nonexistent room code;
- expired/closed session;
- room-code brute-force/rate-limit design boundary;
- room-code collision;
- duplicate nickname;
- duplicate nickname concurrent race;
- malformed nickname payload;
- oversized/Unicode/control-character nickname;
- XSS/script payload;
- participant token forgery;
- participant token replay across sessions;
- participant token expiry;
- session resumption after refresh/restart;
- another participant cannot resume the identity;
- host cannot access another organization's session;
- participant cannot enumerate privileged session data;
- QR contains no privileged credential;
- no BAREA-007 answer/live-state leakage.

---

# 3. DESIGN-GATE INVARIANTS

The BAREA-006 design MUST preserve all existing invariants:

- strict organization isolation;
- server-authoritative teacher/host authorization;
- runtime input validation;
- immutable BAREA-005 published quiz snapshots;
- Question Bank approval lifecycle;
- no direct mutation of published snapshots;
- no participant access to correct answers during live gameplay;
- no BAREA-007 implementation during BAREA-006;
- no weakening of existing BAREA-001..005 security boundaries.

Any proposed change to an existing ADR or architectural invariant must be explicitly documented and justified before implementation.

---

# 4. REQUIRED SUB-AGENT OUTPUT

`AGY-REPORT.md` must record:

1. each actual sub-agent role used;
2. actual findings/challenges;
3. design changes made in response;
4. second-pass verification findings;
5. unresolved observations, if any;
6. final design-gate recommendation.

Never write `APPROVED`, `GO`, or similar language unless the corresponding sub-agent actually issued that conclusion.

---

# 5. IMPLEMENTATION GATE

**DO NOT CREATE BAREA-006 APPLICATION CODE YET.**

First complete:

`BAREA-006 DESIGN -> SIX-AGENT CHALLENGE -> DESIGN REMEDIATION -> SIX-AGENT VERIFICATION -> INDEPENDENT REVIEW -> GO/NO-GO`

Only after an explicit GO may AGY create a BAREA-006 implementation branch/PR.

When implementation eventually begins:
- keep it isolated to BAREA-006;
- do not start BAREA-007;
- use production repositories/services in integration tests;
- use runtime validation at every server boundary;
- add adversarial security tests before declaring completion.

---

# 6. ROADMAP / STOP CONDITION

During design work:
- keep `BAREA-006` as **NOT STARTED** until the design gate is formally approved;
- do not mark it completed/pending implementation prematurely;
- do not modify BAREA-007 status.

When the design gate is complete:

**STOP and await independent review.**

Do not implement code.

Final required sequence:

`BAREA-006 DESIGN -> SUB-AGENT CHALLENGE -> REMEDIATION -> SUB-AGENT VERIFICATION -> INDEPENDENT REVIEW -> GO/NO-GO -> STOP`

## FINAL RULE

**The design must be independently challenged before any BAREA-006 implementation begins. Passing tests from BAREA-005 do not constitute authorization for BAREA-006 implementation.**