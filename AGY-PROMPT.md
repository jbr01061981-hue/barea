# AGY TASK — BAREA-004 Teacher Review & Approval

## STATUS

**BAREA-004 Design Gate: APPROVED.**

See `docs/BAREA-004-DESIGN-GATE.md`.

Implement BAREA-004 as ONE integrated milestone: establish the real production frontend foundation while building, integrating, and testing the Teacher Review/Approval workflow.

**Do NOT create a throwaway frontend-only milestone.**
**Do NOT start BAREA-005 or later.**
**Do NOT merge the PR.**

## SOURCE OF TRUTH — READ FIRST

Repository: `jbr01061981-hue/barea`

Read current `main` versions of:

- `AGENTS.md`
- `docs/BAREA-004-DESIGN-GATE.md`
- `docs/ROADMAP.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/FRONTEND-STANDARD.md`
- `docs/VERIFICATION-GATES.md`
- existing BAREA-002 Question Bank implementation
- existing BAREA-003 AI generation implementation

GitHub is authoritative. If repository state materially conflicts with the design gate, STOP and report it.

## MULTI-AGENT ORCHESTRATION — REQUIRED

Do NOT execute this milestone as a single-agent implementation if AGY's sub-agent capabilities are available.

Before substantial coding, decompose the work and invoke the available specialized sub-agents that are appropriate to the task. At minimum, seek separate sub-agent input for these responsibilities where the platform supports them:

1. **UI/UX Design** — review the Teacher Review workflow, information hierarchy, responsive interaction model, accessibility, and BAREA anti-AI-slop visual rules before implementation.
2. **Frontend Architecture** — review the Next.js/React/TypeScript/Tailwind/React Aria structure, component boundaries, state/data flow, and integration boundaries.
3. **Implementation** — implement the frontend foundation and Teacher Review experience according to the approved design.
4. **Testing** — design and execute behavioral/unit/integration coverage for lifecycle, organization isolation, editing, approval, batch transactions, archive, and regeneration.
5. **Accessibility / Responsive QA** — specifically inspect keyboard/focus semantics, touch usability, mobile/tablet adaptation, and accessibility-critical interactions.
6. **Browser / Visual QA** — run the actual application in a real browser using realistic local data and inspect the rendered experience at L2/L3, not merely source code or DOM existence.
7. **Independent Code Review** — after implementation, actively attempt to find defects, security problems, lifecycle bypasses, architectural violations, visual/UX problems, and future-scope leakage.

### Orchestration rules

- The main AGY agent is the orchestrator and remains responsible for the final implementation and report.
- Give each sub-agent a narrow, explicit responsibility and provide the approved BAREA-004 design/source-of-truth documents as context.
- Do not ask every sub-agent to redo the entire milestone. Their jobs are complementary.
- Capture meaningful findings from each sub-agent and reconcile them before declaring the PR ready for independent BAREA review.
- A sub-agent's statement that something is correct is not proof. Where practical, require evidence such as test output, browser observations, file/line references, or concrete verification results.
- If a sub-agent identifies a blocker, fix it and re-run the relevant verification rather than simply documenting the problem.
- If a sub-agent proposes scope beyond BAREA-004, reject/defer it unless the approved design gate explicitly permits it.
- The independent-review sub-agent must be encouraged to challenge the implementation rather than rubber-stamp the work.
- Do not let sub-agents silently change approved architecture or milestone scope. Escalate genuine architectural conflicts to the main AGY agent and record any required ADR.
- Do not claim a verification activity merely because a sub-agent was invoked. Record what was actually executed and the evidence produced.

### Recommended execution sequence

Use this sequence where supported by AGY's orchestration capabilities:

`Design Review -> Frontend Architecture Review -> Implementation -> Automated Testing -> Accessibility/Responsive QA -> Browser/Visual QA -> Independent Code Review -> Fixes/Re-test -> Final AGY Report`

Design and architecture review may run before implementation. Testing/QA/review must run against the actual implementation. Independent review should occur after the implementation is substantially complete and again after any material corrective changes when needed.

If AGY cannot invoke one or more requested sub-agent roles, do the work with the available capabilities and explicitly record which roles were unavailable and how the equivalent verification was performed. Do not fabricate sub-agent participation.

## BRANCH / PR

Start from current `main`.

Create feature branch:

`barea-004-teacher-review`

Open one PR against `main` and leave it OPEN. Do not rewrite history, force-push, squash, or merge.

## FRONTEND FOUNDATION

BAREA-004 is the first production frontend milestone. Build the actual frontend foundation as part of Teacher Review.

Required stack:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Next.js App Router
- React Aria Components
- BAREA-owned visual design system/design tokens

Do NOT introduce shadcn/ui, Material UI, Ant Design, Chakra UI, another competing UI suite, or another CSS/styling system.

Do not blindly copy a starter template. Do not build a generic SaaS/AI dashboard. The shell must be production-quality but limited to structure required by BAREA-004. Do not create placeholder routes for future milestones.

## VISUAL / UX

Follow `docs/FRONTEND-STANDARD.md` and the design gate.

Make these visually primary and easy to understand:

- question stem
- answer options
- correct answer
- Scripture reference
- explanation
- topic
- difficulty
- language
- review status
- teacher actions

Avoid gratuitous gradients, glassmorphism, AI/sparkle motifs, excessive cards/pills, ornamental animation, useless dashboard statistics, and dense visual chrome.

Responsive behavior must adapt hierarchy and interaction patterns, not merely shrink desktop layouts.

## REVIEW QUEUE

Implement an organization-scoped queue containing only `PENDING_REVIEW` questions.

Requirements:

- strict organization isolation;
- deterministic ordering;
- useful metadata visible;
- intentional loading, empty, error, and recovery states;
- no cross-organization exposure.

## REVIEW WORKSPACE

Implement a focused review/edit experience.

Teacher can inspect and edit:

- stem
- options
- correct answer/correct answers
- explanation
- Scripture reference
- topic
- difficulty
- language where appropriate

Use existing Question domain validation and lifecycle rules.

**Saving an edit MUST NOT approve the question.** Verify it remains `PENDING_REVIEW` after saving. Invalid data must not persist.

## HUMAN SCRIPTURE / THEOLOGICAL REVIEW

Present Scripture reference, stem, answers, and explanation together for human inspection.

Clearly distinguish automated structural validation from human theological/scriptural review.

Do not implement an automated theological fact-checking or Scripture truth-certification engine. The teacher remains the approval authority.

## SINGLE APPROVAL

Implement a deliberate approval action:

`PENDING_REVIEW -> APPROVED`

Approval must be visibly separate from Save/Edit.

Never approve on save, opening, structural validation success, or AI generation.

Provide clear success/failure feedback.

## BATCH APPROVAL

Implement selection of multiple pending questions and explicit batch approval.

Batch approval MUST be transactional/all-or-nothing. If one selected approval fails, the operation must not leave a partially approved batch.

Add automated rollback coverage. Do not weaken the existing Question Bank transaction boundary merely to simplify UI integration.

## DISCARD / ARCHIVE

Use existing `ARCHIVED` for deliberate discard/archive.

Do not introduce `REJECTED` unless a concrete defect proves `ARCHIVED` insufficient. If that happens, STOP and request a design decision.

Keep destructive/archive actions visually separate from approval.

## REGENERATION

Use the existing BAREA-003 generation pipeline.

Regeneration must:

- preserve the original;
- never silently overwrite it;
- create a new candidate;
- leave the new candidate `PENDING_REVIEW`;
- preserve organization isolation;
- preserve the human approval gate.

Do not add a new AI provider or expose provider credentials to browser code.

If current BAREA-003 interfaces cannot support safe regeneration without changing established semantics, STOP and report the boundary issue.

## ARCHITECTURE BOUNDARIES

Use existing Question Bank and AI generation service/domain boundaries wherever possible. Add only minimum application integration required for the real local browser workflow.

Do not implicitly decide future architecture for production auth, HTTP/API style beyond minimum local integration, WebSockets/SSE, distributed databases, ORM replacement, Cloudflare deployment, participant joining, live quiz, scoring, leaderboard, projector, or quiz authoring.

Do not replace SQLite. Do not rewrite BAREA-002/003 except for a concrete defect directly required by this milestone.

## ACCESSIBILITY

Accessibility is part of implementation.

Use React Aria Components where appropriate. Verify semantic controls, keyboard navigation, visible focus, sensible focus movement, accessible labels, sufficient contrast, touch usability, readable text, reduced-motion behavior where motion is used, and screen-reader-friendly structure.

Critical actions must not be mouse-only.

## AUTOMATED TESTS

Add behavioral tests covering at minimum:

1. queue returns only pending questions;
2. organization isolation;
3. valid edits persist;
4. invalid edits are rejected;
5. pending edits remain pending;
6. explicit single approval;
7. save does not approve;
8. successful batch approval;
9. batch approval rollback on failure;
10. archive/discard;
11. regeneration creates a new pending candidate;
12. regeneration does not silently replace the original;
13. existing BAREA-002 suite remains green;
14. existing BAREA-003 suite remains green;
15. critical UI interactions have component/end-to-end coverage;
16. accessibility-critical interactions are tested where practical.

## L2 — ACTUAL LOCAL BROWSER / VISUAL VERIFICATION

Automated tests alone are NOT sufficient.

Start the real application locally and inspect the actual rendered UI in a real browser with realistic seeded/local question data.

Exercise this complete flow:

`PENDING_REVIEW queue -> open -> inspect -> edit -> save -> verify still pending -> approve -> verify approved -> select multiple -> batch approve -> archive -> regenerate -> verify new pending candidate`

Also verify loading, empty, validation-error, failure, success feedback, keyboard navigation, focus behavior, visual hierarchy, readability, and absence of obvious overflow/layout defects.

Do not merely check DOM existence with automation. Inspect the rendered experience.

Record actual browser testing in `AGY-REPORT.md`.

## L3 — RESPONSIVE / MOBILE / TABLET VERIFICATION

Verify the actual rendered Teacher Review experience at desktop, tablet, and mobile viewport sizes.

Verify layout adaptation, question editing, answer editing, approval controls, archive/regeneration actions, dialogs/drawers if used, touch targets, text readability, focus behavior, no unusable horizontal scrolling, and no overlapping/inaccessible controls.

L3 verifies responsive Teacher Review. It does NOT authorize Participant UI implementation.

Record actual viewport sizes and results in `AGY-REPORT.md`.

## QUALITY / SECURITY

Run and record actual results for:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- appropriate dependency/audit checks;
- no critical `any` introduced;
- no BOM artifacts;
- no committed secrets;
- no server-only AI credentials in browser bundle;
- no legacy JavaScript application source;
- build artifacts remain ignored.

Do not claim checks that were not actually run.

## DOCUMENTATION

Keep `docs/ROADMAP.md` accurate.

If implementation creates a genuine architectural decision, record it in `docs/DECISIONS.md` as an ADR.

Update `AGY-REPORT.md` with actual implementation details, tests, L2/L3 results, viewport sizes, limitations, and status.

Do not mark BAREA-004 COMPLETED before all required gates pass.

## STRICT FUTURE SCOPE

Do NOT implement or begin:

- BAREA-005 Quiz Authoring
- BAREA-006 Share/Join
- BAREA-007 Live Quiz / realtime
- BAREA-008 Participant UI / live host controls
- BAREA-009 Scoring
- BAREA-010 Results / Leaderboard
- BAREA-011 Projector
- BAREA-012 Church Validation
- BAREA-013 Pilot
- production deployment
- broad authentication system
- theological truth certification engine
- new LLM providers
- unrelated refactoring

Do not create placeholders for future milestones.

## STOP CONDITION

Leave the PR OPEN and stop for independent review only after:

- real frontend foundation is implemented;
- Teacher Review workflow is implemented;
- requested available sub-agent design/architecture/testing/QA/review work has been performed and findings reconciled;
- automated tests pass;
- typecheck passes;
- build passes;
- L2 actual browser/visual verification is performed;
- L3 actual responsive verification is performed;
- `AGY-REPORT.md` records actual results and sub-agent verification evidence;
- BAREA-005+ has not started.

Do not self-declare merge GO. Independent verification and user acceptance are required after implementation.
