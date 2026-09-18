# BAREA Product Specification

## 1. Executive Summary

**BAREA** is a synchronized church quiz platform designed specifically for Christian communities, including Sunday schools, youth ministries, adult Bible fellowships, and congregation-wide quiz events.

BAREA combines interactive group engagement with biblical integrity and theological fidelity. It removes the friction of quiz preparation through intelligent, bounded AI generation while keeping Christian educators firmly in control of content.

BAREA supports both **teacher-controlled group participation** for children who may have no device or account, and **authenticated individual participation** for users who participate with their own BAREA identity.

---

## 2. Core Personas & Roles

### 2.1 The Teacher / Host
- **Profile**: Sunday school teachers, youth pastors, small group leaders, or quiz masters.
- **Goals**:
  - Quick preparation of scripture-based quizzes tailored to recent sermon series or curriculum topics.
  - Verification of theological correctness and age-appropriateness.
  - Effortless pacing and facilitation during the live event.
- **Key Needs**:
  - Ability to generate or pull questions from a structured Question Bank.
  - Dedicated host console with controls for advance, pause, reveal answer, and leaderboard display in live-game milestones.
  - Oversight of connected participants where individual participation is enabled.
  - Ability to create groups and assign pupils in teacher-controlled group mode.
  - Ability to record/mark group answers when operating a teacher-controlled group quiz.

### 2.2 The Individual Participant
- **Profile**: Authenticated students, youth, church members, visitors, or other users participating individually.
- **Goals**:
  - Join a quiz using their own BAREA account.
  - Enter through a QR code, shareable link, room access code, or future quiz invite code.
  - Participate without requiring a separate app installation.
- **Key Needs**:
  - Authentication through BAREA's existing OAuth/social-login architecture.
  - Secure identity anchored to the authenticated BAREA account/provider identity, not a display-name string.
  - Clear waiting-room and live-game state feedback.

### 2.3 The Teacher-Controlled Group Participant
- **Profile**: Children/pupils in Sunday School or similar groups who may have no BAREA account, phone, laptop, or other device.
- **Goals**:
  - Participate as part of a teacher-created group/team.
  - Answer questions collectively while the teacher operates the BAREA interface.
- **Key Needs**:
  - No child BAREA account required.
  - No child OAuth/social login required.
  - Teacher creates groups and assigns pupils.
  - Teacher records/marks the group's answer.

### 2.4 The Congregation / Audience (Projector View)
- **Profile**: In-person audience gathered in a sanctuary, classroom, or fellowship hall watching the main screen.
- **Goals**:
  - Engaging communal experience where everyone can read the question, timer, and see community performance.
- **Key Needs**:
  - High-contrast, large-format display with clean typography readable from a distance.
  - Live participant/group count, countdown timer, answer distribution overview, and celebratory podium/leaderboard screens in the applicable live-game milestones.

---

## 3. Participation Modes & Admission Policies

Participation mode answers **how the quiz is played**. Admission policy answers **who is permitted to participate**. These are separate concepts.

### 3.1 Teacher-Controlled Group Mode

A teacher/host creates groups or teams and assigns pupils to them.

- Pupils do not need BAREA accounts.
- Pupils do not need OAuth/social login.
- Pupils may have no personal device.
- Pupils do not directly join the public participant flow.
- The teacher/host operates the quiz and records/marks group answers.
- Group membership is controlled by the authorized teacher/host.

This mode is intended for Sunday School classrooms and similar settings where one teacher may operate BAREA for many children.

### 3.2 Authenticated Individual Mode

Each participant participates as an authenticated BAREA user.

- The participant authenticates through BAREA's existing OAuth/social-login architecture.
- Google is an existing login provider; the identity model should permit additional providers such as Facebook or X/Twitter later.
- A provider's stable subject/identifier, mapped to the BAREA user, is the identity boundary.
- Display name is presentation data and is not a security identity.
- Duplicate display names are allowed.
- Email and phone information used for authorization must come from trusted verified identity/verification data, not arbitrary form fields.

### 3.3 Admission Policies

At minimum BAREA should support:

**Teacher Assigned**
- Used for teacher-controlled group participation.
- The teacher determines which pupils belong to each group.

**Open**
- Used for authenticated individual quizzes where anyone who reaches the valid share/join mechanism may participate, subject to the session lifecycle, capacity, and abuse controls.
- Authentication remains required for individual participation.

**Invited / Restricted**
- Used for authenticated individual quizzes where the creator chooses who may participate.
- The creator may specify permitted email addresses and/or phone numbers.
- Admission requires a trusted authenticated identity with the relevant verified email/phone attribute.
- A client cannot authorize itself by simply typing an allowed email address or phone number.
- Restricted admission cannot be bypassed by a QR code, link, room access code, or future invite code.

### 3.4 Creator Scope & Canonical Tenant Model

Quizzes and sessions may be created by:
- a teacher or authorized member of a church/organization workspace; or
- an individual creator using their personal BAREA workspace.

**Canonical Tenant Invariant (Option A):**
- Personal and organizational ownership share the same underlying authoritative tenant identity model compatible with BAREA-005's `organization_id` persistence column.
- An organization workspace has an authoritative organization tenant ID (e.g. `org_berea_central`).
- A personal workspace has its own isolated, deterministic personal tenant ID (e.g. `usr_ten_<user_id>`), derived strictly on the server from the authenticated creator's identity.
- A quiz, its published snapshot, and any derived live session belong to exactly one authoritative tenant identity.
- Cross-tenant references fail closed: a personal creator cannot reference another personal creator's snapshot or an organization snapshot, and vice versa.
- Individual creators operate with complete multi-tenant security guarantees without requiring special-case authorization bypasses.

---

## 4. Core Product Modules & Experiences

### 4.1 Question Bank & Content Management
- Serves as the persistent library of reusable, categorized questions.
- Question attributes:
  - **Scripture Reference** (e.g., Genesis 1:1-5, Romans 8:28).
  - **Topic / Category** (e.g., Old Testament, Parables, Early Church, Fruit of the Spirit).
  - **Difficulty Level**: **Easy**, **Medium**, **Hard** (difficulty resides directly on each question).
  - **Question Type**: Multiple Choice, Multi-Select, True/False.
  - **Language**: English, Spanish, Telugu, Tamil, and multi-language support.
  - **Explanations / Scripture Context**: Accompanying biblical context shown upon answer reveal.

### 4.2 AI Quiz Generation (Core MVP Capability)
- AI acts as a teaching assistant for rapid question draft creation.
- Generation parameters selectable by teacher:
  - Topic / Scripture Passage / Theme.
  - Target difficulty (Easy, Medium, Hard).
  - Number of questions.
  - Question type.
  - Language.
- **Mandatory AI Review Gate**:
```text
AI generates
-> structural validation
-> teacher review
-> teacher edit/regenerate
-> teacher approval
-> Question Bank
-> Quiz
```
- **Strict Rule**: AI-generated questions are NEVER live or public until a human teacher validates and approves them. System structural validation checks format and schema compliance, but human teacher review verifies biblical and scriptural fidelity.

### 4.3 Quiz Authoring & Publishing
- Combine questions from the Question Bank and freshly approved AI questions into an ordered quiz.
- Configurable rules per quiz:
  - Time per question.
  - Scoring scheme.
  - Question and option ordering.
  - Participation mode.
  - Admission policy.
  - Publishing/share settings.
  - Optional scheduled start time for a live session.

### 4.4 Share, Join & Onboarding Experience

BAREA supports multiple entry mechanisms. These mechanisms are discovery/entry paths and do not themselves determine authorization.

1. **QR Code**: Displayed on a projector/host surface; mobile camera opens the appropriate BAREA entry flow.
2. **Direct URL**: Shareable through messaging or other channels.
3. **Room Access Code**: Short human-entered code for a live session.
4. **Future Quiz Invite Code**: A dedicated quiz/invitation code may be implemented later. It must resolve to the intended quiz/session or invitation context but must still enforce the configured authentication and admission policy.

The future invite-code feature is intentionally an extension point and is not a requirement to implement in BAREA-006.

### 4.5 Individual Authentication & Restricted Admission

For authenticated individual participation:
- reuse BAREA's existing OAuth/social-login architecture;
- anchor identity to the canonical authenticated BAREA user and stable provider subject;
- never trust a posted user ID, provider subject, email, or phone number;
- verified email may be used for restricted admission when supplied by the trusted identity boundary;
- phone-based admission requires a trusted verified phone-number mechanism and must not rely solely on an arbitrary OAuth profile field;
- email/phone allowlists are private creator/session data and are never shown to other participants;
- the same authenticated identity must not become multiple participants in one active session merely by changing display name or browser storage.

### 4.6 Teacher-Controlled Groups

For teacher-controlled group quizzes:
- teacher creates groups/teams;
- teacher assigns pupils to groups;
- pupils need no BAREA account or device;
- teacher operates the quiz display/control surface;
- teacher records/marks each group's answer through the authorized host boundary.

Group membership and teacher-entered group answers are distinct from individual authenticated participation and must have separate authorization boundaries.

### 4.7 Live Synchronized Quiz Engine
- Real-time synchronization across Host, Mobile, and Projector views for applicable participation modes.
- Supported game states:
  1. **Lobby / Waiting Room**: Participants/groups are prepared; host sees the applicable roster; projector displays join QR and room code where relevant.
  2. **Question Preview**: Countdown cue before question answering opens.
  3. **Question Active**: Projector displays question & timer; authenticated mobile participants display answer controls; teacher-controlled groups are operated by the teacher.
  4. **Answer Reveal**: Answering closes server-side; correct answer and scripture explanation displayed.
  5. **Question Leaderboard**: Scores and rankings displayed on projector where enabled.
  6. **Final Podium**: Concluding celebration with full results summary.

Live gameplay, answer submission, scoring, synchronized timers, and automatic live-state transitions belong to the later live-quiz milestones; BAREA-006 only establishes the required session/share/admission foundations and schedule metadata.

### 4.8 Scheduled Start

A creator may optionally configure a session start time.

- The scheduled time is stored with explicit UTC/timezone semantics.
- The creator/authorized host controls whether scheduling is configured.
- The authoritative live transition from lobby to active gameplay is owned by the live-quiz milestone (BAREA-007), not by the BAREA-006 share/join foundation.
- Scheduling must not bypass session closure, admission policy, authentication, or authorization rules.

---

## 5. Identity, Privacy & Security Principles

- **Authenticated identity is canonical** for individual participation.
- **Provider subject is stable identity**, not display name.
- **Display names are presentation data** and may duplicate.
- **No child account is required** for teacher-controlled group participation.
- **Verified identity attributes only**: restricted email/phone admission must use trusted verification data.
- **No client-controlled authorization**: posted user IDs, provider subjects, email addresses, phone numbers, group IDs, or creator IDs cannot establish permission.
- **Private participant data** such as email, phone, provider subject and allowlist entries must not appear in public rosters.
- **Tenant/workspace isolation** applies equally to organizational and personal creators.
- **IP addresses are anti-abuse signals, not participant identity**. Church Wi-Fi/NAT may place many legitimate participants behind one public IP, so successful participant quotas must not be hard-limited per IP.
- **Entry credentials are not authorization**: QR codes, links, room codes and future invite codes must converge on the same server-side admission rules.

---

## 6. Non-Functional Product Pillars

- **Frictionless Participation**: Minimal barriers for both classroom group use and authenticated individual play.
- **Low-Latency Synchronization**: Timely synchronization between host, projector, groups, and mobile responses in live-game milestones.
- **Resilience in Church Environments**: Graceful handling of variable cellular or church Wi-Fi conditions and shared NAT addresses.
- **Respectful & Fellowship-Oriented**: Uplifting and encouraging atmosphere for biblical learning.
- **Privacy & Security by Design**: Authentication, admission, identity, tenant isolation, and sensitive identity attributes are enforced server-side.


---

## 8. Future Platform Capabilities

The following capabilities are deliberate future product directions and are not requirements for the current quiz MVP:

### 8.1 Transactional Email

BAREA will support transactional email as a first-class platform capability. Examples include registration, organization invitations when available, quiz participation/completion, result availability, and future resource-download notifications. Delivery will be asynchronous and must not block core application transactions. Provider selection remains deferred.

### 8.2 Analytics

BAREA will support product analytics based on server-authoritative events while keeping technical observability separate. Analytics will use data minimization, avoid unnecessary PII, and will not be used to establish authorization or authoritative quiz outcomes.

### 8.3 Advertising / Monetization

Advertising may be introduced later as a monetization option. It is not an MVP dependency. Ads must not interfere with synchronized live gameplay or become part of the authoritative quiz/session state. Future sponsorship and premium/ad-free options may also be evaluated.

### 8.4 Worship / Music Content

Future development may provide song lyrics and licensed sing-along lyric videos, including downloadable video assets and stem-based music tracks that allow church singing without live musical instruments. Copyright/licensing permissions are prerequisites to publication and download. Large media assets will use R2 rather than D1.
