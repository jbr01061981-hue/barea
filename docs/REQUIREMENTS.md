# BAREA System Requirements

## 1. Functional Requirements

### 1.1 Question Bank Management
- **FR-QB-001**: System shall store questions with attributes: identifier, stem text, answer options, correct option indicator, explanation, scripture reference, topic/category, difficulty, language, and approval status.
- **FR-QB-002**: Difficulty level must be tracked on the individual question level, with values: Easy, Medium, Hard.
- **FR-QB-003**: System shall allow teachers to search, filter (by topic, difficulty, scripture reference, language), edit, and manage questions in the bank.
- **FR-QB-004**: System shall prevent unapproved draft questions from being added to active quizzes.

### 1.2 AI Quiz Generation & Human Approval Gate
- **FR-AI-001**: System shall accept generation parameters from teachers: topic/passage, difficulty (Easy, Medium, Hard), number of questions, question type, and language.
- **FR-AI-002**: System shall perform structural validation on raw AI output to verify schema conformance, required fields, and option formats. Structural validation verifies format only and does not certify biblical accuracy.
- **FR-AI-003**: All AI-generated questions must initially be stored in a pending review state.
- **FR-AI-004**: System shall provide an interactive review interface allowing teachers to:
  - Verify scriptural accuracy and theological appropriateness.
  - Edit question stem, answer options, correct answer, and explanations.
  - Adjust question-level difficulty.
  - Discard undesirable questions or request regeneration.
  - Explicitly approve individual questions or batches into the Question Bank.
- **FR-AI-005**: AI questions must NEVER bypass teacher approval or be directly published to a live session.

### 1.3 Quiz Authoring & Configuration
- **FR-QZ-001**: Teachers can compile a quiz by selecting approved questions from the Question Bank.
- **FR-QZ-002**: Teacher can configure quiz settings:
  - Per-question timer limit.
  - Scoring scheme.
  - Question ordering and option shuffling.
  - Answer explanation reveal.
- **FR-QZ-003**: Published quizzes produce a stable snapshot for live sessions to prevent unintended mid-session edits.

### 1.4 Session Management & Joining
- **FR-SES-001**: Host can start a live session from a published quiz, generating a unique room access code and corresponding join URL / QR code.
- **FR-SES-002**: Participants can join via QR code scan, direct URL, or room access code entry.
- **FR-SES-003**: Participants provide a display name; system shall validate length and sanitize against inappropriate language.
- **FR-SES-004**: System maintains a participant session token to enable automatic session resumption upon page refresh or temporary network disconnect.

### 1.5 Synchronized Live Quiz Engine
- **FR-LIVE-001**: The game state machine must transition through:
  LOBBY -> QUESTION_PREVIEW -> QUESTION_ACTIVE -> QUESTION_RESULT -> LEADERBOARD -> FINAL_PODIUM.
- **FR-LIVE-002**: Host possesses authoritative controls to start game, advance to next step, pause, or end game.
- **FR-LIVE-003**: Projector view displays:
  - In Lobby: Room code, QR code, participant join count, and participant names.
  - In Question Active: Question text, answer option cards, countdown timer, and live response progress.
  - In Question Result: Distribution of participant answers, highlighted correct answer, scripture reference, and explanation.
  - In Leaderboard: Standings and score differentials.
  - In Podium: Final celebratory standings.
- **FR-LIVE-004**: Participant mobile view displays:
  - In Lobby: Connection confirmation and waiting state.
  - In Question Active: Responsive touch buttons corresponding to answer options and remaining time indicator.
  - On Answer Selected: Immediate acknowledgment that the response was submitted.
  - In Question Result: Outcome indicator, points awarded, and scripture context.

### 1.6 Server-Authoritative Scoring & Leaderboards
- **FR-SC-001**: Participant answers must be validated and scored strictly by the server.
- **FR-SC-002**: Answers submitted after the server-recorded question expiration are marked late and awarded zero points.
- **FR-SC-003**: Leaderboard standings must be calculated server-side based on accumulated scores.

---

## 2. Non-Functional & Quality Requirements

### 2.1 Latency & Synchronization
- **NFR-SYNC-001**: Live state transitions from host action must synchronize across projector and participant screens in a timely manner.
- **NFR-SYNC-002**: The client interface must provide immediate local interaction feedback upon answer selection.

### 2.2 Network Resilience
- **NFR-RES-001**: System must support automatic reconnection and state restoration if participant mobile connectivity drops intermittently during a live session.
- **NFR-RES-002**: Temporary host disconnection must not terminate the room state; session remains stable pending host reconnect.

### 2.3 Usability & Presentation
- **NFR-UX-001**: Mobile participant interface must be intuitive, requiring zero onboarding or training.
- **NFR-UX-002**: Projector display must feature high-contrast, large typography suitable for viewing across classrooms, youth halls, and church sanctuaries.

### 2.4 Security & Content Integrity
- **NFR-SEC-001**: Correct answer indicators must NEVER be transmitted to participant devices during the active answering window. Correct answers are disclosed only during the result state.
- **NFR-SEC-002**: Host control actions must be authenticated and restricted to authorized session hosts.
- **NFR-SEC-003**: Input validation and sanitization must prevent malformed payloads, injection, and inappropriate screen display.
