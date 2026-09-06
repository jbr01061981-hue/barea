# BAREA Frontend Standard

**Status: ACCEPTED — applies to all future frontend milestones unless explicitly revised by an ADR.**

This document is the implementation reference for BAREA's frontend software and design choices. The architectural decisions are recorded in ADR-010 and ADR-011 in `docs/DECISIONS.md`.

## 1. Standard Software Stack

| Concern | BAREA Standard |
|---|---|
| Application framework | Next.js 16 |
| UI runtime | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Routing/composition | Next.js App Router |
| Accessible interaction primitives | React Aria Components |
| Visual design system | BAREA-owned |

### Explicitly not standard

- shadcn/ui is **not** the BAREA component-library or visual-design standard.
- Material UI, Ant Design, Chakra UI, or another opinionated visual component suite is not to be introduced as the core BAREA UI system without an ADR.
- Do not introduce a second CSS/styling system without an explicit architectural decision.

## 2. Design-System Principle

**BAREA owns the visual identity.**

React Aria Components provide behavior and accessibility. Tailwind CSS provides the styling mechanism. BAREA defines the actual visual language through its own design tokens, typography, spacing, color semantics, layout rules, component styling, responsive behavior, and motion rules.

The objective is not to assemble a pre-designed SaaS interface. The objective is to build a purpose-designed church quiz product.

## 3. Anti-AI-Slop Guardrail

AI coding agents must not treat popular generated-dashboard aesthetics as the default design language.

Avoid decorative UI that has no concrete product purpose, including:

- gratuitous gradients;
- excessive glassmorphism;
- excessive rounded cards or containers;
- dashboard statistic tiles where they do not communicate useful information;
- decorative AI/sparkle motifs;
- excessive pill badges;
- ornamental animation;
- dense visual chrome around simple tasks;
- generic startup/SaaS landing-page patterns copied into application screens.

This is not a prohibition on any individual visual technique. A technique may be used when it has a clear BAREA product, accessibility, or communication purpose.

## 4. Three First-Class Viewing Contexts

BAREA must be designed as three related but deliberately different experiences:

### Teacher / Host Console

- Desktop/tablet productivity first.
- Efficient review and editing of questions.
- Clear status, Scripture, answer, difficulty, and approval controls.
- Information density is acceptable when it improves workflow.

### Participant Mobile

- Mobile first.
- Large touch targets.
- Minimal cognitive load.
- Very little navigation during live play.
- Fast, clear feedback.

### Projector / Presentation

- Designed for large screens and viewing distance.
- Large typography and answer targets.
- Strong contrast.
- Minimal interface chrome.
- Do not simply scale the teacher console up to projector size.

## 5. Responsive Design Rule

Responsive behavior must adapt the information hierarchy and interaction model to the viewing context. It must not merely shrink a desktop layout into smaller breakpoints.

Components may share domain concepts and behavioral primitives while using different compositions for teacher, participant, and projector contexts.

## 6. Accessibility Rule

Accessibility is part of the component contract, not a final polish step.

Use React Aria Components where applicable for accessible behavior such as focus management, keyboard interaction, semantics, selection, dialogs, menus, forms, and touch interaction.

BAREA UI work must account for:

- keyboard navigation;
- visible and reliable focus states;
- semantic structure;
- sufficient contrast;
- touch usability;
- reduced-motion preferences;
- screen-reader compatibility;
- appropriate text scaling and readability.

## 7. BAREA Design Tokens

Feature code should consume centralized BAREA design tokens rather than inventing arbitrary values screen by screen.

The design-token system should cover at minimum:

- semantic colors;
- typography scale;
- spacing;
- radii;
- elevation;
- focus treatment;
- motion;
- touch-target sizing;
- projector/presentation typography rules.

The visual token set should be established deliberately as part of frontend implementation rather than copied wholesale from an external template.

## 8. Component Strategy

Prefer this layering:

```text
BAREA Product Components
        |
BAREA Design Tokens + Styling
        |
React Aria Components / accessible primitives
        |
React + TypeScript
        |
Next.js
```

Components should be reusable when they represent a genuine product concept or stable interaction pattern. Do not create an abstraction merely to avoid a few repeated lines of markup.

## 9. Content Hierarchy

In teacher review and quiz experiences, the actual content is visually primary.

Examples of high-priority content include:

- question stem;
- answer choices;
- correct answer state where appropriate;
- Scripture reference;
- explanation;
- difficulty;
- review status;
- teacher actions;
- live question/timer state.

Visual decoration must not compete with these elements.

## 10. Testing Expectations

Frontend milestones should include appropriate levels of:

- component/interaction tests;
- accessibility checks;
- responsive behavior checks;
- critical user-flow end-to-end tests;
- projector readability checks where presentation screens are involved.

Teacher, participant, and projector flows should be tested as distinct experiences rather than assuming desktop browser tests prove mobile and presentation usability.

## 11. Architectural Boundaries

This standard does **not** select:

- backend HTTP/API style;
- real-time transport;
- authentication/authorization;
- production hosting/deployment;
- distributed database/data layer;
- state-management library;
- API client/data-fetching library.

Those choices remain separate architectural decisions and must not be introduced implicitly through frontend scaffolding.

## 12. Rule for Future Agents

Before adding frontend dependencies or selecting a UI component library, check this document and ADR-010/ADR-011 first.

If a proposed dependency changes the established frontend architecture or visual design-system strategy, stop and request an architectural decision rather than silently introducing it.
