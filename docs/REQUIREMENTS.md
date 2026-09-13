# BAREA System Requirements

## 1. Identity, Authentication & Authorization Requirements

### 1.1 Account Identity
- **FR-AUTH-001**: System shall maintain one canonical BAREA user identity for each registered/authenticated person.
- **FR-AUTH-002**: System shall support email/password registration and authentication.
- **FR-AUTH-003**: System shall support Google OAuth/OpenID Connect authentication using a server-authoritative authorization-code flow.
- **FR-AUTH-004**: Federated identity shall be anchored to the provider's stable subject identifier mapped to the canonical BAREA user.
- **FR-AUTH-005**: Google OIDC ID tokens shall be cryptographically verified and required claims shall be validated before identity is accepted.
- **FR-AUTH-006**: OAuth browser flows shall use state, S256 PKCE, and nonce protections with server-side validation.
- **FR-AUTH-007**: Account linking shall use trusted verified identity data and shall prevent account takeover or unsafe automatic linking.
- **FR-AUTH-008**: Authenticated sessions shall be persisted server-side and represented to the browser by a secure HttpOnly session cookie.
- **FR-AUTH-009**: Session-derived identity shall be authoritative; client-supplied user IDs, provider subjects, emails, roles, or tenant IDs shall not establish authentication or authorization.
- **FR-AUTH-010**: Logout/session revocation shall invalidate the server-side session.

### 1.2 Teacher Capability & Workspace Authorization
- **FR-AUTH-011**: Registration/authentication shall not automatically grant teacher/host capability.
- **FR-AUTH-012**: Teacher/host capability shall be represented by trusted server-side state and shall be disabled by default for newly registered users.
- **FR-AUTH-013**: A user without teacher capability shall not receive teacher-authorized access merely by navigating to a teacher route or supplying client-controlled role, organization, creator, or capability data.
- **FR-AUTH-014**: Organization workspace access shall require authoritative organization membership/role.
- **FR-AUTH-015**: A teacher-capable user may operate in an isolated personal workspace using the canonical personal tenant form `usr_ten_<user_id>` where the product flow requires it.
- **FR-AUTH-016**: Cross-tenant access shall fail closed for both personal and organization workspaces.
- **FR-AUTH-017**: The mechanism that grants teacher capability through future qualification, entitlement, approval, or payment is outside the current authentication implementation and shall not be invented as part of these requirements.

### 1.3 Authenticated Individual Participation
- **FR-AUTH-018**: An authenticated individual participant shall not require teacher capability or organization membership merely to participate.
- **FR-AUTH-019**: Individual quiz assignments/admission shall bind to the authenticated BAREA user, not a nickname-only identity.
- **FR-AUTH-020**: Anonymous nickname-only individual participation is prohibited.
- **FR-AUTH-021**: Client-supplied user, assignment, quiz, tenant, or organization identifiers shall not bypass server-side assignment/admission authorization.

## 2. Functional Requirements

### 2.1 Question Bank Management
- **FR-QB-001**: System shall store questions with attributes: identifier, stem text, answer options, correct option indicator, explanation, scripture reference, topic/category, difficulty, language, and approval status.
- **FR-QB-002**: Difficulty level must be tracked on the individual question level, with values: Easy, Medium, Hard.
- **FR-QB-003**: System shall allow teachers to search, filter (by topic, difficulty, scripture reference, language), edit, and manage questions in the bank.
- **FR-QB-004**: System shall prevent unapproved draft questions from being added to active quizzes.

### 2.2 AI Quiz Generation & Human Approval Gate
- **FR-AI-001**: System shall accept generation parameters from teachers: topic/passage, difficulty (Easy, Medium, Hard), number of questions, question type, and language.
- **FR-AI-002**: System shall perform structural validation on raw AI output to verify schema conformance, required fields, and option formats. Structural validation verifies format only and does not certify biblical accuracy.
- **FR-AI-003**: All AI-generated questions must initially be stored in a pending review state.
- **FR-AI-004**: System shall provide an interactive review interface allowing teachers to verify, edit, discard/regenerate, and explicitly approve questions.
- **FR-AI-005**: AI questions must NEVER bypass teacher approval or be directly published to a live session.

### 2.3 Quiz Authoring & Configuration
- **FR-QZ-001**: Authorized teachers can compile a quiz by selecting approved questions from the Question Bank.
- **FR-QZ-002**: Teacher can configure quiz settings including timer, scoring scheme, ordering/shuffling, participation mode, and admission policy.
- **FR-QZ-003**: Published quizzes produce a stable snapshot for live sessions to prevent unintended mid-session edits.

### 2.4 Session Management & Joining
- **FR-SES-001**: Authorized host can start a live session from a published quiz, generating a unique room access code and corresponding join URL / QR code.
- **FR-SES-002**: Participants can enter via QR code, direct URL, or room access code, subject to the configured admission policy.
- **FR-SES-003**: Authenticated individual participation shall bind the participant to the server-resolved BAREA user; display name is presentation data only.
- **FR-SES-004**: System maintains the necessary server-side participant/session state to support authorized session resumption.
- **FR-SES-005**: Entry mechanisms such as QR codes, URLs, and access codes shall not themselves grant authorization.

### 2.5 Synchronized Live Quiz Engine
- **FR-LIVE-001**: The game state machine must transition through LOBBY -> QUESTION_PREVIEW -> QUESTION_ACTIVE -> QUESTION_RESULT -> LEADERBOARD -> FINAL_PODIUM.
- **FR-LIVE-002**: Host possesses authoritative controls to start game, advance to next step, pause, or end game.
- **FR-LIVE-003**: Projector view shall expose only state-authorized information.
- **FR-LIVE-004**: Participant mobile view shall expose only information authorized for the current server state.

### 2.6 Server-Authoritative Scoring & Leaderboards
- **FR-SC-001**: Participant answers must be validated and scored strictly by the server.
- **FR-SC-002**: Answers submitted after the server-recorded question expiration are marked late and awarded zero points.
- **FR-SC-003**: Leaderboard standings must be calculated server-side based on accumulated scores.

## 3. Non-Functional & Quality Requirements

### 3.1 Latency & Synchronization
- **NFR-SYNC-001**: Live state transitions from host action must synchronize across projector and participant screens in a timely manner.
- **NFR-SYNC-002**: The client interface must provide immediate local interaction feedback upon answer selection.

### 3.2 Network Resilience
- **NFR-RES-001**: System must support automatic reconnection and state restoration if participant mobile connectivity drops intermittently during a live session.
- **NFR-RES-002**: Temporary host disconnection must not terminate the room state; session remains stable pending host reconnect.

### 3.3 Usability & Presentation
- **NFR-UX-001**: Mobile participant interface must be intuitive.
- **NFR-UX-002**: Projector display must feature high-contrast, large typography suitable for viewing across classrooms, youth halls, and church sanctuaries.

### 3.4 Security & Content Integrity
- **NFR-SEC-001**: Correct answer indicators must NEVER be transmitted to participant devices during the active answering window. Correct answers are disclosed only during the authorized result state.
- **NFR-SEC-002**: Host control actions must be authenticated and restricted to authorized session hosts with the required teacher/workspace capability.
- **NFR-SEC-003**: Input validation and sanitization must prevent malformed payloads, injection, and inappropriate screen display.
- **NFR-SEC-004**: Authorization must fail closed when authenticated identity, teacher capability, workspace membership, tenant ownership, or assignment/admission state cannot be established.
