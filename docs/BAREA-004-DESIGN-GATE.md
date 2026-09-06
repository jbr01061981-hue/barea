# BAREA-004 Design Gate — Teacher Review & Approval

**Status: APPROVED FOR IMPLEMENTATION**

**Milestone:** BAREA-004  
**Dependency:** BAREA-003 completed and verified  
**Required real-world verification:** L2 local browser/visual + L3 responsive/mobile/tablet

## 1. Objective

Build the first production frontend capability for BAREA: a teacher-facing review workbench that takes AI-generated `PENDING_REVIEW` questions through human inspection, editing, rejection/regeneration, and explicit approval into the Question Bank.

BAREA-004 establishes the initial production frontend shell at the same time as it delivers the Teacher Review capability. The frontend foundation must be minimal, reusable, and limited to capabilities required by this milestone.

## 2. Source-of-Truth Contracts

The implementation must conform to:

- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md` — especially FR-AI-003, FR-AI-004, FR-AI-005
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` — ADR-001, ADR-007, ADR-010, ADR-011
- `docs/FRONTEND-STANDARD.md`
- `docs/VERIFICATION-GATES.md`
- existing BAREA-002 Question domain/repository/service contracts
- existing BAREA-003 AI generation contracts

## 3. Product Workflow

The canonical BAREA content lifecycle remains:

```text
AI Generation
    ↓
Structural / Schema Validation
    ↓
PENDING_REVIEW
    ↓
Teacher Review & Edit
    ↓
Teacher Scripture / Theological Review
    ↓
Explicit Teacher Approval
    ↓
APPROVED Question Bank
```

The UI must make this lifecycle understandable and must never imply that structural validation certifies biblical truth.

## 4. Functional Scope

### 4.1 Review Queue

Provide a teacher review queue containing only organization-scoped `PENDING_REVIEW` questions.

The queue should expose enough information for efficient triage, including:

- question stem
- question type
- difficulty
- Scripture reference
- topic
- language
- review status
- useful created/updated information

Ordering must be deterministic.

### 4.2 Review Workspace

Provide a focused review/edit experience for an individual question.

Editable fields include:

- question stem
- answer options
- correct answer/correct answers
- explanation
- Scripture reference
- topic
- difficulty
- language where appropriate

All saved changes must pass the existing Question domain validation.

Saving changes must **not** approve the question.

### 4.3 Scripture and Human Review

The teacher must be able to inspect Scripture reference, explanation, stem, and answers together as part of the review decision.

The product must clearly distinguish:

- automated structural validation; and
- human theological/scriptural review.

No automated theological certification or Scripture fact-checking engine is part of this milestone.

### 4.4 Explicit Approval

Approval is a deliberate action separate from saving edits.

Allowed approval transition:

`PENDING_REVIEW → APPROVED`

A question must never become approved because it was generated, loaded, edited, or saved.

### 4.5 Batch Approval

Provide selection and batch approval for multiple pending questions.

Batch approval must be transactional/all-or-nothing. If one selected question cannot be approved, no selected question from that approval operation should be left newly approved.

### 4.6 Discard / Reject

Use the existing `ARCHIVED` lifecycle state for discarded questions. Do not introduce a new `REJECTED` domain status unless a concrete implementation requirement demonstrates that the existing lifecycle is insufficient.

### 4.7 Regeneration

Allow a teacher to request regeneration of an unsatisfactory question through the existing BAREA-003 generation pipeline.

Regeneration must not silently overwrite the original question. The regenerated candidate must enter `PENDING_REVIEW` and remain subject to the same human approval gate.

## 5. Frontend Foundation

BAREA-004 is the first production frontend implementation milestone.

Use the established BAREA frontend standard:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Next.js App Router
- React Aria Components for accessible behavioral primitives
- BAREA-owned visual design system and design tokens

Do not introduce shadcn/ui, Material UI, Ant Design, Chakra UI, or another competing visual system.

The initial shell must include only the structure genuinely required by the Teacher Review experience. Do not create placeholder screens for future milestones.

## 6. UX / Visual Direction

BAREA must look purpose-built for a church quiz preparation workflow, not like a generic AI/SaaS dashboard.

Priorities:

1. Question content is visually primary.
2. Scripture reference and explanation are easy to inspect.
3. Review status is obvious.
4. Approval is deliberate and unambiguous.
5. Editing is efficient without overwhelming the teacher.
6. Destructive actions are clearly separated from approval.
7. Responsive behavior changes information hierarchy rather than simply shrinking desktop layouts.
8. Accessibility is structural, including keyboard navigation, focus visibility, semantics, contrast, touch usability, reduced motion, and readable text scaling.

Avoid gratuitous gradients, glassmorphism, decorative AI/sparkle motifs, excessive cards/pills, ornamental animation, and generic generated-dashboard patterns unless a concrete product/accessibility purpose justifies a technique.

## 7. Architecture Boundaries

BAREA-004 may add the frontend application layer and the minimum integration boundary needed to exercise the review workflow locally.

It must not implicitly decide future architecture for:

- real-time transport
- production authentication/authorization
- distributed database infrastructure
- deployment architecture
- quiz authoring
- live sessions
- participant joining
- scoring
- leaderboard
- projector presentation

Do not replace SQLite, introduce an ORM, or replace the existing AI provider architecture.

## 8. Data and Security Invariants

The implementation must preserve:

- strict `organizationId` isolation;
- Question lifecycle invariants;
- approved-content modification demotion behavior;
- no direct creation as `APPROVED`;
- AI-generated content remains subject to teacher approval;
- no AI credentials exposed to browser/client code;
- no sensitive provider credentials or raw provider responses exposed through UI;
- no cross-organization question access.

## 9. Required Automated Verification

At minimum, implementation must include tests covering:

- review queue filtering to `PENDING_REVIEW`;
- organization isolation;
- valid edits;
- invalid edit rejection;
- edits remaining `PENDING_REVIEW`;
- explicit single approval;
- batch approval success;
- batch approval rollback/failure behavior;
- archive/discard;
- regeneration creates a new pending candidate without silently replacing the original;
- existing BAREA-002 and BAREA-003 regression suites remain green;
- accessibility-critical interactions where practical;
- critical review workflow end-to-end behavior.

Also run typecheck, build, static/diff checks, and security/secret audits appropriate to the repository.

## 10. Required Real-World Verification

BAREA-004 cannot be accepted from automated tests alone.

### L2 — Local Browser / Visual

Verify the actual rendered application in a real browser:

- review queue;
- open a question;
- edit fields;
- save;
- verify it remains pending;
- approve one question;
- select and approve a batch;
- archive/discard;
- regenerate;
- loading state;
- empty queue;
- validation/error state;
- success feedback;
- keyboard navigation and focus behavior;
- visual hierarchy and readability.

### L3 — Responsive / Mobile / Tablet

Verify the same critical workflow at appropriate desktop, tablet, and mobile viewport sizes.

The teacher workflow must remain usable without horizontal overflow or unusably compressed controls. Touch targets, text readability, focus states, dialogs, forms, and action placement must be verified.

L3 does not mean turning the Teacher Console into the Participant UI. It means the teacher review workflow remains usable across supported screen sizes.

## 11. Acceptance Criteria

BAREA-004 is ready for GO only when all are true:

- production frontend shell is established using the approved BAREA stack;
- Teacher Review queue works against real BAREA question data;
- only organization-scoped pending questions are exposed;
- teacher can inspect and edit required fields;
- edits are domain-validated;
- edits never silently approve content;
- Scripture and explanation are clearly reviewable;
- individual approval works explicitly;
- batch approval is atomic;
- discard/archive works;
- regeneration preserves the original and produces a new pending candidate;
- no future milestone functionality has been implemented;
- automated tests pass;
- independent code/architecture review passes;
- L2 browser/visual verification passes;
- L3 responsive/mobile/tablet verification passes;
- no release-blocking defect remains;
- documentation/report/roadmap are synchronized.

## 12. Explicit Exclusions

Do not implement:

- BAREA-005 quiz authoring
- BAREA-006 QR/share/join
- BAREA-007 live quiz/realtime transport
- BAREA-008 participant UI or host live-session controls
- BAREA-009 scoring
- BAREA-010 leaderboard/results
- BAREA-011 projector presentation
- BAREA-012 church validation program
- BAREA-013 pilot
- production deployment
- broad authentication system
- theological truth certification engine
- new LLM providers
- unrelated refactoring

## 13. Design Gate Decision

**GO — IMPLEMENTATION AUTHORIZED.**

BAREA-004 is intentionally one integrated milestone: establish the real frontend foundation while building and testing the Teacher Review workflow. Do not create a throwaway frontend scaffold milestone.

The milestone remains incomplete until the actual browser workflow and responsive behavior have been verified at L2 and L3 and an explicit final GO decision is recorded.
