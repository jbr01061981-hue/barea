# AGY — BAREA-006 DESIGN CORRECTION REQUIRED AFTER INDEPENDENT REVIEW

## STATUS

**BAREA-006 remains DESIGN-ONLY. DO NOT IMPLEMENT APPLICATION CODE.**

The independent review of the completed BAREA-006 design at commit `86c45a6` found **one concrete architectural blocker** that must be resolved before implementation can be authorized.

This is a focused correction pass. Do not reopen unrelated completed BAREA-004/005 work unless the correction requires verifying compatibility.

---

# 1. BLOCKER — PERSONAL WORKSPACE VS BAREA-005 SNAPSHOT OWNERSHIP

The current BAREA-006 design claims support for both:

- organization workspaces; and
- personal workspaces.

However, BAREA-005 currently models quizzes and published quiz snapshots using `organization_id` ownership.

The BAREA-006 design currently proposes a session/workspace model whose cross-tenant snapshot integrity effectively compares the published snapshot's `organization_id` with the session `workspace_id`.

That is coherent for an organization session, but **it does not yet define how a PERSONAL workspace can reference a BAREA-005 published snapshot whose persistence ownership is organization-based.**

This is an actual architecture mismatch, not a hypothetical concern.

---

# 2. REQUIRED RESOLUTION

Inspect the actual merged BAREA-005 implementation and authentication/tenant model before changing the design.

The preferred resolution is:

## OPTION A — PERSONAL WORKSPACE BACKED BY AN ISOLATED TENANT/ORGANIZATION ID

Represent each individual creator's personal workspace internally as its own isolated tenant/organization identity compatible with the existing BAREA-005 `organization_id` model.

The external/product concept may still be called a **personal workspace**, but persistence must have one authoritative tenant identity that BAREA-005 already understands.

Under this model:

- organization workspaces have their organization tenant ID;
- personal workspaces have their own isolated personal tenant/organization ID;
- a BAREA-005 quiz belongs to exactly one tenant identity;
- its published snapshot belongs to that same tenant identity;
- a BAREA-006 session belongs to that same tenant identity;
- the session's referenced published snapshot must resolve to the same tenant;
- cross-tenant references fail closed;
- a personal creator must never see or reference another personal creator's tenant;
- personal and organization data remain isolated.

Do **not** silently migrate BAREA-005 to a generic workspace abstraction merely to make BAREA-006 easier. That would be a broader architectural change and is outside this focused BAREA-006 correction unless explicitly justified and documented as necessary.

## OPTION B — GENERIC WORKSPACE OWNERSHIP

This is acceptable only if the two agents independently establish that BAREA-005 must be generalized and the migration/compatibility consequences are explicitly designed.

If Option B is chosen, document:

- all affected BAREA-005 tables;
- ownership/key migration;
- foreign keys and triggers;
- authorization changes;
- migration/backward compatibility;
- cross-tenant invariants;
- test coverage;
- why Option A is insufficient.

Do not implement the migration in BAREA-006.

---

# 3. MANDATORY INVARIANT

The corrected design must state and enforce conceptually:

> Every BAREA-006 session references an immutable BAREA-005 published quiz snapshot owned by the same authoritative tenant identity as the session.

The design must make it impossible for a session in tenant A to reference a published snapshot in tenant B.

Do not rely only on application-level checks where a database constraint/trigger or equivalent persistence invariant can safely enforce the relationship.

The design must also explain how the invariant works for personal creators.

---

# 4. MANDATORY TWO-AGENT REVIEW

Use **exactly the same TWO specialized agents** already mandated by `AGY-PROMPT.md`.

Do NOT launch six agents.
Do NOT launch twelve agents.
Do NOT add additional agents.

### Agent 1 — SECURITY + ARCHITECTURE RED TEAM

Focus specifically on:

- personal tenant/workspace isolation;
- organization tenant isolation;
- session-to-snapshot tenant binding;
- authorization of personal creators;
- cross-tenant lookup/access;
- whether the proposed model can cause IDOR or confused-deputy behavior;
- whether public room/link/QR lookup can reveal another tenant's resources;
- whether authentication identity maps unambiguously to the authoritative tenant.

### Agent 2 — PERSISTENCE + QA / IMPLEMENTABILITY REVIEWER

Focus specifically on:

- actual BAREA-005 `organization_id` schema and repository semantics;
- compatibility of BAREA-006 session persistence with BAREA-005 snapshots;
- foreign keys/triggers/constraints;
- personal tenant creation/ownership representation;
- migration/backward compatibility;
- uniqueness and concurrency;
- exact adversarial tests needed to prove cross-tenant integrity;
- whether the design can be implemented without inventing an undocumented ownership rule.

Agents must review independently before synthesis.

Record only actual findings. Never fabricate agent IDs, transcripts, tool calls, or conclusions.

---

# 5. REQUIRED DESIGN CHANGES

After the two agents report:

1. Resolve the personal-workspace/BREA-005 ownership mismatch.
2. Update `docs/BAREA-006-DESIGN-GATE.md` coherently.
3. Update `docs/PRODUCT.md` only where necessary to make the corrected ownership model explicit.
4. Preserve all existing BAREA-006 security requirements.
5. Preserve the strict BAREA-005 immutable snapshot model.
6. Add explicit adversarial tests/specifications for personal-to-organization and personal-to-personal cross-tenant references.
7. Clarify the authoritative tenant identity used by every session and snapshot.
8. Correct any wording that says persistence is already "implemented" while BAREA-006 remains design-only; use wording such as **specified/designed** instead.

**ZERO APPLICATION SOURCE CODE.**

---

# 6. REQUIRED ADVERSARIAL TESTS

The corrected design must specify at least:

- personal tenant A cannot reference a snapshot owned by personal tenant B;
- personal tenant cannot reference an organization snapshot;
- organization tenant cannot reference a personal snapshot;
- organization A cannot reference organization B snapshot;
- session tenant and snapshot tenant mismatch is rejected;
- database-level integrity rejects an invalid cross-tenant reference where practical;
- public room lookup cannot enumerate private/personal resources;
- authenticated personal creator cannot access another creator's session;
- personal creator cannot mutate an organization-owned session;
- organization member cannot mutate another tenant's personal session;
- concurrent session creation cannot create an ownership mismatch;
- personal and organization tenant identifiers cannot collide or become ambiguous.

---

# 7. TWO-AGENT SECOND PASS — MANDATORY

After remediation, run the **same TWO agents again independently**.

The second pass must explicitly verify:

- the BAREA-005 `organization_id` compatibility issue is actually resolved;
- personal workspace semantics are concrete rather than merely renamed;
- session-to-snapshot ownership is one authoritative tenant identity;
- database/application authorization boundaries agree;
- cross-tenant references fail closed;
- no BAREA-005 regression is introduced by the design;
- no BAREA-006 application code was written;
- the existing teacher-group, authenticated-individual, open/restricted admission, privacy, NAT-safe, room-code, QR/link, scheduling, and strict BAREA-006 boundary requirements remain intact.

If either agent finds a blocker, remediate the design and repeat the two-agent second pass.

Do not implement until the second pass is unanimously GO.

---

# 8. STOP CONDITION

When complete, update `AGY-REPORT.md` with:

- the concrete blocker;
- the architecture selected (prefer Option A unless evidence requires Option B);
- the exact BAREA-005 compatibility invariant;
- both agents' first-pass findings;
- remediation performed;
- both agents' second-pass findings;
- final design-gate status;
- confirmation that **ZERO BAREA-006 APPLICATION CODE** was written.

Then STOP and await independent ChatGPT review.

**Do not implement BAREA-006. Do not start BAREA-007.**
