# AGY — BAREA-006 Share/Join — PRODUCT-ALIGNED DESIGN GATE

## STATUS

**BAREA-006 IS DESIGN-ONLY. DO NOT WRITE APPLICATION CODE.**

The product model has materially changed since the previous BAREA-006 design. The old anonymous nickname-based participant design is obsolete and MUST NOT be patched incrementally.

BAREA-005 remains completed and merged. Do not start BAREA-007 implementation.

Primary design document:
- `docs/BAREA-006-DESIGN-GATE.md`

Product source of truth to align with:
- `docs/PRODUCT.md`

Before implementation, redesign BAREA-006 around the product model below, then perform the required multi-agent challenge and verification. The final stop point is another design gate awaiting the user's independent review.

---

# 1. PRODUCT MODEL — MANDATORY

BAREA supports two fundamentally different participation modes.

## A. TEACHER-CONTROLLED GROUP QUIZ

A Sunday School teacher/host may create groups and assign pupils to groups.

Children/pupils:
- do NOT need BAREA accounts;
- do NOT need Google/social login;
- may have no phone, laptop, or other device;
- do NOT directly join through the public join page;
- do NOT authenticate as individual participants.

The teacher/host:
- creates the quiz/session;
- creates named groups/teams;
- assigns pupils to groups;
- displays questions on a screen/projector;
- records/marks each group's answer through the authorized host interface;
- is the authoritative operator for group participation.

The design must support teacher-controlled group identity and membership without inventing child accounts.

## B. INDIVIDUAL AUTHENTICATED QUIZ

An individual may participate using their own BAREA account.

Authentication:
- reuse the existing BAREA OAuth/social-login architecture already established by the project;
- do not invent a second incompatible authentication system;
- Google is an existing provider; design the participant identity boundary so additional providers such as Facebook or X/Twitter can be supported later without changing the domain identity model;
- canonical identity MUST use the provider's stable subject/identifier, not a display name;
- verified email/phone claims must come from the trusted authentication/verification boundary, never from arbitrary client input.

The participant may enter through:
- QR code;
- shareable link;
- room/session access code;
- a future quiz invite code.

Entry mechanism is NOT authorization. All entry paths must converge on the same admission-policy checks.

---

# 2. ADMISSION POLICY — SEPARATE FROM PARTICIPATION MODE

Do NOT conflate "who participates" with "how they participate".

The design MUST define an explicit admission policy, at minimum:

1. `TEACHER_ASSIGNED`
   - used for teacher-controlled group mode;
   - teacher determines group membership;
   - no child authentication required.

2. `OPEN`
   - authenticated individual quiz;
   - anyone who reaches the quiz through a valid share/join mechanism may attempt to participate, subject to session state, capacity and abuse controls;
   - authentication is still required for individual participation.

3. `INVITED_ALLOWLIST`
   - authenticated individual quiz;
   - creator specifies allowed participants by email and/or phone number;
   - participant must authenticate through the trusted BAREA identity boundary;
   - allowlist matching MUST use verified identity attributes only;
   - arbitrary client-entered email/phone MUST NEVER establish authorization.

The design may use different names for these values, but the separation and semantics are mandatory.

---

# 3. CREATOR / TENANT MODEL

The current implementation is organization-centric, but the product requirement is broader: a church/organization can create quizzes, and an individual creator may also create and publish a quiz.

The design MUST resolve this cleanly without weakening tenant isolation.

Prefer a unified workspace/tenant model in which a personal workspace can behave as a tenant, rather than introducing authorization exceptions for individuals.

Explicitly define:
- creator identity;
- organization/workspace ownership;
- personal creator ownership;
- teacher authorization;
- cross-tenant isolation;
- who may create/publish sessions;
- who may manage groups and participants.

Do not silently assume every quiz belongs to a church organization.

---

# 4. SESSION / QUIZ ENTRY MODEL

The session design should continue to support:
- immutable published quiz snapshot from BAREA-005;
- secure share URL;
- QR code;
- short human-entered access code;
- future quiz invite code;
- safe public session metadata;
- capacity and lifecycle controls.

### Future invite-code requirement

Design an extension point for a **quiz invite code**, but do not implement the invite-code feature in BAREA-006 unless it is already within the approved milestone scope.

The future invite code MUST be treated as an entry credential/discovery mechanism, not as a replacement for authentication or authorization.

When eventually implemented:
- invite code resolves to the intended quiz/session/invitation context;
- the same admission policy still applies;
- restricted quizzes cannot be bypassed merely by knowing the code;
- code entropy, brute-force resistance, expiration/revocation and replay semantics must eventually be defined;
- do not expose answers or private participant information through code lookup.

Document the future extension point and keep implementation out of this milestone.

---

# 5. INDIVIDUAL IDENTITY MODEL

Replace the old anonymous nickname-as-identity model.

For authenticated individual participation:
- participant identity is the authenticated BAREA user identity;
- provider identity is represented by a stable provider subject;
- display name is presentation data, NOT an authorization key;
- duplicate display names are allowed;
- display-name suffixing MUST NOT be required for security;
- email and phone are sensitive identity attributes and MUST NOT appear in public participant rosters;
- participants must not be able to impersonate another account by entering their display name.

Define session participation uniqueness so the same authenticated identity cannot create multiple active participant records for the same session merely by changing display name, provider presentation, or browser storage.

Define secure rejoin/resume semantics for authenticated participants.

If a session-bound credential is retained for transport/resumption, it must supplement—not replace—the authenticated identity boundary.

---

# 6. RESTRICTED EMAIL / PHONE ADMISSION

The design MUST support creator-managed allowlists for individual quizzes.

Email:
- normalize according to a clearly documented canonical comparison policy;
- require a trusted verified email identity claim before authorization;
- do not authorize from an arbitrary form field;
- define behavior for case differences and provider email changes;
- do not expose allowlist entries to other participants.

Phone:
- normalize to a documented canonical/E.164 representation;
- require trusted verification before authorization;
- do not authorize from arbitrary client-entered phone numbers;
- define provider/verification boundary and behavior when phone is unverified or unavailable;
- do not expose phone numbers to participants.

If the existing BAREA OAuth layer does not yet provide verified phone identity, the design MUST explicitly identify the verification mechanism required before phone-based restricted admission can be considered secure. Do not pretend an OAuth profile phone field is automatically verified.

Allowlist checks must be server-authoritative and fail closed.

Add adversarial cases for:
- forged email;
- forged phone;
- unverified email;
- unverified phone;
- Unicode/canonicalization edge cases;
- provider subject mismatch;
- account/provider-link changes;
- allowlist bypass through room code, QR, URL or future invite code.

---

# 7. TEACHER GROUP MODEL

Design a first-class group/team model for teacher-controlled sessions.

At minimum define:
- group/team ID;
- session ownership;
- group name/display name;
- membership/assigned pupil representation;
- teacher authorization boundary;
- group ordering if required by the UI;
- lifecycle behavior when groups/members are changed;
- privacy boundaries.

Do not create persistent child BAREA accounts merely to model pupils.

Define how a teacher can record/mark a group's answer while preventing unauthorized participants from changing group answers.

Do not implement live scoring or question progression in BAREA-006. The design may identify the future answer-recording boundary for BAREA-007 or later milestones.

Explicitly distinguish:
- group membership/roster data;
- host-entered group answer data;
- future live answer/scoring state.

---

# 8. SCHEDULING / AUTOMATIC START

A creator may optionally specify a scheduled start time for a quiz session.

BAREA-006 MUST define storage, validation, timezone/UTC semantics, display semantics and authorization for `scheduledStartAt` (or equivalent).

However, preserve the milestone boundary:
- BAREA-006 creates/configures the session and schedule;
- BAREA-007 owns the authoritative `LOBBY -> ACTIVE` live-state transition and gameplay scheduler;
- BAREA-006 must not implement live timers, question progression, answer submission, scoring, WebSockets, SSE or Socket.IO;
- if the design needs a scheduler responsibility, specify it as a future BAREA-007 responsibility rather than implementing it here.

Define boundary behavior for:
- start time in the past;
- session already closed;
- locked session;
- timezone/DST conversion;
- duplicate scheduler execution;
- host manually starting before scheduled time, if permitted by product policy.

---

# 9. CHURCH WI-FI / NAT — CRITICAL CORRECTION

Do NOT impose a hard successful-participant quota per public IP.

Churches commonly place many legitimate participants behind one NAT/public IP. IP address is an anti-abuse signal, not a participant identity.

Therefore:
- remove any design requirement such as "maximum 5 successful joins per session per IP";
- IP-based controls may limit abusive request rates/failed attempts;
- legitimate authenticated identities must not be rejected merely because many people share one public IP;
- use identity/session/room/request dimensions where appropriate;
- retain bounded resource protection against automated flooding.

Add an adversarial test demonstrating that many legitimate authenticated participants behind one public IP can join up to the configured session capacity.

---

# 10. RATE LIMITING / ABUSE CONTROL

Redesign admission protection around layered controls rather than IP-as-identity.

Consider separately:
- room-code lookup attempts;
- join attempts;
- authenticated identity attempts;
- session/resource capacity;
- invitation/allowlist probing;
- future invite-code brute force;
- IP/subnet abuse signals.

Specify:
- exact scope;
- threshold/window;
- failure behavior;
- bounded memory/state;
- concurrency/atomicity;
- legitimate-user recovery;
- no global kill switch that lets one attacker disable every church session.

Do not make CAPTCHA a normal church-user requirement.

Use the existing trusted-proxy design only after clearly defining the authoritative proxy boundary.

---

# 11. TRUSTED AUTHENTICATION / PROVIDER BOUNDARY

The design must explicitly separate:

`browser claim -> trusted BAREA authentication session -> canonical BAREA user -> provider subject / verified identity attributes -> admission decision`

Never:
- trust a posted `userId`;
- trust a posted provider subject;
- trust a posted email/phone;
- use display name as identity;
- allow a room/invite code to bypass authenticated authorization.

The design should reuse the existing BAREA OAuth login architecture rather than duplicate it.

Additional social providers may be added behind a provider abstraction later.

---

# 12. ROOM CODE / QR / FUTURE INVITE CODE

Keep the useful properties of the previous design:
- cryptographically generated room/session code;
- unambiguous alphabet where appropriate;
- collision handling;
- canonical join URL;
- QR contains only safe discovery information;
- base URL is not derived from an untrusted Host header;
- lookup errors do not disclose private quiz/session data.

But distinguish clearly:
- room/session access code;
- future quiz invite code;
- authenticated BAREA identity;
- authorization/admission policy.

Do not collapse them into one credential concept.

---

# 13. PRIVACY

Define safe public versus authenticated/host-only projections.

Public join/lookup MUST NOT expose:
- participant email;
- participant phone;
- OAuth provider subject;
- internal user IDs unless explicitly safe;
- allowlist entries;
- private organization data;
- question answer keys.

Host-only views may expose only the participant/group information needed to operate the session.

Individual participants must not be able to enumerate invitees or restricted users.

---

# 14. BAREA-006 LIVE-STATE BOUNDARY

Strictly preserve the milestone boundary:

BAREA-006 may design and persist session setup, entry, admission, identity anchoring, groups and scheduling metadata.

BAREA-006 MUST NOT implement:
- authoritative live quiz state machine;
- `LOBBY -> ACTIVE` transition;
- question progression;
- authoritative timers/countdowns;
- participant answer submission;
- scoring;
- standings/leaderboards/podium;
- WebSockets;
- SSE;
- Socket.IO;
- live projector gameplay state.

BAREA-007 owns the live gameplay state machine and automatic-start execution boundary.

---

# 15. REQUIRED SIX-AGENT DESIGN CHALLENGE

Before finalizing the redesigned design document, use six specialized sub-agents independently:

1. **Security / Red Team**
   - OAuth/provider spoofing;
   - verified email/phone bypass;
   - allowlist bypass;
   - room-code/future invite-code abuse;
   - cross-tenant access;
   - group/teacher privilege escalation;
   - identity duplication/replay;
   - church NAT behavior;
   - privacy leaks;
   - rate-limit abuse.

2. **Identity / Authentication Architect**
   - reuse of existing BAREA OAuth login;
   - provider subject identity;
   - account/provider linking;
   - verified email semantics;
   - phone verification boundary;
   - rejoin/resume;
   - logout/provider changes;
   - future multi-provider support.

3. **SQLite / Persistence Architect**
   - tenant/workspace ownership;
   - session-to-snapshot integrity;
   - group/member persistence;
   - allowlist persistence;
   - authenticated participation uniqueness;
   - schedule fields and indexes;
   - transaction/concurrency semantics;
   - future invite-code extension without schema traps.

4. **QA / Test Architect**
   - convert every requirement into adversarial tests;
   - test production authorization paths;
   - test same-IP legitimate participants;
   - test allowlist normalization;
   - test provider spoofing;
   - test group authorization;
   - test scheduling boundaries;
   - test future invite-code non-bypass assumptions.

5. **TypeScript / Next.js Security Specialist**
   - server/client identity boundaries;
   - action input/output contracts;
   - safe public projections;
   - cookie/session handling;
   - route boundaries;
   - no unsafe `any`;
   - no accidental live-state implementation.

6. **Independent Architecture/Product Reviewer**
   - compare the redesigned model with `docs/PRODUCT.md`, BAREA-004/005, roadmap and milestone boundaries;
   - challenge whether group and authenticated individual modes can coexist cleanly;
   - challenge organization versus personal creator ownership;
   - identify contradictions or missing product decisions.

Record actual sub-agent participation and findings only. Never fabricate IDs, transcripts or conclusions.

---

# 16. REQUIRED DESIGN DOCUMENT CONTENT

`docs/BAREA-006-DESIGN-GATE.md` must explicitly contain:

- [ ] two participation modes: teacher-controlled group and authenticated individual;
- [ ] separate admission policies;
- [ ] existing BAREA OAuth reuse;
- [ ] stable provider-subject identity;
- [ ] verified email/phone allowlist semantics;
- [ ] personal creator/workspace support without tenant-isolation exceptions;
- [ ] teacher group/team model without child accounts;
- [ ] teacher-only group management/recording boundary;
- [ ] QR/link/room-code entry;
- [ ] future quiz invite-code extension point, explicitly not implemented now;
- [ ] invite code cannot bypass admission/authentication;
- [ ] authenticated participant uniqueness and resume semantics;
- [ ] duplicate display names allowed without security suffixing;
- [ ] church-NAT-safe rate limiting;
- [ ] trusted proxy boundary;
- [ ] bounded anti-abuse controls;
- [ ] optional scheduled start metadata;
- [ ] BAREA-007 ownership of automatic live start;
- [ ] privacy-safe projections;
- [ ] tenant/workspace integrity;
- [ ] immutable BAREA-005 snapshot reference;
- [ ] adversarial test matrix;
- [ ] no BAREA-006 application code;
- [ ] no BAREA-007 implementation.

---

# 17. REQUIRED SECOND-PASS VERIFICATION

After redesign/remediation, run all six agents again:

- Security / Red Team
- Identity / Authentication Architect
- SQLite / Persistence Architect
- QA / Test Architect
- TypeScript / Next.js Security Specialist
- Independent Architecture/Product Reviewer

Each must explicitly challenge the final design against all requirements above and any new findings from the first pass.

No implementation is authorized merely because the agents say GO.

---

# 18. DOCUMENTATION UPDATE

Update:
- `docs/BAREA-006-DESIGN-GATE.md`
- `AGY-REPORT.md`
- `docs/PRODUCT.md` if product-level clarification is needed

Do not modify application source files.

The report must include:
1. the obsolete assumptions being replaced;
2. first-pass six-agent findings;
3. exact design changes;
4. second-pass six-agent findings;
5. remaining non-blocking observations;
6. final design recommendation;
7. confirmation that ZERO BAREA-006 application code was written.

---

# 19. STOP CONDITION

If blockers remain:

**DO NOT IMPLEMENT.** Fix only the design and repeat the six-agent verification.

If the redesigned specification is internally consistent and the second six-agent verification finds no blocker:

**STOP — DO NOT IMPLEMENT.**

Return:
- final design-gate commit SHA;
- first-pass six-agent summary;
- remediation summary;
- second-pass six-agent summary;
- final design status;
- confirmation of zero application code.

The next step is the user's independent review and GO/NO-GO.

## FINAL SEQUENCE

`PRODUCT CLARIFICATION → DESIGN REDESIGN → 6-AGENT CHALLENGE → DESIGN REMEDIATION → 6-AGENT VERIFICATION → USER INDEPENDENT REVIEW → GO/NO-GO → IMPLEMENTATION`
