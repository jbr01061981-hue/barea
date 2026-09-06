# BAREA Milestone Verification & Release Gates

This document defines the mandatory verification process for every meaningful BAREA development milestone. It exists to prevent a milestone from being accepted merely because an implementation report or automated test suite says it is complete.

## 1. Source of Truth

GitHub is the authoritative source of truth for BAREA implementation state, requirements, architecture, decisions, milestone status, prompts, and reports.

- Repository: `jbr01061981-hue/barea`
- Do not treat chat history, agent memory, or an execution summary as authoritative when it conflicts with the repository.
- Material changes discovered during development or review must be reflected in the appropriate GitHub document.

## 2. Mandatory Milestone Flow

Every meaningful milestone follows this sequence:

1. **Design Gate** — inspect the current repository documentation and define scope, dependencies, acceptance criteria, risks, and explicit exclusions.
2. **Implementation Gate** — record the approved AGY implementation instructions in `AGY-PROMPT.md`; implementation occurs on a feature branch and produces an `AGY-REPORT.md`.
3. **Independent Verification Gate** — independently inspect the actual repository/PR and verify implementation against requirements and architecture. Do not rely solely on the AGY report or test claims.
4. **Real-World Verification Gate** — perform the appropriate local, visual, responsive, cloud, integration, or pilot verification required by the milestone.
5. **Acceptance Gate** — issue an explicit **GO** or **NO-GO** decision. A failed gate requires corrective work and re-verification.
6. **Merge Gate** — merge only after the milestone has passed the required gates and the user has approved the merge.
7. **Post-Merge Gate** — verify `main`, run the appropriate tests/build checks again, synchronize roadmap/documentation, clean feature branches, and confirm the next milestone is still untouched.

## 3. Independent Verification Standard

The reviewer must actively attempt to find defects rather than merely confirm that tests pass.

Review should cover, as applicable:

- PR diff and every meaningful changed source file
- architecture and documented contracts
- domain invariants and lifecycle rules
- persistence and transaction behavior
- API contracts and integration boundaries
- organization/tenant isolation
- security and credential handling
- error and failure paths
- automated test quality and whether tests prove the claimed behavior
- typecheck, build, lint/static checks where applicable
- dependency choices and version suitability
- scope leakage into future milestones
- documentation consistency
- Git history, branch state, and repository cleanliness

## 4. Real-World Verification Levels

The required verification level is determined by what the milestone actually delivers.

| Level | Required verification | Typical use |
|---|---|---|
| **L0** | Repository/document review | Documentation or architecture-only changes |
| **L1** | Local functional verification | Domain, persistence, service, or backend behavior |
| **L2** | Local browser/visual verification | Any user-facing web UI |
| **L3** | Mobile/tablet/responsive verification | Participant and responsive experiences |
| **L4** | Deployed cloud verification | Deployment, runtime, external integration, multi-device behavior |
| **L5** | Real environment/pilot verification | Church/live-network/live-user readiness |

A milestone may require more than one level. Passing automated tests does not substitute for a required visual, responsive, cloud, or pilot test.

## 5. UI Verification Rules

For user-facing milestones, the reviewer must verify the actual rendered experience, not only source code or browser automation.

Where applicable, verify:

- Teacher/Host workflow on desktop
- tablet behavior
- participant experience on a real or emulated mobile viewport
- projector/presentation behavior at wide-screen dimensions
- typography and readability
- touch target size
- keyboard navigation and focus behavior
- accessible semantics
- loading, empty, error, and failure states
- network failure/retry behavior
- state preservation across refresh/navigation where required
- that the visual design follows `docs/FRONTEND-STANDARD.md` and does not drift into generic AI/SaaS dashboard patterns

## 6. Cloud Verification Rules

Cloud deployment testing is mandatory when local testing cannot prove the real deployment/runtime behavior or when the milestone introduces deployment-dependent integration.

For such milestones:

1. Deploy the actual candidate build to the designated Cloudflare environment.
2. Test the deployed application using real browser/device contexts as appropriate.
3. Verify runtime configuration, routing, persistence, external integrations, and multi-client behavior.
4. Record the deployment target and verification result in `AGY-REPORT.md` or the milestone verification record.
5. A local PASS does not imply a cloud PASS.

Cloudflare should not be introduced solely for the sake of a milestone that can be completely and reliably verified locally; the verification level must match the actual risk.

## 7. GO / NO-GO Decision

Every meaningful milestone must end with an explicit release-gate decision.

### GO
A milestone is **GO** only when:

- required automated checks pass;
- independent code/architecture review passes;
- all required real-world verification levels pass;
- no unresolved critical or release-blocking defects remain;
- scope boundaries are respected;
- documentation and roadmap state are synchronized;
- the implementation is ready for user acceptance/merge.

### NO-GO
A milestone is **NO-GO** if any required gate fails, including a material visual, responsive, deployment, integration, security, architectural, or workflow defect.

A NO-GO milestone must not advance to the next milestone. The defect must be corrected and independently re-verified.

## 8. Milestone Verification Record

For each meaningful milestone, the final review should record at minimum:

- Milestone ID
- implementation commit / PR
- automated test result
- independent code-review result
- required verification levels
- local/visual result
- mobile/responsive result where applicable
- cloud result where applicable
- pilot result where applicable
- known limitations
- final **GO / NO-GO** decision
- reviewer date

## 9. Examples

### Backend-only milestone

`Tests PASS + independent review PASS + L1 local verification PASS -> GO`

### Teacher UI milestone

`Tests PASS + independent review PASS + L2 browser/visual PASS + L3 responsive PASS -> GO`

### Live multi-device milestone

`Tests PASS + independent review PASS + L2/L3 PASS + L4 deployed Cloudflare PASS -> GO`

### Production/pilot milestone

`All previous gates PASS + L5 real church/pilot PASS -> GO`

## 10. Non-Negotiable Rule

**Do not advance to the next meaningful BAREA milestone until the current milestone has passed its required verification levels and received an explicit GO decision.**

The purpose of this gate is to catch the difference between code that appears complete and a product capability that actually works in the intended environment.