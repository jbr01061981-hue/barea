# BAREA Product Specification

## 1. Executive Summary

**BAREA** is a synchronized, real-time church quiz platform designed specifically for Christian communities, including Sunday schools, youth groups, adult Bible fellowships, and congregation-wide quiz nights.

BAREA combines the excitement of modern interactive trivia with biblical integrity and theological fidelity. It removes the friction of quiz creation through intelligent, bounded AI generation while keeping Christian educators firmly in control of content.

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
  - Dedicated host console with controls for advance, pause, reveal answer, and leaderboard toggle.
  - Oversight of connected participants and live scores.

### 2.2 The Mobile Participant
- **Profile**: Students, youth, church members, and visitors of all ages and technical literacies.
- **Goals**:
  - Rapid, frictionless game joining without requiring app installations or account registrations.
  - Clear, immediate feedback upon submitting answers.
  - Friendly, uplifting competition without public embarrassment.
- **Key Needs**:
  - Join via camera scan (QR code), one-click link, or 6-digit access code.
  - Large touch targets, accessible colors, and real-time state feedback (Waiting, Answering, Answer Submitted, Result Revealed).

### 2.3 The Congregation / Audience (Projector View)
- **Profile**: In-person audience gathered in a sanctuary, classroom, or fellowship hall watching the main screen.
- **Goals**:
  - Engaging communal experience where everyone can read the question, timer, and see community performance.
- **Key Needs**:
  - High-contrast, large-format display with clean typography readable from a distance.
  - Live participant count, countdown animations, answer distribution bar charts, and celebratory podium/leaderboard screens.

---

## 3. Product Modules & Experiences

### 3.1 Question Bank & Content Management
- Serves as the persistent library of reusable, categorized questions.
- Metadata attributes:
  - **Scripture Reference** (e.g., *Genesis 1:1-5*, *Romans 8:28*).
  - **Topic / Category** (e.g., Old Testament Patriarchs, Parables, Early Church History, Fruit of the Spirit).
  - **Difficulty Level**: **Easy**, **Medium**, **Hard** (difficulty resides on each individual question).
  - **Question Type**: Multiple Choice (Single Correct), Multi-Select, True/False.
  - **Language**: English, Spanish, Telugu, Tamil, and multi-language support.
  - **Explanations / Scripture Context**: Accompanying biblical context shown upon answer reveal.

### 3.2 AI Quiz Generation (Core MVP Capability)
- AI acts as a creative teaching assistant, eliminating writer's block.
- Generation parameters selectable by teacher:
  - Topic / Book / Chapter / Theme.
  - Target difficulty distribution (Easy, Medium, Hard).
  - Number of questions.
  - Question types (Multiple choice, True/False).
  - Language.
- **Mandatory Review Gate**:
  `	ext
  [AI Generation Request]
            │
            ▼
  [Structured Schema & Scripture Validation]
            │
            ▼
  [Teacher Review Workspace]
  - Edit question stem
  - Edit answer options / correct answer
  - Modify scripture reference & explanation
  - Change difficulty
  - Regenerate single question or batch
            │
            ▼
  [Teacher Explicit Approval]
            │
            ▼
  [Question Bank] ──► [Quiz Compilation]
  `
- **Strict Rule**: AI-generated questions are NEVER live or public until a human teacher validates and approves them.

### 3.3 Quiz Authoring & Publishing
- Combine questions from the Question Bank and freshly approved AI questions into an ordered quiz playlist.
- Configurable rules per quiz:
  - Time per question (e.g., 15s, 30s, 45s).
  - Scoring scheme (standard points, optional speed bonus).
  - Question randomization / option shuffling.
  - Quiz publishing generates a unique, shareable join session.

### 3.4 Join & Onboarding Experience
- Three zero-friction join pathways:
  1. **QR Code**: Displayed on projector screen; mobile camera directly opens game lobby.
  2. **Direct URL**: Shareable in WhatsApp groups or church bulletins (e.g., area.app/join/ABCXYZ).
  3. **6-Character Access Code**: Simple alphanumeric code typed into landing page.
- Participant inputs a display name (with profanity/inappropriate name filtering) and enters the waiting room.

### 3.5 Live Synchronized Quiz Engine
- Real-time synchronization across Host, Mobile, and Projector views.
- Supported game states:
  1. **Lobby / Waiting Room**: Participants join; host sees roster; projector displays join QR and PIN.
  2. **Get Ready / Countdown**: 3-2-1 cue before question is displayed.
  3. **Question Active**: Projector displays question & timer; mobile displays answer buttons; timer counts down synchronously.
  4. **Time Up / Answer Reveal**: Answering closes server-side; correct answer and scripture explanation highlighted on all screens.
  5. **Question Leaderboard**: Top scorers and biggest movers highlighted on projector.
  6. **Final Podium**: 1st, 2nd, and 3rd place celebration with full results summary.

### 3.6 Server-Authoritative Scoring & Leaderboard
- Server calculates score based on arrival timestamp and correctness.
- Prevents client-side manipulation or replay attacks.
- Graceful reconnection: if a mobile participant briefly loses network connection, their session reconnects to the current server state seamlessly.

---

## 4. Non-Functional Pillars

- **Zero Participant Friction**: No password, no app store download, no email registration required to play.
- **Low Latency (<300ms)**: Sub-second synchronization between host action, projector update, and mobile phone input.
- **Robustness in Low Wi-Fi**: Church basements and sanctuaries often have weak cellular or crowded Wi-Fi; payload sizes must be minimal with optimistic local feedback and resilient reconnection.
- **Respectful & Fellowship-Oriented**: Positive reinforcement design; avoid discouraging low scorers; celebrate community participation.
