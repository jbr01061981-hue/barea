# AGY — BAREA-006 Share/Join — DESIGN GATE REMEDIATION

## STATUS

**BAREA-006 DESIGN GATE IS NO-GO FOR IMPLEMENTATION.**

The independent review found seven targeted design issues. Do NOT write BAREA-006 application code until these are remediated and independently re-verified.

Current design:
- `docs/BAREA-006-DESIGN-GATE.md`
- Branch: `main`
- Design commit reported: `7232218`

BAREA-005 remains completed and merged. Do not start BAREA-007.

---

# 1. MANDATORY SIX-AGENT REMEDIATION CHALLENGE

Before modifying the design, use six specialized sub-agents independently:

1. **Security / Red Team**
   - challenge join flooding and rate-limit bypass;
   - trusted proxy/IP spoofing;
   - snapshot/organization authorization;
   - participant token/cookie security;
   - nickname abuse and collision attacks;
   - session lifecycle and host/participant privilege separation.

2. **SQLite / Persistence Architect**
   - verify organization-to-snapshot integrity;
   - join capacity and nickname collision atomicity;
   - WAL/busy_timeout/BEGIN IMMEDIATE semantics;
   - lazy expiration and room-code recycling;
   - transaction boundaries and state_version;
   - identify any concurrency assumptions that are not actually guaranteed by SQLite.

3. **QA / Test Architect**
   - turn every finding below into explicit adversarial tests;
   - identify missing join-flood, IP-spoofing, cookie, nickname-suffix, tenant-integrity and lifecycle tests;
   - require deterministic ClockProvider, RoomCodeGenerator and rate-limit seams;
   - verify tests exercise production paths after implementation.

4. **TypeScript / Code Quality Specialist**
   - review branded types and runtime validation;
   - review server-action input/output contracts;
   - inspect nickname and generated-suffix typing;
   - require zero unsafe `any` in implementation;
   - challenge ambiguous domain/error semantics.

5. **Frontend / Next.js Security Specialist**
   - review participant cookie attributes;
   - sessionStorage/cookie interaction;
   - public `/join` boundary;
   - QR/join URL construction;
   - trusted proxy assumptions;
   - ensure no BAREA-007 live functionality leaks into the design.

6. **Independent Architecture/Product Reviewer**
   - compare the complete design against BAREA-005, ADRs, roadmap and church-use requirements;
   - challenge all seven findings and identify additional contradictions;
   - provide an independent final recommendation.

Record only actual sub-agent participation and findings. Never fabricate IDs, transcripts or conclusions.

---

# 2. MANDATORY DESIGN CORRECTIONS

## Finding 1 — JOIN FLOODING / ADMISSION ABUSE

The current design rate-limits room-code lookup and join endpoints, but does not sufficiently define protection against repeated joins using a known valid room code and many different nicknames.

Add an explicit admission-control design covering:

- per-IP join-attempt limit;
- per-session join-attempt limit;
- successful-join accounting where appropriate;
- interaction with maxParticipants;
- exact response behavior when throttled;
- fail-closed behavior;
- bounded memory/state for the limiter;
- deterministic test seam.

Do not introduce CAPTCHA as a normal church-user requirement. If an escalation mechanism is specified, it must preserve low-friction normal joining.

Add explicit adversarial coverage for valid-room-code join flooding.

---

# 3. FINDING 2 — TRUSTED PROXY / IP EXTRACTION

The current design says to use `CF-Connecting-IP` / `X-Forwarded-For` with fallback, but does not define which proxy is trusted.

Specify:

- authoritative deployment/proxy boundary;
- which header is trusted;
- that arbitrary client-supplied forwarding headers cannot override the trusted identity;
- behavior when the trusted header is absent;
- fallback behavior;
- normalization/validation of the resulting IP identifier;
- tests proving spoofed `X-Forwarded-For` and `CF-Connecting-IP` cannot bypass rate limiting.

Do not treat arbitrary HTTP forwarding headers as trustworthy security identity by default.

---

# 4. FINDING 3 — SNAPSHOT / ORGANIZATION TENANT INTEGRITY

Make the following invariant explicit and mandatory:

> A session can reference only a published snapshot belonging to the same organization as the authorized host context.

Session creation must resolve the snapshot through the authorized organization and verify its organization identity before insertion.

Where practical, strengthen the SQLite schema with an integrity relationship preventing an inconsistent session organization/snapshot organization pair.

Define exact behavior for cross-tenant attempts: fail closed without revealing whether the other tenant's snapshot exists.

Add/retain adversarial test coverage for this invariant, including direct persistence-level integrity where feasible.

---

# 5. FINDING 4 — NICKNAME / GENERATED SUFFIX CONTRADICTION

The current user nickname regex does not allow parentheses, while collision suffixing generates names such as `Sarah (2)`.

Resolve this explicitly.

Define separately:

- raw user-input validation;
- canonical normalized nickname;
- server-generated display-name suffixing;
- normalized uniqueness key;
- final display-name length limit;
- behavior when a base name is near the 24-character maximum;
- maximum suffix `(99)` behavior;
- collision exhaustion behavior;
- transaction/unique-constraint retry behavior.

Do not silently allow arbitrary parentheses in user input merely to solve this contradiction.

Ensure generated names remain valid by the domain's own representation rules.

Add adversarial tests for:
- 24-character base nickname;
- `Sarah`, `Sarah (2)`, etc.;
- suffix collision races;
- suffix exhaustion;
- Unicode/NFKC collisions.

---

# 6. FINDING 5 — PARTICIPANT COOKIE SECURITY

The participant authentication cookie is a bearer credential.

The design must explicitly require:

- `HttpOnly`;
- `Secure` in production;
- `SameSite=Lax` (or a stronger justified policy);
- `Path=/join`;
- appropriate expiration/max-age;
- no Domain attribute unless specifically justified;
- explicit local-development/test behavior without weakening production requirements.

The cookie must never be intentionally script-readable.

Keep sessionStorage if desired for tab isolation, but clearly define precedence and reconciliation between sessionStorage and the secure cookie.

Add an adversarial/security test that verifies the emitted cookie attributes.

---

# 7. FINDING 6 — BAREA-006 LOBBY BOUNDARY

The design may model future statuses, but BAREA-006 must not become the live-state authority.

Explicitly define:

- BAREA-006 creates sessions in `LOBBY` only;
- BAREA-006 join/resume/lock/kick operations do not advance the live quiz state;
- `LOBBY -> ACTIVE` is exclusively owned by BAREA-007;
- BAREA-006 does not implement authoritative timers, question progression, answer submission, scoring, WebSockets, SSE or Socket.IO;
- if resume accepts `ACTIVE` for forward compatibility, specify that BAREA-006 merely authenticates/preserves identity and does not control the ACTIVE state.

Add a boundary test/specification preventing accidental live-state implementation.

---

# 8. FINDING 7 — GLOBAL RATE-LIMITER BLAST RADIUS

The current global sentinel (`250 consecutive invalid attempts`) could itself become a denial-of-service mechanism against legitimate users.

Redesign or precisely constrain it.

Specify:

- exact scope of the global bucket;
- whether it affects lookup only or join as well;
- threshold semantics;
- duration/cooldown;
- recovery behavior;
- whether valid requests remain possible;
- atomicity/concurrency;
- bounded memory;
- observability without leaking sensitive information.

Prefer rate limiting with bounded blast radius. A malicious actor must not trivially be able to disable joining for every church session by generating invalid requests.

Add adversarial tests for attacker-triggered limiter exhaustion and legitimate-user recovery.

---

# 9. REQUIRED SECOND-PASS CHALLENGE

After all design corrections are made, use all six agents again.

Each must specifically challenge the seven findings above and any changes caused by them.

Required second-pass roles:

- Security Red Team
- SQLite/Persistence Architect
- QA/Test Architect
- TypeScript/Code Quality Specialist
- Frontend/Next.js Security Specialist
- Independent Architecture/Product Reviewer

No implementation is authorized merely because the agents say GO. The final design must be internally consistent and demonstrably implementable.

Record actual findings only.

---

# 10. REQUIRED DESIGN-GATE CHECKLIST

Before stopping, verify that `docs/BAREA-006-DESIGN-GATE.md` explicitly contains:

- [ ] join admission rate limiting;
- [ ] trusted proxy/IP identity contract;
- [ ] session/snapshot organization integrity;
- [ ] nickname vs generated suffix semantics;
- [ ] final nickname length/suffix rules;
- [ ] secure participant cookie attributes;
- [ ] sessionStorage/cookie reconciliation;
- [ ] strict BAREA-006 lobby boundary;
- [ ] bounded global limiter/blast radius;
- [ ] deterministic test seams;
- [ ] adversarial tests for all seven findings;
- [ ] 6-agent post-remediation verification;
- [ ] zero BAREA-007 implementation;
- [ ] zero application code written.

Also check for any additional contradictions discovered by the second-pass agents.

---

# 11. DOCUMENTATION

Update:

- `docs/BAREA-006-DESIGN-GATE.md`
- `AGY-REPORT.md`

Do not modify application source files.

The report must include:

1. initial seven independent findings;
2. pre-remediation six-agent findings;
3. exact design changes;
4. post-remediation six-agent findings;
5. exact remaining non-blocking observations, if any;
6. final design recommendation;
7. confirmation that ZERO BAREA-006 application code was written.

Never claim that implementation has begun.

---

# 12. STOP CONDITION

If all seven findings are fully addressed and the second six-agent review finds no blocker:

**STOP — DO NOT IMPLEMENT.**

Return:

- design-gate commit SHA;
- six-agent pre-remediation summary;
- seven remediation results;
- six-agent post-remediation summary;
- final design status;
- confirmation of zero application code.

The next step will be my independent review.

If any blocker remains:

**DO NOT IMPLEMENT.** Fix only the design and repeat the six-agent verification.

## FINAL SEQUENCE

`INDEPENDENT NO-GO → 6-AGENT CHALLENGE → DESIGN REMEDIATION → 6-AGENT VERIFICATION → USER INDEPENDENT REVIEW → GO/NO-GO → IMPLEMENTATION`
