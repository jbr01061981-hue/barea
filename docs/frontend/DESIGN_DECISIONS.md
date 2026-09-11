# BAREA Frontend Design Decisions

This document records decisions that should remain stable unless a deliberate product/architecture review changes them.

## DD-001 — Three purpose-built experiences

**Decision:** Design BAREA around Host/Teacher, Participant, and Presentation experiences rather than one universal dashboard layout.

**Reason:** Church quiz events have materially different jobs and viewing distances. The host needs control and dense status information; the participant needs a simple mobile action flow; the projector needs large, high-contrast information.

**Consequence:** Shared components and tokens are encouraged, but page composition may differ significantly by experience.

## DD-002 — One visual language, contextual shells

**Decision:** Use shared semantic tokens and primitives with contextual shells for public, teacher, and participant routes.

**Reason:** BAREA should feel like one product while avoiding the visual and cognitive cost of forcing every surface into an admin-dashboard pattern.

**Consequence:** New UI should prefer the existing shell/primitives before introducing route-specific visual systems.

## DD-003 — Mobile participant first

**Decision:** Participant gameplay is designed mobile-first, with large answer targets and minimal navigation during a live question.

**Reason:** Participants will commonly use personal phones in a church setting, often while attention is focused on the projected question.

**Consequence:** The participant current action must always be visually unmistakable. Recovery states are first-class UX states.

## DD-004 — Host speed and control first

**Decision:** Teacher/host screens optimize for reliable, fast operation over decorative density.

**Reason:** During a live event, the host cannot spend time interpreting complex UI or recovering from ambiguous controls.

**Consequence:** Primary controls should be prominent, state-aware, keyboard/touch accessible, and positioned consistently.

## DD-005 — Presentation is a first-class surface

**Decision:** Projector mode will be a dedicated presentation experience rather than simply a responsive version of the host UI.

**Reason:** A church projector has different distance, contrast, typography, and distraction constraints.

**Consequence:** Presentation work waits for the backend/live contract but its visual requirements are established now.

## DD-006 — Server authority is reflected in UX

**Decision:** The frontend displays server-authoritative session state and timing; it does not invent authoritative state.

**Reason:** Live quiz correctness depends on synchronized state, timing, authorization, and scoring being authoritative on the server.

**Consequence:** Client timers, optimistic state transitions, and local authorization must not be treated as authoritative. Any optimistic interaction must reconcile with server state.

## DD-007 — Participation mode and admission policy remain separate

**Decision:** UI labels, configuration controls, and summaries preserve `ParticipationMode` and `AdmissionPolicy` as distinct dimensions.

**Reason:** A teacher-managed group session and an individually authenticated session are different participation models, while OPEN/RESTRICTED/TEACHER_ASSIGNED describe admission policy.

**Consequence:** Avoid labels or components that imply one property determines the other except where existing compatibility rules require it.

## DD-008 — No anonymous nickname identity

**Decision:** Do not add anonymous nickname-based individual participation as a convenience feature.

**Reason:** The existing domain/security model requires authenticated individual participants and stable identity for that mode.

**Consequence:** If authentication is required but unavailable in the current backend, show a clear dependency state rather than implementing a bypass.

## DD-009 — Progressive disclosure

**Decision:** Show only the configuration needed for the current task, while keeping important state visible.

**Reason:** Teacher workflows include authoring, configuration, sharing, lobby management, and live control. Exposing every option simultaneously increases operational error.

**Consequence:** Use clear sections, step/grouping patterns, summaries, and confirmation for consequential actions.

## DD-010 — Accessibility is foundational

**Decision:** Accessibility is part of the component foundation, not a final visual-polish pass.

**Reason:** Church events include varied ages, devices, lighting, vision, motor ability, and technical familiarity.

**Consequence:** Maintain visible focus states, adequate touch targets, semantic controls, keyboard access, readable contrast, and meaningful status announcements as live features are added.

## DD-011 — Reuse before abstraction

**Decision:** Build a small set of stable primitives and patterns; do not create a large component framework prematurely.

**Reason:** The product is still establishing its core workflows. Over-abstraction would slow iteration and hide domain semantics.

**Consequence:** Extract a component when it is reused or has a clear domain/interaction contract, not merely because two elements look similar.

## DD-012 — Backend contracts gate live UX

**Decision:** Live lobby, synchronized questions, answer submission, scoring, leaderboard, and presentation synchronization are implemented only against explicit backend contracts.

**Reason:** These features depend on server state transitions and authorization that cannot safely be inferred by the frontend.

**Consequence:** Until those contracts exist, mark work as **FRONTEND DEPENDENCY / BACKEND GAP** and build only contract-independent UI foundations.

## DD-013 — Cloudflare Workers is the frontend deployment target

**Decision:** Deploy BAREA's Next.js frontend to **Cloudflare Workers**, using vinext as the Cloudflare deployment path. Do not use Cloudflare Pages for the application runtime.

**Reason:** BAREA is a full-stack Next.js App Router application using server-side behavior and Server Actions, with future requirements for live/realtime capabilities and Cloudflare platform bindings. Cloudflare's current recommendation for Next.js on Workers is vinext.

**Consequence:** Keep Cloudflare deployment configuration in GitHub (`vite.config.ts` and `wrangler.jsonc`). Use `main` for production and non-production branch builds for preview validation. Do not add Cloudflare bindings until a BAREA contract requires them.

**Risk/mitigation:** vinext is currently beta and actively developed. Every deployment stage must run compatibility/build validation before production use. A material compatibility gap requires a documented architecture review rather than an ad-hoc workaround.

## DD-014 — Preview deployment before merge

**Decision:** Every substantial frontend stage should be visually reviewed through a Cloudflare Workers preview before merge when the Cloudflare integration is available.

**Reason:** BAREA has three materially different surfaces (teacher, participant, presentation), and code review alone cannot validate real responsive layout, typography, interaction, and projector readability.

**Consequence:** Frontend stage acceptance includes preview verification for relevant routes, including desktop, mobile, and presentation contexts. Preview credentials and secrets must remain outside Git.

## DD-015 — Cloudflare build command is distinct from the repository TypeScript build

**Decision:** Cloudflare Workers Builds must use `npm run build:vinext`, not the repository's generic `npm run build`.

**Reason:** The existing `build` script runs `tsc` for the TypeScript package/test architecture. It does not generate the vinext/Cloudflare Worker output. A preview attempt that used `npm run build` caused Wrangler to fall back to Next.js auto-configuration/OpenNext and fail because the expected `.next/server/middleware-manifest.json` was absent.

**Consequence:** Cloudflare Workers Build settings are part of the deployment contract: `Build command = npm run build:vinext`, production deploy = `npx wrangler deploy`, and preview deploy = `npx wrangler versions upload`. Do not silently change these to the generic TypeScript build.
