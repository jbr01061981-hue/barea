# AGY — BAREA-006 POST-IMPLEMENTATION INDEPENDENT REVIEW

## STATUS

BAREA-006 implementation is complete on branch `barea-006-share-join`, reported commit `1f1ee3f`.

**DO NOT MERGE TO `main` yet.**

ChatGPT/user has authorized implementation, but merge authorization remains a separate gate. The implementation must now undergo a fresh, independent post-implementation review.

Do not treat the implementation report or the two-agent GO as sufficient by themselves. Review the actual code and tests at the implementation commit.

---

# 1. MANDATORY REVIEW MODEL

Use exactly **TWO specialized agents** again:

### Agent 1 — SECURITY + ARCHITECTURE RED TEAM

Independently inspect the actual implementation for:

- authentication and authorization correctness;
- provider-sub/user identity binding;
- restricted admission and verified email/phone claims;
- client-input spoofing;
- session fixation/replay;
- participant duplicate/rejoin behavior;
- teacher/group privilege escalation;
- personal vs organization tenant isolation;
- BAREA-005 published snapshot ownership;
- IDOR/cross-session access;
- room-code enumeration;
- QR/direct-link security;
- privacy and information leakage;
- rate limiting and church Wi-Fi/NAT behavior;
- trusted proxy/IP handling;
- concurrency/TOCTOU concerns;
- BAREA-006 vs BAREA-007 boundary violations;
- accidental answer/correct-option leakage.

The agent must inspect implementation code, not merely documentation or test names.

### Agent 2 — PERSISTENCE + QA / IMPLEMENTABILITY REVIEWER

Independently inspect:

- SQLite schema and migrations;
- foreign keys and relational invariants;
- BAREA-005 compatibility;
- `organization_id` tenant invariant;
- personal tenant mapping (`usr_ten_<user_id>`);
- snapshot/session integrity triggers;
- immutable fields;
- uniqueness constraints;
- transaction boundaries and concurrent capacity handling;
- rate-limit state and boundedness;
- test completeness and determinism;
- build/typecheck/test evidence;
- error handling and rollback behavior;
- whether implementation silently invents behavior not authorized by the design.

Agents must review independently before synthesis.

Do not add more agents unless explicitly authorized.

---

# 2. ACTUAL CODE REVIEW — MANDATORY

Review the implementation commit itself:

`1f1ee3f`

Compare it against:

- `docs/BAREA-006-DESIGN-GATE.md`
- `AGY-IMPLEMENTATION-AUTHORIZATION.md`
- completed BAREA-005 implementation
- BAREA-006 requirements and adversarial test matrix

Do not approve solely from AGY-REPORT.md.

For every important security invariant, identify the exact implementation location and corresponding test.

---

# 3. CRITICAL TENANT INVARIANT

The following invariant is mandatory:

> Every BAREA-006 session's authoritative `organization_id` must identify the same tenant as the referenced BAREA-005 published quiz snapshot's `organization_id`.

Personal workspaces use the Option-A deterministic personal tenant representation and must remain compatible with BAREA-005.

Verify that this is enforced server-side and at the SQLite persistence boundary, not merely by TypeScript types or caller discipline.

Attempt to find a path allowing:

- Personal A → Personal B snapshot;
- Personal → Organization snapshot;
- Organization → Personal snapshot;
- Organization A → Organization B snapshot;
- session tenant mutation after creation;
- snapshot reference mutation after creation;
- cross-tenant session management.

Any successful bypass is a blocker.

---

# 4. PARTICIPATION / ADMISSION SECURITY

Verify both modes independently.

### TEACHER_GROUP

- children require no BAREA account;
- children require no OAuth;
- children require no phone/device;
- only authorized host can create/manage groups;
- only authorized host can assign/remove pupils;
- public/participant identity cannot invoke teacher operations;
- group membership is session-scoped.

### INDIVIDUAL_AUTHENTICATED

- provider stable subject maps to canonical BAREA identity;
- arbitrary client email/phone/display name cannot establish identity;
- restricted admission requires verified identity claims;
- unverified identities fail closed;
- allowlist contents cannot be enumerated;
- duplicate authenticated identity does not create multiple seats;
- rejoin/resumption does not create an authorization bypass.

---

# 5. ENTRY / ROOM-CODE SECURITY

Verify that:

- QR code is only a discovery mechanism;
- direct URL is only a discovery mechanism;
- room code is not authentication;
- room code cannot bypass RESTRICTED admission;
- room-code probing is rate limited;
- failures are generic enough to avoid useful enumeration;
- session expiration/closure is enforced;
- participant tokens are cryptographically strong and stored/verified safely.

---

# 6. PRIVACY

Verify public and participant-visible responses do NOT disclose:

- `organization_id`;
- internal workspace/tenant identifiers;
- `host_user_id`;
- provider subject;
- private email;
- private phone;
- invitation/allowlist records;
- authentication/session secrets;
- quiz question content or answer keys where prohibited by BAREA-006.

Verify presentation fields are intentionally sanitized.

---

# 7. NAT / RATE-LIMITING SECURITY

Verify that many legitimate participants behind one church/public NAT can join without a successful-seat-per-IP quota.

Verify anti-abuse controls remain bounded and cannot be weaponized as a global denial-of-service mechanism.

Specifically test whether one attacker can exhaust a bucket that prevents unrelated legitimate sessions/users from joining.

Verify trusted proxy handling cannot be abused through forged forwarding headers.

---

# 8. BAREA-006 BOUNDARY QUARANTINE

Reject implementation if it introduces any BAREA-007 functionality, including:

- authoritative live state transitions;
- live answer submission;
- scoring;
- leaderboard/podium;
- synchronized timers;
- WebSockets;
- SSE;
- Socket.IO;
- live question progression;
- projector gameplay state.

Scheduled-start metadata is permitted, but BAREA-006 must not become the live state machine.

---

# 9. TEST / BUILD VERIFICATION

Independently verify the reported commands where possible:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run build:next`
- `git diff --check`
- zero `any` audit under `src`

Confirm that the tests genuinely exercise the security boundaries rather than merely asserting implementation internals.

Pay particular attention to all 41 adversarial cases and the ADV-TNT-01 through ADV-TNT-11 tenant cases.

---

# 10. VERDICT RULES

Return one of:

### GO

Only if both agents independently find no security, tenant, persistence, or milestone-boundary blocker and the implementation evidence supports the claims.

### NO-GO

If either agent finds a concrete blocker, security bypass, tenant isolation failure, persistence integrity defect, privacy leak, or BAREA-007 boundary violation.

Do not downgrade a concrete security/tenant defect to a recommendation.

If NO-GO:

1. identify the exact file/function/schema location;
2. explain the exploit/failure path;
3. define the required remediation;
4. do not merge;
5. after remediation, rerun the same TWO agents independently.

---

# 11. REQUIRED FINAL REPORT

Update `AGY-REPORT.md` with:

1. implementation commit reviewed;
2. Agent 1 findings and verdict;
3. Agent 2 findings and verdict;
4. commands actually executed;
5. adversarial tests actually executed;
6. concrete findings/remediations, if any;
7. final GO/NO-GO;
8. explicit statement that no self-merge occurred.

Do not fabricate agent IDs, test output, or execution evidence.

**Stop after the independent review and await ChatGPT/user merge authorization.**
