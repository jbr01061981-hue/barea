# BAREA Product Specification

## 1. Executive Summary

**BAREA** is a synchronized church quiz platform designed specifically for Christian communities, including Sunday schools, youth ministries, adult Bible fellowships, and congregation-wide quiz events.

BAREA combines interactive group engagement with biblical integrity and theological fidelity. It removes the friction of quiz preparation through intelligent, bounded AI generation while keeping Christian educators firmly in control of content.

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
  - Dedicated host console with controls for advance, pause, reveal answer, and leaderboard display.
  - Oversight of connected participants.

### 2.2 The Mobile Participant
- **Profile**: Students, youth, church members, and visitors of all ages and technical literacies.
- **Goals**:
  - Rapid, frictionless game joining without mandatory app installations or account registrations.
  - Clear, immediate feedback upon submitting answers.
  - Friendly, uplifting competition without public embarrassment.
- **Key Needs**:
  - Join via camera scan (QR code), one-click link, or room access code.
  - Clear touch targets and state feedback (Waiting, Answering, Answer Submitted, Result Revealed).

### 2.3 The Congregation / Audience (Projector View)
- **Profile**: In-person audience gathered in a sanctuary, classroom, or fellowship hall watching the main screen.
- **Goals**:
  - Engaging communal experience where everyone can read the question, timer, and see community performance.
- **Key Needs**:
  - High-contrast, large-format display with clean typography readable from a distance.
  - Live participant count, countdown timer, answer distribution overview, and celebratory podium/leaderboard screens.

---

## 3. Product Modules & Experiences

### 3.1 Question Bank & Content Management
- Serves as the persistent library of reusable, categorized questions.
- Question attributes:
  - **Scripture Reference** (e.g., Genesis 1:1-5, Romans 8:28).
  - **Topic / Category** (e.g., Old Testament, Parables, Early Church, Fruit of the Spirit).
  - **Difficulty Level**: **Easy**, **Medium**, **Hard** (difficulty resides directly on each question).
  - **Question Type**: Multiple Choice, Multi-Select, True/False.
  - **Language**: English, Spanish, Telugu, Tamil, and multi-language support.
  - **Explanations / Scripture Context**: Accompanying biblical context shown upon answer reveal.

### 3.2 AI Quiz Generation (Core MVP Capability)
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

### 3.3 Quiz Authoring & Publishing
- Combine questions from the Question Bank and freshly approved AI questions into an ordered quiz.
- Configurable rules per quiz:
  - Time per question.
  - Scoring scheme.
  - Question and option ordering.
  - Publishing workflow for live sessions.

### 3.4 Join & Onboarding Experience
- Seamless join pathways:
  1. **QR Code**: Displayed on projector screen; mobile camera directly opens game lobby.
  2. **Direct URL**: Shareable via messaging or web link.
  3. **Room Access Code**: Simple alphanumeric code entered on the join page.
- Participant inputs a display name (with inappropriate language filtering) and enters the waiting room.

### 3.5 Live Synchronized Quiz Engine
- Real-time synchronization across Host, Mobile, and Projector views.
- Supported game states:
  1. **Lobby / Waiting Room**: Participants join; host sees roster; projector displays join QR and room code.
  2. **Question Preview**: Countdown cue before question answering opens.
  3. **Question Active**: Projector displays question & timer; mobile displays answer buttons; synchronized timer counts down.
  4. **Answer Reveal**: Answering closes server-side; correct answer and scripture explanation displayed.
  5. **Question Leaderboard**: Scores and rankings displayed on projector.
  6. **Final Podium**: Concluding celebration with full results summary.

### 3.6 Server-Authoritative Scoring & Leaderboard
- Server validates answers and calculates scores based on receipt time and correctness.
- Prevents client-side manipulation or cheating.
- Resilient connection handling: if a mobile participant experiences network interruption, the client reconnects and resumes the current server state.

---

## 4. Non-Functional Product Pillars

- **Frictionless Participation**: Minimal barriers to join; fast access on mobile browsers.
- **Low-Latency Synchronization**: Timely synchronization between host actions, projector screen, and mobile responses.
- **Resilience in Church Environments**: Graceful handling of variable cellular or church Wi-Fi conditions.
- **Respectful & Fellowship-Oriented**: Uplifting and encouraging atmosphere for biblical learning.
