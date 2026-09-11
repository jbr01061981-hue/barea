# BAREA Architecture Decision Records (ADR)

This document tracks architectural principles, established decisions, and open technical items for the BAREA platform.

---

## Record Index

- [ADR-001: Strict Human-in-the-Loop Review for AI Content](#adr-001-strict-human-in-the-loop-review-for-ai-content)
- [ADR-002: Question-Level Difficulty Granularity](#adr-002-question-level-difficulty-granularity)
- [ADR-003: Participant Access and Authentication Direction](#adr-003-participant-access-and-authentication-direction)
- [ADR-004: Server-Authoritative State and Scoring Engine](#adr-004-server-authoritative-state-and-scoring-engine)
- [ADR-005: Separate Viewport Presentation Roles](#adr-005-separate-viewport-presentation-roles)
- [ADR-006: Question Bank Durable Storage & Organizational Isolation](#adr-006-question-bank-durable-storage--organizational-isolation)
- [ADR-007: Approved Question Immutability & Content Modification Invariants](#adr-007-approved-question-immutability--content-modification-invariants)
- [ADR-008: TypeScript as BAREA Application Language](#adr-008-typescript-as-barea-application-language)
- [ADR-009: AI LLM Gateway Provider Port & Architecture](#adr-009-ai-llm-gateway-provider-port--architecture)
- [ADR-010: BAREA Frontend Application Stack](#adr-010-barea-frontend-application-stack)
- [ADR-011: BAREA Design System and UI Component Strategy](#adr-011-barea-design-system-and-ui-component-strategy)
- [ADR-012: Edge Reverse Proxy and Origin Ingress Trust Boundary](#adr-012-edge-reverse-proxy-and-origin-ingress-trust-boundary)
- [Open Technical Decisions](#open-technical-decisions)

---

## ADR-001: Strict Human-in-the-Loop Review for AI Content

### Status
**ACCEPTED**

### Context
LLMs can generate plausible-sounding statements that may contain subtle theological inaccuracies, incorrect scriptural references, or age-inappropriate phrasing. In church education, scriptural fidelity and theological trust are essential.

### Decision
All AI-generated questions must be held in a pending review staging state. Automated system checks perform structural validation on the schema, but cannot certify biblical truth. Questions cannot be published live or added to an active quiz until explicitly reviewed, verified, edited as needed, and approved by a teacher.

### Consequences
- **Positive**: Protects theological fidelity; ensures trust with pastors, teachers, and parents.
- **Negative**: Requires human review before questions can be used; requires an efficient teacher review interface.

---

## ADR-002: Question-Level Difficulty Granularity

### Status
**ACCEPTED**

### Context
Educational quizzes often ramp up in difficulty or combine questions of varying complexity. Applying difficulty only at the quiz level limits flexibility and prevents question reuse across different age groups.

### Decision
Difficulty (Easy, Medium, Hard) is an attribute of the individual **question**, not only the quiz. A quiz derives its overall challenge from its collection of questions.

### Consequences
- **Positive**: Enables granular filtering in the Question Bank; allows teachers to assemble varied and progressive quizzes.
- **Negative**: Requires difficulty metadata for every question created manually or via AI.

---

## ADR-003: Participant Access and Authentication Direction

### Status
**PROPOSED / MVP DIRECTION**

### Context
Church events include visitors, youth, and elderly attendees using diverse devices. Requiring account creation or app installation creates significant entry friction before a live game. However, future features (such as multi-week leaderboards or student history) might benefit from optional participant profiles.

### Decision
For MVP live quiz participation, adopt an unauthenticated, frictionless joining flow via QR code, direct link, or room access code with a display name and ephemeral session token. Long-term participant accounts remain an open decision for post-MVP evaluation rather than an irreversible architecture lock.

### Consequences
- **Positive**: Minimizes barrier to entry during church events.
- **Negative**: No cross-session historical tracking for participants in initial release.

---

## ADR-004: Server-Authoritative State and Scoring Engine

### Status
**ACCEPTED**

### Context
Client-side timers or client-side score calculations are vulnerable to clock drift, latency differences, and tampering. Additionally, sending correct answers to clients before answering closes creates cheating vulnerabilities.

### Decision
The server acts as the authoritative source of truth for the game state machine, countdown timers, answer acceptance, and score calculations. Correct answers are never sent to participants during an active question window.

### Consequences
- **Positive**: Fair, tamper-proof gameplay; synchronized timers and reliable leaderboards across all displays.
- **Negative**: Requires reliable bidirectional communication and handling of client reconnections.

---

## ADR-005: Separate Viewport Presentation Roles

### Status
**ACCEPTED**

### Context
A live church quiz involves three distinct viewing contexts:
1. The Teacher needs management and pacing controls.
2. The Audience needs high-contrast presentation visible from distance.
3. The Participant needs clear, responsive touch controls on a mobile device.

### Decision
Establish three dedicated presentation experiences:
- **Host View**: Session orchestration and participant roster oversight.
- **Participant View**: Mobile-optimized answering experience.
- **Projector View**: Big-screen display for group engagement.

### Consequences
- **Positive**: Tailored ergonomics and readability for each participant role.
- **Negative**: Requires maintaining synchronized state across three distinct client presentation surfaces.

---

## ADR-006: Question Bank Durable Storage & Organizational Isolation

### Status
**ACCEPTED (BAREA-002)**

### Context
BAREA-002 requires durable persistence for the Question Bank with strict organizational isolation so that questions from one church or context do not leak into another. To keep the project lightweight, dependency-free, and cross-platform without imposing complex external database server setups during early milestones, we evaluated built-in persistence options.

### Decision
1. Implement durable storage using Node.js built-in synchronous SQLite (`node:sqlite` via `DatabaseSync`), requiring zero external dependencies or native compilation steps.
2. Establish strict tenant/organizational isolation using mandatory `organizationId` on all domain operations, queries, and composite indices (`idx_questions_org`, `idx_questions_org_status`, `idx_questions_org_topic`, `idx_questions_org_diff`).
3. Domain validation and repository contracts encapsulate SQL details, allowing the storage engine to be substituted or evolved into client-server databases in future scaling phases without domain layer breakage.

### Consequences
- **Positive**: Zero external dependencies; instant local testability in memory (`:memory:`) or file; ACID transactions; strict organizational boundary enforcement.
- **Negative**: SQLite is file-based/single-instance; migration to client-server RDBMS (e.g., PostgreSQL) will be needed if distributed multi-region server clusters are introduced.

---

## ADR-007: Approved Question Immutability & Content Modification Invariants

### Status
**ACCEPTED (BAREA-002)**

### Context
In BAREA, approved questions represent vetted, theologically accurate, and age-appropriate content ready for live quiz sessions. If an APPROVED question's stem, options, correct answer indices, scripture references, explanation, difficulty, or topic could be silently updated while retaining APPROVED status, modified and unvetted content would leak into live quizzes, defeating the teacher-approval gate.

### Decision
1. **Content Modification Demotion**: Modifying any content attribute (stem, options, correct indices, scripture reference, explanation, topic, difficulty, type, language) on an `APPROVED` question automatically resets the question status to `PENDING_REVIEW` unless an explicit valid status transition (such as `ARCHIVED`) is specified.
2. **Review Gate Preservation**: Content-modified questions cannot silently remain `APPROVED`. They re-enter the review queue and must be re-verified and re-approved by a human teacher before they can be retrieved as approved Question Bank content or added to active quizzes.
3. **Soft Deletion**: Questions are soft-deleted by transitioning to `ARCHIVED`. Archived questions can be restored to `DRAFT` for re-editing, but cannot jump directly to `APPROVED`.
4. **No Direct APPROVED Creation**: Questions can never be created directly with `APPROVED` status. All newly created questions default to `DRAFT` and any attempt to supply `status: APPROVED` during creation is rejected by domain validation. `APPROVED` status can only be achieved by progressing through the legitimate review lifecycle (`DRAFT -> PENDING_REVIEW -> APPROVED`).

### Consequences
- **Positive**: Guarantees theological fidelity; prevents unreviewed edits from appearing in live quizzes; enforces consistent lifecycle state transitions.
- **Negative**: Teachers editing an existing approved question must re-approve it before using it in quizzes.

---

## ADR-008: TypeScript as BAREA Application Language

### Status
**ACCEPTED (PRE-BAREA-003)**

### Context
BAREA-002 established the first executable domain and persistence layer in JavaScript. The upcoming BAREA milestones will introduce AI contracts, service boundaries, HTTP APIs, real-time state, shared client/server models, and multiple presentation surfaces. The project also requires maintainable public contracts and safe refactoring across work performed by multiple automated agents.

### Decision
1. **TypeScript is the standard application language for BAREA going forward.** New BAREA application code must use `.ts`/`.tsx` as appropriate rather than `.js`.
2. Migrate the existing BAREA-002 JavaScript implementation to TypeScript before BAREA-003 begins, preserving behavior and public contracts.
3. Keep the migration deliberately small: use TypeScript for compile-time type safety and explicit domain/repository/service contracts, while retaining the existing CommonJS runtime shape and Node.js built-in SQLite implementation unless a compatibility issue requires a documented change.
4. TypeScript compiler output is the runtime artifact; source remains under `src/` and compiled output under `dist/`. Tests must continue to run in CI/local development against the compiled output or an explicitly justified TypeScript test runner.
5. Avoid framework selection, frontend scaffolding, ORM adoption, database replacement, real-time transport selection, or AI provider selection as part of this decision.

### Consequences
- **Positive**: Stronger domain contracts, earlier error detection, safer refactoring, clearer interfaces for future agents, and better maintainability as BAREA expands.
- **Negative**: Adds a compile step and development dependencies for TypeScript and Node.js type definitions; the existing BAREA-002 source must be migrated carefully without changing behavior.

---

## ADR-009: AI LLM Gateway Provider Port & Architecture

### Status
**ACCEPTED (BAREA-003)**

### Context
BAREA-003 introduces the server-side AI quiz generation pipeline. The project requires high-quality, structured biblical questions generated on demand, while avoiding tight coupling to any single proprietary LLM provider SDK or cloud API. Automated testing must be deterministic and must not depend on live credentials or external network access.

### Decision
1. **Port/Adapter Architecture**: The AI generation pipeline connects to LLMs through a strongly-typed port interface (`AIProvider`), which defines `generateRaw(request: GenerationRequest): Promise<unknown>`.
2. **Provider Implementations**:
   - `FakeAIProvider`: In-memory deterministic mock provider for automated unit, validation, and failure-mode testing without network or credentials.
   - `GeminiAIProvider`: Production adapter for Google Gemini REST API (`gemini-2.5-flash` by default, configurable to `gemini-3.8-flash` or other supported models via `GeminiProviderConfig` or `GEMINI_MODEL`) using native fetch without heavy third-party SDK dependencies.
3. **Model Selection & API Verification**:
   - **Default Model**: `gemini-2.5-flash` is selected as the production default. Official Google documentation verifies it as a current stable model with full structured-output schema support, high throughput, and low latency appropriate for server-side question generation batches.
   - **API Surface & Endpoint**: `POST /v1beta/models/{model}:generateContent` on `https://generativelanguage.googleapis.com`.
   - **Structured Output Mechanism**: Requests structured JSON via Gemini's native `generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_QUESTIONS_RESPONSE_SCHEMA }`.
   - **Verification Date**: September 6, 2026.
   - **Official Documentation References**:
     - Google Gemini Models: `https://ai.google.dev/gemini-api/docs/models`
     - Google Gemini Structured Output: `https://ai.google.dev/gemini-api/docs/structured-output`
     - Google Gemini Text Generation: `https://ai.google.dev/gemini-api/docs/generate-content/text-generation`
     - Google Gemini Deprecations: `https://ai.google.dev/gemini-api/docs/deprecations`
4. **Configuration, Credentials & Error Redaction**:
   - Provider credentials and models are configuration-driven via `GeminiProviderConfig` or environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`).
   - Credentials are transmitted via the official `x-goog-api-key` HTTP header rather than in URL query parameters.
   - **Error Redaction Strategy**: Thrown `AIProviderError` messages extract only bounded, safe diagnostics (HTTP status code, status text, and structured error reason). Any echo of API keys, `x-goog-api-key` header tokens, or authorization credentials is deterministically redacted with `[REDACTED]`. Arbitrary multi-line raw provider response bodies (such as server traces) are never dumped into application errors.
5. **Structured Output & Two-Stage Validation**:
   - Provider outputs are strictly validated in two stages: first via JSON schema / structural validation (`validateStructuralOutput`), and second through Question domain validation (`validateQuestionPayload`).
   - Automated structural validation only certifies schema format; it does NOT certify biblical truth or theological accuracy.
6. **Lifecycle Gate & Atomic Persistence**:
   - Generated questions are always persisted as `PENDING_REVIEW`, preserving the human teacher review and approval gate (BAREA-004). AI questions can never be created directly as `APPROVED`.
   - Batch persistence is executed within a single SQLite transaction (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`). If any question insert or status transition fails, the transaction is rolled back, ensuring zero questions from that batch remain persisted.
7. **Future Provider Substitution**:
   - Alternative providers (e.g. OpenAI, Anthropic, local open-weights models) can be added as `AIProvider` implementations without altering the Question Bank domain, service, or validation layers.

### Consequences
- **Positive**: Complete provider decoupling, test suite speed and determinism with zero network dependencies, strict lifecycle safety, atomic persistence guarantees, verified model/API contracts, and clean credential/error safety.
- **Negative**: Adds provider adapter interface maintenance and requires mapping model outputs to the common BAREA schema.

---

## ADR-010: BAREA Frontend Application Stack

### Status
**ACCEPTED (PRE-BAREA-004)**

### Context
BAREA requires a web application serving three distinct presentation contexts: a teacher/host console, a mobile participant experience, and a projector/big-screen experience. The frontend must be maintainable across multiple milestones and automated development agents, strongly typed, responsive, accessible, and suitable for both interactive workflows and presentation-oriented screens.

### Decision
1. **Next.js 16** is the standard frontend application framework for BAREA.
2. **React 19** is the UI runtime/library standard.
3. **TypeScript** is mandatory for frontend application code, consistent with ADR-008.
4. **Tailwind CSS 4** is the standard styling system.
5. Use the **Next.js App Router** for application routing and composition.
6. The frontend architecture must support the three BAREA presentation roles without forcing them into one generic responsive dashboard: Teacher/Host Console, Mobile Participant, and Projector/Presentation View.
7. Frontend implementation must remain compatible with the server-authoritative architecture and future real-time transport decisions; this ADR does not select HTTP API design, WebSocket/SSE transport, authentication, deployment platform, or distributed data infrastructure.
8. Do not introduce a second frontend framework or a competing CSS system without a new ADR or explicit revision of this decision.

### Rationale
- Next.js provides a mature React application structure while allowing server and client rendering to be selected per surface.
- React and TypeScript provide a consistent language/model across the future interactive surfaces.
- Tailwind CSS provides responsive styling and design-token capabilities without imposing a prebuilt visual identity.
- The stack is web-native and therefore appropriate for phones, tablets, desktop browsers, and modern browser-based projector/TV environments.

### Consequences
- **Positive**: One coherent frontend platform across BAREA surfaces; strong TypeScript alignment; responsive styling; freedom to create a distinctive BAREA visual language; mature ecosystem.
- **Negative**: Next.js adds framework conventions and build complexity; the team must deliberately design separate ergonomics for teacher, participant, and projector experiences.

---

## ADR-011: BAREA Design System and UI Component Strategy

### Status
**ACCEPTED (PRE-BAREA-004)**

### Context
BAREA's primary risk is not lack of UI components; it is allowing a generic template or AI-generated component aesthetic to become the product's visual identity. The platform must feel purpose-built for church quiz preparation and live participation while remaining accessible and usable across mobile, web, and large-screen contexts.

### Decision
1. **BAREA owns its visual design system.** The project's visual language, design tokens, layout rules, typography, spacing, color semantics, motion, responsive behavior, and component styling are BAREA-specific.
2. **React Aria Components** is the preferred behavioral/accessibility component foundation. Components should remain visually unopinionated and be styled by BAREA rather than adopting a third-party visual theme.
3. **shadcn/ui is not a BAREA frontend standard.** Do not use shadcn/ui as the project's component library or visual design language. Individual implementation ideas may be studied when useful, but BAREA components must not inherit a generic shadcn visual identity by default.
4. Do not standardize on Material UI, Ant Design, Chakra UI, or another opinionated visual component suite for the core BAREA product without a new ADR.
5. Accessibility is a functional requirement. Keyboard navigation, focus management, semantics, touch interaction, contrast, reduced-motion behavior, and assistive-technology compatibility must be considered in component design and testing.
6. **Design for the actual viewing context rather than merely shrinking one layout.**
   - Teacher/Host: desktop/tablet productivity and content-review workflow.
   - Participant: mobile-first, large touch targets, low cognitive load, fast interaction.
   - Projector/Presentation: large typography, high contrast, viewing-distance readability, minimal UI chrome.
7. Avoid generic "AI SaaS" visual patterns unless they have a concrete product purpose. In particular, do not add decorative gradients, excessive glassmorphism, gratuitous cards, dashboard-statistic tiles, decorative AI/sparkle motifs, excessive pill badges, ornamental animations, or visual elements solely because they are common in generated templates.
8. **Content hierarchy takes precedence over decoration.** For quiz and review experiences, question text, answers, Scripture references, correctness, difficulty, status, and teacher actions must remain visually primary.
9. Use centralized BAREA design tokens and reusable primitives instead of scattering arbitrary styling values throughout feature code.
10. UI components must be tested for behavior and accessibility independently of their visual styling where practical. End-to-end tests must cover critical teacher, participant, and projector flows as those surfaces are implemented.

### Rationale
This approach separates three concerns: React Aria provides robust interaction and accessibility behavior; Tailwind CSS provides implementation-level styling; BAREA controls the actual visual identity. This minimizes dependency on recognizable template aesthetics and makes the UI intentionally designed for the three BAREA viewport roles.

### Consequences
- **Positive**: Distinctive product identity; reduced template/AI-slop risk; strong accessibility foundation; reusable behavior; appropriate ergonomics for mobile, teacher, and projector contexts.
- **Negative**: More design work is owned by BAREA; the project cannot rely on a pre-designed visual library to make arbitrary screens look consistent automatically.

---

## ADR-012: Edge Reverse Proxy and Origin Ingress Trust Boundary

### Status
**ACCEPTED (BAREA-006 ARCHITECTURE SPECIFICATION)**

### Context
In BAREA-006, unauthenticated participants join quiz lobbies via short room codes or direct links. Abuse controls (15 failed lookups/min, /24 subnet containment, 30 unauth requests/10s) protect against room code enumeration and denial-of-service.
However, in standard Node.js / Next.js Server Actions, raw TCP socket addresses are not directly exposed to application action handlers. If the origin server is directly reachable from the public internet, incoming HTTP request headers (such as `X-Forwarded-For`, `CF-Connecting-IP`, or `X-Real-IP`) can be arbitrarily forged by an attacker.
Conversely, falling back to a universal constant (`127.0.0.1`) collapses all unauthenticated clients into a single global rate-limit bucket, creating a shared denial-of-service vulnerability that violates BAREA's church-scale multi-user requirements.

### Decision
1. **Enforced Deployment Boundary (Option 1)**: BAREA establishes a mandatory deployment contract wherein the Next.js origin server is NEVER directly accessible from the public Internet.
2. **Edge Reverse Proxy Ingress**: All public HTTP/HTTPS traffic must terminate at an authorized, managed Edge Reverse Proxy (e.g. Cloudflare Tunnel, AWS ALB, or isolated Nginx/Caddy gateway).
3. **Origin Firewalling**: Direct TCP access to origin port 3000 from the public internet is dropped/blocked by network firewall, security group, private subnet routing, or daemon tunnel binding.
4. **Header Normalization at Ingress**: The edge proxy unconditionally removes/strips all caller-supplied forwarding headers (`X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`, `X-Barea-*`). The proxy extracts the client IP strictly from its own connection socket (`remoteAddress`) and writes the canonical client IP to an internal header (`X-Barea-Client-IP`).
5. **Edge Attestation**: The proxy authenticates to the origin using mutual TLS (mTLS) or an independently managed, high-entropy shared secret (`X-Barea-Edge-Attestation` matching `process.env.BAREA_EDGE_SECRET`).
6. **Application Verification**: The application verifies the edge attestation in constant time before consuming `X-Barea-Client-IP`. Requests lacking valid edge attestation are relegated to a quarantined, non-privileged fallback bucket (`127.0.0.1`), preventing spoofing and preventing collision with legitimate proxied traffic.
7. **Application Checkpoint Preservation**: Until an active production deployment environment implements and enforces this boundary, the application code safely remains at checkpoint commit `eb8d416`, without manufacturing a fake application-only trust model.

### Practical Deployment Contract Specifications

To satisfy ADR-012 without coupling BAREA to a single cloud vendor, the deployment contract specifies the required behaviors across 14 operational facets:

1. **Production Hosting Target & Edge Technology**:
   - Status: **SELECTED — CLOUDFLARE EDGE + CLOUDFLARE TUNNEL (`cloudflared`)**.
   - Concrete Deployment Topology:
     ```text
     PUBLIC INTERNET
           |
           v (HTTPS / TLS 1.3 Anycast)
     CLOUDFLARE EDGE (DNS / TLS termination)
           |
           v (Encrypted outbound-only QUIC/TLS tunnel connector)
     CLOUDFLARE TUNNEL (`cloudflared` daemon on private origin host)
           |
           v (Loopback HTTP: 127.0.0.1:3000)
     PRIVATE BAREA ORIGIN (Next.js App Router on Node.js 20+)
     ```
   - Reference Architectures Evaluated:
     - *Cloudflare Tunnel + Container/VM Origin* (Selected).
     - *AWS / GCP Private VPC* (Evaluated / Deferred).
     - *Bare Metal / Dedicated Linux VM with Reverse Proxy (Nginx / Caddy)* (Evaluated / Deferred).
2. **Origin Exposure Model**:
   - The Next.js Node process binds strictly to loopback (`127.0.0.1:3000`) or a private isolated container network.
   - Zero public IPv4/IPv6 routing to origin port 3000.
   - The host requires NO inbound public listening ports and NO public IP address.
3. **Firewall / Network Ingress Model**:
   - For Cloudflare Tunnel, `cloudflared` initiates outbound-only connections from the private origin host to Cloudflare's Edge PoPs.
   - **Correction Note**: Cloudflare Edge does NOT initiate direct inbound connections to origin port 3000. Therefore, a Cloudflare source-CIDR inbound firewall allowlist on port 3000 is neither required nor applicable.
   - Host/OS packet filter (e.g. `ufw`, `nftables`, or cloud security group) drops all inbound public connections to port 3000 (`0.0.0.0/0:3000` dropped).
4. **Trusted Edge Behavior**:
   - Terminates public TLS with modern ciphers (TLS 1.3 / TLS 1.2).
   - Ingests public client requests over Anycast edge PoPs.
5. **Header Stripping & Client-IP Handling Contract**:
   - **Native Cloudflare Mechanism**: Cloudflare Edge terminates the client TCP socket and automatically overwrites `CF-Connecting-IP` with the connecting client's true socket IP address. Any client-provided `CF-Connecting-IP` is overwritten by Cloudflare Edge before traversing the tunnel.
   - Incoming `X-Forwarded-For` is appended or normalized by Cloudflare; caller-controlled values are untrusted.
   - Any external caller attempts to pass `X-Barea-*` headers must be stripped at the ingress boundary or ignored.
   - Because `cloudflared` is an authenticated, outbound-only connector that only Cloudflare Edge can route traffic to, and because the origin is unreachable from the public internet, `CF-Connecting-IP` arriving through the tunnel possesses genuine network-level provenance.
6. **Origin Authentication & Attestation (Correction Applied)**:
   - **No Fake HMAC**: Ordinary Cloudflare Transform Rules do NOT provide cryptographic per-request HMAC signing. A static shared secret header is not an HMAC.
   - **Native Trust Boundary**: The primary provenance guarantee is provided by the private Tunnel architecture: the origin listens only on loopback, has no public ingress, and can only receive requests dispatched through the authenticated `cloudflared` daemon.
   - **Optional Shared Secret (Defense-in-Depth)**: If an additional application-level attestation token (`BAREA_EDGE_SECRET`) is injected via Cloudflare HTTP Request Header Modification rules (Transform Rules) and verified by the origin application, it acts as an additional defense-in-depth barrier against accidental origin exposure. It is a static shared token, not an HMAC signature.
7. **Secret Lifecycle**:
   - `cloudflared` tunnel token and any optional edge secret managed via environment variables (`CLOUDFLARE_TUNNEL_TOKEN`, `BAREA_EDGE_SECRET`) strictly outside of Git.
   - Dual-secret rotation support: origin accepts `BAREA_EDGE_SECRET` and optional `BAREA_EDGE_SECRET_PREVIOUS` during rotation windows if application-level attestation is active.
8. **Health Checks**:
   - Dedicated unauthenticated health endpoint (`/api/health`) responds `200 OK` to local `cloudflared` and monitoring probes.
   - Health check probes are exempted from participant abuse rate limits.
9. **TLS Termination**:
   - Public TLS terminates at Cloudflare Edge.
   - In-transit encryption between `cloudflared` and Cloudflare PoPs is encrypted via QUIC/TLS.
   - Connection between `cloudflared` and Next.js is private local loopback (`127.0.0.1:3000`).
10. **Logging / Observability Expectations**:
    - Cloudflare dashboard and tunnel metrics provide edge connection and tunnel status monitoring.
    - Application logs record rate-limit events with redacted client IP prefix (e.g. `203.0.113.***`) for privacy while retaining security auditability.
11. **Local Development Behavior**:
    - When `NODE_ENV === 'development'`, local developers run `next dev` directly on loopback `127.0.0.1:3000` without requiring `cloudflared` or edge secrets.
12. **Test Environment Behavior**:
    - In `NODE_ENV === 'test'`, automated tests use controlled in-memory fixtures and test seams (`setMockRequestHeadersForTesting`, `setTrustedClientIpForTesting`), which are strictly disabled and throw `Forbidden` in production (`NODE_ENV === 'production'`).
13. **Failure Behavior (Direct / Unauthenticated Access)**:
    - If a request reaches the application without valid edge provenance (or if a direct connection is attempted), the application fails closed: it ignores forwarding headers and relegates the request to the quarantined fallback identity (`127.0.0.1`).
14. **How Direct-Origin Traffic Is Blocked**:
    - Network Layer: Next.js binds to `127.0.0.1:3000`; no public IP or public port forwarding exists. Public packets cannot reach port 3000.
    - Application Layer (Defense-in-Depth): Unprovenanced requests resolve strictly to `127.0.0.1`, preventing attacker-controlled rate-limit bucket evasion.

### Hosting Target Candidate Evaluation Matrix

In accordance with BAREA architectural constraints (church-scale usage, cost, operational simplicity, secret management, origin isolation, Next.js App Router compatibility, and future BAREA-007 WebSocket/live transport), the three supported candidate families are evaluated below:

| Evaluation Dimension | Candidate A: Cloudflare Tunnel + Cloudflare Edge | Candidate B: Private Cloud VPC (AWS ALB / GCP Cloud Armor) | Candidate C: Linux VM + Reverse Proxy (Nginx / Caddy) |
| :--- | :--- | :--- | :--- |
| **Monthly Baseline Cost** | **Lowest**: Free tier / $0–$5/mo (Cloudflare Zero Trust free tier includes tunnels; compute on low-cost VM/container). | **Highest**: ~$35–$60+/mo baseline (AWS ALB ~$16–$22/mo + NAT Gateway / VPC endpoints + compute). | **Low to Moderate**: ~$5–$20/mo (Single VPS on Hetzner, DigitalOcean, Linode, or AWS Lightsail). |
| **Operational Complexity** | **Low**: No public IP required; no inbound firewall ports to open; `cloudflared` initiates outbound connection only. | **High**: Requires VPC setup, public/private subnets, route tables, internet gateways, NAT gateways, security groups. | **Moderate**: Requires OS maintenance, firewall (`nftables`/`ufw`), reverse proxy config, manual/certbot TLS renewal. |
| **Origin Isolation Strength** | **Exceptional**: Origin has ZERO public listening ports or public IPv4/IPv6 addresses. Directly unreachable from internet. | **Strong**: Origin in private subnet with security group allowing ingress solely from load balancer security group. | **Strong (if configured correctly)**: Origin binds strictly to `127.0.0.1:3000`; OS packet filter drops external packets to 3000. |
| **IP Provenance Reliability** | **High**: Edge sets `CF-Connecting-IP` / `X-Barea-Client-IP` from ingress socket; tunnel ingress strips incoming spoofed headers. | **High**: ALB strips untrusted `X-Forwarded-For` or appends client IP; security group guarantees packet arrived via ALB. | **High**: Nginx/Caddy sets `$remote_addr` to internal header and discards caller-supplied forwarding headers. |
| **Secret & Attestation Management** | **Simple**: High-entropy tunnel token stored outside Git; native CF-Connecting-IP over authenticated tunnel requires zero custom HMAC or Worker machinery. | **Integrated**: Secret stored in AWS Secrets Manager / Parameter Store and injected via ALB / CloudFront headers. | **Direct**: Secret stored in environment file (`/etc/barea.env`) and configured directly in proxy upstream blocks. |
| **Observability & Logs** | **Strong**: Cloudflare analytics, tunnel status metrics, and request logging. | **Comprehensive**: CloudWatch / Cloud Logging with detailed access logs and VPC flow logs. | **Basic to Moderate**: Local access logs (`/var/log/nginx/access.log`), systemd journal, optional Loki/Prometheus agent. |
| **Fit for Next.js App Router** | **Seamless**: Standard Node.js / standalone output proxying over HTTP/1.1 or HTTP/2. | **Seamless**: Standard container/EC2 target behind ALB target groups. | **Seamless**: Standard upstream reverse-proxy configuration. |
| **Future BAREA-007 Live Transport** | **Excellent**: Cloudflare Tunnel natively supports WebSockets and HTTP/2 Server-Sent Events (SSE) out of the box. | **Excellent**: AWS ALB natively supports WebSockets and long-lived HTTP connections. | **Excellent**: Nginx and Caddy both offer robust, battle-tested WebSocket proxying (`Upgrade` / `Connection` headers). |
| **Fit for Small Church / Startup Scale** | **Best Fit**: Minimal operational burden, zero maintenance of inbound firewall rules, enterprise-grade edge security for free. | **Overkill for MVP**: Complex setup and recurring fixed infrastructure charges unsuitable for small community budgets. | **Viable**: Inexpensive, but requires manual OS patching, firewall maintenance, and certificate renewal oversight. |

### Target Recommendation
- **Recommended Target**: **Candidate A (Cloudflare Tunnel + Cloudflare Edge)**.
- **Rationale**:
  1. *Zero Inbound Attack Surface*: Origin requires no public IP and no open inbound firewall ports; `cloudflared` initiates outbound-only connections to Cloudflare's edge network.
  2. *Unmatched Cost-to-Security Ratio*: Eliminates AWS ALB / NAT Gateway recurring fixed costs while providing enterprise-grade DDoS mitigation, automated TLS, and global CDN caching.
  3. *BAREA-007 Ready*: Native zero-configuration WebSocket and SSE support.
  4. *Low Operational Burden*: Ideal for church and non-profit administration without dedicated 24/7 DevOps teams.
- **Selection Status**: **SELECTED — CANDIDATE A (CLOUDFLARE EDGE + CLOUDFLARE TUNNEL)**. Formally selected by user decision (commit `a6a8f3b`).
- **Provisioning Status**: **NOT YET PROVISIONED**. Physical infrastructure provisioning and verified Cloudflare deployment integration tests are required before merge authorization.

### Consequences
- **Positive**: Eliminates IP header spoofing; provides true network provenance; maintains church-scale client isolation and NAT scalability (zero per-IP seat quotas); prevents global rate-limit bucket exhaustion.
- **Negative**: Requires production infrastructure (private network, firewall, edge proxy configuration) to be provisioned before live internet deployment.

---

## Open Technical Decisions

The following technical selections remain intentionally deferred:

1. **Real-Time Communication Transport**: Specific protocol/library implementation.
2. **Database & Data Layer for Distributed Environments**: Relational database engine, schema management, and live session state storage for multi-server deployment.
3. **HTTP/API Contract**: Specific API style and validation/transport implementation.
4. **Authentication/Authorization**: Teacher/host authentication implementation and authorization model.
5. **Deployment/Hosting Target**: **RESOLVED — CLOUDFLARE EDGE + CLOUDFLARE TUNNEL (`cloudflared`)** (ADR-012). Physical provisioning in progress.
