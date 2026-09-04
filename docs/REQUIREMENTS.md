# BAREA System Requirements

## 1. Functional Requirements

### 1.1 Question Bank Management
- **FR-QB-001**: System shall store questions with attributes: id, stem, options, correct_option_indices, explanation, scripture_reference, 	opic, difficulty, language, created_by, status.
- **FR-QB-002**: Difficulty level must be tracked on the individual question level, with values: Easy, Medium, Hard.
- **FR-QB-003**: System shall allow teachers to search, filter (by topic, difficulty, scripture book, language), update, and soft-delete questions in the bank.
- **FR-QB-004**: System shall prevent questions with status DRAFT or PENDING_REVIEW from being added to active quizzes.

### 1.2 AI Quiz Generation & Human Approval Gate
- **FR-AI-001**: System shall accept generation parameters from teachers: topic/passage, difficulty target (Easy, Medium, Hard, or mixed), question count (1 to 20 per request), question type, and language.
- **FR-AI-002**: Generated questions must be structured strictly to the Question schema, including scripture references and biblical context explanations.
- **FR-AI-003**: All AI-generated questions must initially be stored in PENDING_REVIEW state.
- **FR-AI-004**: System shall provide an interactive review interface allowing teachers to:
  - Edit question text, options, and explanations.
  - Reclassify question difficulty.
  - Re-verify scripture references against standard Bible translations.
  - Discard undesirable questions or request targeted regeneration.
  - Explicitly approve individual questions or batches into the Question Bank (APPROVED).
- **FR-AI-005**: AI questions must **NEVER** bypass teacher approval or be directly published to a live session.

### 1.3 Quiz Authoring & Configuration
- **FR-QZ-001**: Teachers can compile a quiz by selecting approved questions from the Question Bank or assembling a new set.
- **FR-QZ-002**: Teacher can configure per-quiz settings:
  - Per-question timer (10s, 20s, 30s, 60s, or custom).
  - Scoring rules (flat score vs. time-decay bonus).
  - Shuffle questions and/or shuffle answer options.
  - Reveal answer explanation toggle.
- **FR-QZ-003**: Published quizzes generate an immutable snapshot for active game sessions to avoid unintended edits during a live game.

### 1.4 Session Management & Joining
- **FR-SES-001**: Host can start a live session from a published quiz, generating a unique 6-character room access code and a corresponding join URL/QR code.
- **FR-SES-002**: Participants can join via QR code scan, direct URL, or room PIN entry.
- **FR-SES-003**: Participants provide a nickname/display name; system shall validate length (2–20 characters) and sanitize against inappropriate language.
- **FR-SES-004**: System issues a persistent session token (e.g., cookie or local storage JWT) allowing participants to automatically resume if connection drops or page refreshes.

### 1.5 Synchronized Live Quiz Engine
- **FR-LIVE-001**: The game state machine must transition through:
  LOBBY ➔ QUESTION_PREVIEW ➔ QUESTION_ACTIVE ➔ QUESTION_RESULT ➔ INTERMEDIATE_LEADERBOARD ➔ FINAL_PODIUM.
- **FR-LIVE-002**: Host possesses authoritative controls to Start Game, Advance to Next Question, Pause/Resume, Re-open Answering, or End Game.
- **FR-LIVE-003**: Projector view displays:
  - In Lobby: Room PIN, QR code, join count, participant avatar/name stream.
  - In Question Active: Large question text, answer option cards, synchronized circular timer, live answer count indicator.
  - In Question Result: Bar chart of participant answer distribution, highlighted correct answer, scripture reference, and explanation.
  - In Leaderboard: Top 5/10 players, podium standings, score differentials.
- **FR-LIVE-004**: Participant mobile view displays:
  - In Lobby: Connection confirmation and waiting banner.
  - In Question Active: High-contrast touch buttons matching answer options (A/B/C/D or text cards), remaining time bar.
  - On Answer Selected: Immediate optimistic acknowledgment (Answer Received! Waiting for time up...).
  - In Question Result: Correct/incorrect indicator, points awarded, scripture note.

### 1.6 Server-Authoritative Scoring & Leaderboards
- **FR-SC-001**: Answers submitted by mobile participants must be validated and scored strictly on the backend.
- **FR-SC-002**: Submission timestamp must be verified against the server's question start and expiry timestamps; submissions arriving after question expiry (	ime_limit + grace_period) are marked LATE and awarded 0 points.
- **FR-SC-003**: Leaderboard ranks must be calculated server-side based on accumulated points and tiebreaker criteria (e.g., total response time).

---

## 2. Non-Functional Requirements

### 2.1 Performance & Latency
- **NFR-PERF-001**: WebSocket/Real-time state broadcast from Host action to all client screens must complete within 300ms under standard network conditions.
- **NFR-PERF-002**: System must support at least 250 concurrent mobile participants per single live room without frame drops or message backlog.
- **NFR-PERF-003**: Mobile client initial load bundle must be under 300KB gzipped to ensure rapid load on constrained mobile network connections.

### 2.2 Reliability & Fault Tolerance
- **NFR-REL-001**: If a mobile participant experiences network interruption or browser refresh, the client must reconnect and restore current question state within 2 seconds.
- **NFR-REL-002**: Host disconnect should not crash the game room; room state remains paused in current step until host reconnects or timeout expires.

### 2.3 Usability & Accessibility
- **NFR-UX-001**: Mobile participant UI must require zero onboarding instructions and feature touch targets of at least 48x48 pixels.
- **NFR-UX-002**: Projector view must be legible at 1080p and 4K resolutions from a distance of 30+ feet in ambient church lighting (high contrast ratio >= 4.5:1).

### 2.4 Security & Data Integrity
- **NFR-SEC-001**: Question correct answers must **NEVER** be sent over the wire to mobile participants while a question is active. Correct answers are only broadcast during the QUESTION_RESULT state.
- **NFR-SEC-002**: Host endpoints must require authentication; participant endpoints require valid room tokens.
- **NFR-SEC-003**: Rate limiting must be enforced on join endpoints and answer submission endpoints to prevent spamming or DoS.
