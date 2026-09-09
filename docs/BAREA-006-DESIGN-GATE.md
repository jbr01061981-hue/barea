# BAREA-006: Share/Join — System Design & Verification Gate

**Status: COMPLETE DESIGN GATE — POST-REMEDIATION VERIFIED BY 6 SPECIALIZED SUB-AGENTS**  
**Date: 2026-09-09**  
**Dependency:** BAREA-005 completed and merged on `main` (`94af326`)  
**Implementation Authorization:** NOT AUTHORIZED (Design Gate Only — Awaiting User Independent GO / NO-GO)

---

## 1. Objective & Canonical Workflow

The objective of **BAREA-006: Share/Join** is to design the domain model, persistence schema, server-authoritative security boundaries, room-code generation and collision handling, QR/join URL infrastructure, low-friction mobile landing flow, nickname validation, duplicate-name handling, and session resumption mechanics for church quizzes.

BAREA-006 establishes how participants discover, join, and anchor their presence in a scheduled quiz session **without creating persistent accounts**, and how teachers/hosts generate and display session access surfaces.

### Canonical BAREA-006 Workflow

```text
[Published Quiz Snapshot (BAREA-005)]
               ↓
[Host Creates Quiz Session via Server Action (createSessionAction)]
  - Context strictly from getAuthorizedTeacherContext()
  - Reference to published_quiz_snapshots(id)
  - Generate 6-char cryptographic room code (unambiguous alphabet)
               ↓
[Server provides Session + Safe Public Join URL + High-Contrast SVG QR Code]
  - Base URL strictly from process.env.NEXT_PUBLIC_APP_URL (prevents Host Header Poisoning)
  - QR Code contains pure URL (zero auth secrets, zero question data)
               ↓
[Host / Podium Sharing View renders high-contrast QR & 6-char Room Code for Sanctuary Display]
               ↓
[Participant lands on /join or /join/[roomCode] via mobile browser]
  - Server Component pre-validates roomCode and renders public metadata
  - Input field formatted with large touch targets, uppercase, tracking-widest, monospace
               ↓
[Participant enters Nickname]
               ↓
[Server validates & normalizes Nickname]
  - NFKC normalization, strip/reject [\x00-\x1F\x7F\u200B-\u200D\u202A-\u202E\p{Cf}], HTML tags
  - Trim and collapse multiple spaces to a single space, enforce [2..24] chars
  - Automatic deterministic numerical suffixing if taken: "Sarah" -> "Sarah (2)"
               ↓
[Server issues Session-Scoped Ephemeral Participant Token (ptok_...)]
  - Evaluated outside transaction to minimize write lock time
  - Stored in SQLite as HMAC-SHA256: hmac_sha256(AUTH_SECRET, sessionId + ":" + rawToken)
  - Raw token returned ONCE to client in ParticipantAuthPayload
               ↓
[Client stores token in sessionStorage + session-scoped Cookie]
  - Key: barea:session:<sessionId>
  - Resilient to mobile page refresh / camera re-scan, tab-isolated for family devices
               ↓
[Participant enters Waiting Room / Lobby State]
  - Mobile UI shows: "You're in! Waiting for the host to start..."
  - If suffixed, shows clear notification: "You are joined as Sarah (2)"
               ↓
[Host Console displays live participant roster via getHostSessionRosterAction]
  - Host can lock session (lockSessionAction) or kick participant (kickParticipantAction)
               ↓
[BOUNDARY GATE: BAREA-007 Live State Machine / Websocket Transport (NOT IN BAREA-006)]
```

---

## 2. Scope & Explicit Non-Goals

### In Scope (BAREA-006)
1. **Host Session Creation**: Creating a `QuizSession` referencing an immutable `PublishedQuizSnapshot` from BAREA-005.
2. **Cryptographic Room Code Generation**: 6-character alphanumeric code using an unambiguous 31-character alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), generated via `node:crypto.randomInt()`, with case-insensitive normalization and collision retry loop.
3. **Dynamic Join URL & Pure SVG QR Code**: Canonical URL shape (`/join/[roomCode]` or `/join?code=[roomCode]`), rendered on the Host sharing surface via pure SVG generation without external third-party API calls or privileged credential leakage.
4. **Low-Friction Mobile Landing Experience**: Responsive mobile viewport for room-code and nickname entry adhering to `docs/FRONTEND-STANDARD.md` and React Aria Components.
5. **Strict Nickname Validation & Duplicate Handling**: Trimming, Unicode NFKC normalization, length bounds (2–24 characters), control character, zero-width space, and HTML stripping, and deterministic duplicate-name handling (automatic numerical suffixing within the session).
6. **Ephemeral Participant Identity & Session Resumption**: Issuing a session-scoped cryptographic participant token (`ptok_...`), persisting only its HMAC-SHA256 hash in SQLite, allowing secure session resumption across page refreshes or network drops.
7. **Host Lobby Management**: Host roster inspection (`getHostSessionRosterAction`), session locking (`lockSessionAction`), and participant removal (`kickParticipantAction`).
8. **Dual-Bucket Rate Limiting**: Per-IP and global fail-closed rate limiters for room-code lookup and session join endpoints to prevent brute-force scanning.
9. **Multi-Tenant Isolation**: Host actions strictly enforced via `getAuthorizedTeacherContext()`; public participant actions strictly scoped to the active session.
10. **Persistence & SQLite Constraints**: Dedicated tables (`quiz_sessions`, `session_participants`), `state_version` for concurrency control, foreign keys, uniqueness constraints, indexes, and atomic `BEGIN IMMEDIATE` transactions with WAL mode and busy timeout.
11. **Comprehensive Adversarial Test Matrix**: 34 named adversarial cases (`ADV-SJ-01` through `ADV-SJ-34`) covering collisions, races, brute-force limits, XSS, token forgery, session resumption, and boundary leak prevention.

### Explicit Non-Goals (Strict Milestone Boundaries)
To ensure absolute adherence to milestone discipline, the following are strictly excluded from BAREA-006:
- **No Live Quiz State Machine**: No `LOBBY -> QUESTION_PREVIEW -> QUESTION_ACTIVE -> QUESTION_RESULT -> LEADERBOARD` state engine (belongs to BAREA-007).
- **No Real-Time Transport**: No WebSockets, Socket.io, or SSE connections (belongs to BAREA-007).
- **No Authoritative Timers or Countdown Synchronization** (belongs to BAREA-007).
- **No Participant Answer Submissions or Live Scoring Engine** (belongs to BAREA-007/009).
- **No Standings, Leaderboards, or Podium Animations** (belongs to BAREA-010).
- **No Dedicated Live Sanctuary/Projector Display Experience** (belongs to BAREA-011; BAREA-006 provides only the host share modal/card).
- **No Global Participant Accounts or Cross-Session Profiles** (ADR-003: sessions are ephemeral).
- **No Question Bank / Snapshot Mutations**: Sessions reference immutable BAREA-005 snapshots; no questions can be modified or injected during session creation.

---

## 3. Session Domain Model & TypeScript Types

The Session domain resides in `src/domain/session.ts` and models the lifecycle of a hosted quiz event.

```typescript
import { RoomCode, Nickname, ParticipantToken } from './value-objects';

export const SessionStatus = Object.freeze({
  LOBBY: 'LOBBY',         // Accepting participants (BAREA-006 entry state)
  ACTIVE: 'ACTIVE',       // Reserved for BAREA-007 live gameplay
  COMPLETED: 'COMPLETED', // Live gameplay concluded
  CLOSED: 'CLOSED'        // Host terminated or expired
} as const);
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export type QuizSession =
  | {
      readonly id: string;
      readonly organizationId: string;
      readonly publishedQuizSnapshotId: string;
      readonly hostUserId: string;
      readonly roomCode: RoomCode;
      readonly status: 'LOBBY' | 'ACTIVE';
      readonly isLocked: boolean;
      readonly stateVersion: number;
      readonly maxParticipants: number;
      readonly createdAt: string;              // ISO-8601 UTC
      readonly expiresAt: string;              // ISO-8601 UTC (createdAt + 4 hours)
      readonly closedAt: null;
    }
  | {
      readonly id: string;
      readonly organizationId: string;
      readonly publishedQuizSnapshotId: string;
      readonly hostUserId: string;
      readonly roomCode: RoomCode;
      readonly status: 'COMPLETED' | 'CLOSED';
      readonly isLocked: boolean;
      readonly stateVersion: number;
      readonly maxParticipants: number;
      readonly createdAt: string;
      readonly expiresAt: string;
      readonly closedAt: string;               // ISO-8601 UTC
    };

export interface SessionPublicInfo {
  readonly sessionId: string;
  readonly roomCode: RoomCode;
  readonly quizTitle: string;
  readonly organizationName?: string;
  readonly sessionStatus: SessionStatus;
  readonly isLocked: boolean;
  readonly totalQuestions: number;
  readonly defaultTimeLimitSeconds: number;
  readonly participantCount: number;
}

export interface SessionParticipant {
  readonly id: string;
  readonly sessionId: string;
  readonly nickname: Nickname;               // Normalized display name
  readonly joinedAt: string;                 // ISO-8601 UTC
  readonly lastActiveAt: string;             // ISO-8601 UTC
  readonly isConnected: boolean;
}

export interface ParticipantAuthPayload {
  readonly participantId: string;
  readonly sessionId: string;
  readonly nickname: Nickname;
  readonly token: ParticipantToken;          // Plaintext token returned ONCE to client
}

export interface HostRosterEntry {
  readonly participantId: string;
  readonly nickname: Nickname;
  readonly joinedAt: string;
  readonly isConnected: boolean;
}
```

### Snapshot Immutability Linkage
- `QuizSession.publishedQuizSnapshotId` must reference an existing row in `published_quiz_snapshots`.
- The session **never** duplicates question stems or options into session tables.
- Sessions cannot be created for `DRAFT` or `ARCHIVED` quizzes—only for frozen, published snapshots.

---

## 4. Value Objects & Branded Types

To eradicate primitive obsession and enforce rigorous runtime boundaries, domain types are modeled as branded types in `src/domain/value-objects.ts`:

```typescript
import {
  InvalidRoomCodeError,
  InvalidNicknameError,
  InvalidParticipantTokenError
} from './domain-errors';

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RoomCode = Brand<string, 'RoomCode'>;
export type ParticipantToken = Brand<string, 'ParticipantToken'>;
export type Nickname = Brand<string, 'Nickname'>;

// 1. RoomCode: Exactly 6 unambiguous uppercase characters (2-9, A-Z excl. 0, 1, I, O)
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export function normalizeAndValidateRoomCode(raw: unknown): RoomCode {
  if (typeof raw !== 'string') {
    throw new InvalidRoomCodeError('Room code must be a string.');
  }
  const normalized = raw.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(normalized)) {
    throw new InvalidRoomCodeError(
      `Room code must be exactly 6 characters using valid alphabet (${ROOM_CODE_ALPHABET}). Got: '${normalized}'`
    );
  }
  return normalized as RoomCode;
}

// 2. Nickname: 2..24 chars, NFKC normalized, whitespace collapsed, control, zero-width, bidi, and HTML rejected
const NICKNAME_ALLOWED_REGEX = /^[\p{L}\p{N}\s\-_]+$/u;
const HTML_TAG_REGEX = /<[^>]*>/;
const ILLEGAL_CHARS_REGEX = /[\x00-\x1F\x7F\u200B-\u200D\u202A-\u202E\uFEFF\p{Cf}]/u;

export function normalizeAndValidateNickname(raw: unknown): Nickname {
  if (typeof raw !== 'string') {
    throw new InvalidNicknameError('Nickname must be a string.');
  }
  // Unicode NFKC normalization
  let normalized = raw.normalize('NFKC').trim();

  // Reject illegal control characters, invisible/zero-width characters, bidi overrides, and HTML tags
  if (ILLEGAL_CHARS_REGEX.test(normalized) || HTML_TAG_REGEX.test(normalized)) {
    throw new InvalidNicknameError('Nickname contains illegal control, invisible, or markup characters.');
  }

  // Collapse consecutive internal spaces
  normalized = normalized.replace(/\s+/g, ' ');

  if (normalized.length < 2) {
    throw new InvalidNicknameError('Nickname must be at least 2 characters.');
  }
  if (normalized.length > 24) {
    throw new InvalidNicknameError('Nickname cannot exceed 24 characters.');
  }
  if (!NICKNAME_ALLOWED_REGEX.test(normalized)) {
    throw new InvalidNicknameError('Nickname contains unsupported characters.');
  }

  return normalized as Nickname;
}

// 3. ParticipantToken: 'ptok_' followed by 43 base64url characters (~256 bits entropy)
export const PARTICIPANT_TOKEN_REGEX = /^ptok_[A-Za-z0-9_-]{43}$/;

export function validateParticipantToken(raw: unknown): ParticipantToken {
  if (typeof raw !== 'string' || !PARTICIPANT_TOKEN_REGEX.test(raw)) {
    throw new InvalidParticipantTokenError('Invalid participant session token format.');
  }
  return raw as ParticipantToken;
}
```

---

## 5. Room Code Security, Entropy & Rate Limiting

### Alphabet & Entropy Specification
- **Alphabet**: 31 unambiguous alphanumeric characters:
  `2 3 4 5 6 7 8 9 A B C D E F G H J K L M N P Q R S T U V W X Y Z`
  (Excludes `0`, `1`, `I`, `O` to prevent user transcription confusion on projectors or small screens).
- **Length**: Exactly **6 characters** (e.g., `8K4M9Z`).
- **Keyspace / Entropy**: 31^6 = 887,503,681 possible combinations (~29.7 bits).
- **Secure RNG**: Generated via `crypto.randomInt(0, 31)` for each character (strictly prohibiting `Math.random()`).
- **Normalization**: User input is trimmed and converted to uppercase: `rawCode.trim().toUpperCase()`.
- **Deterministic Seam**: Factory supports pluggable `RoomCodeGenerator` interface for deterministic collision testing in automated test suites:
  ```typescript
  export interface RoomCodeGenerator {
    generate(): RoomCode;
  }
  ```

### Dual-Bucket Rate Limiting (Brute-Force & Enumeration Resistance)
Given 887M combinations, an unthrottled attacker could scan active sessions. Both `lookupRoomAction` and `joinSessionAction` are shielded by dual-bucket rate limiting:
1. **Per-IP Rate Limit**: Maximum 15 failed lookups per rolling 60-second window per IP address (resolved using `CF-Connecting-IP` / `X-Forwarded-For` with fallback to socket remote address).
2. **Global Fail-Closed Sentinel**: If more than 250 consecutive invalid room code attempts occur globally across all IPs within 1 minute, the system activates global throttling to damp automated bot swarms.
3. **Generic Responses**: Failed lookups return a generic error: `"Session not found or is no longer accepting participants."` (indistinguishable for expired, closed, locked, or nonexistent codes).

---

## 6. Participant Identity, Token Hashing & Session Resumption

### Token Architecture & Hashing Invariant
1. **Raw Token Generation**: `ptok_` prefix + 32 bytes of cryptographically secure random bytes base64url-encoded (`ptok_` + 43 characters = 48 characters total, ~256 bits of entropy).
2. **HMAC-SHA256 Token Storage**: The server **never** stores raw participant tokens in the database. Tokens are hashed using HMAC-SHA256 keyed with server `SESSION_AUTH_SECRET`:
   `token_hash = crypto.createHmac('sha256', SESSION_AUTH_SECRET).update(sessionId + ':' + rawToken).digest('hex')`
   This guarantees that even if a read-only database dump occurs, tokens cannot be forged or replayed without the server secret.
3. **Timing-Safe Verification**: When authenticating or resuming a session, token hashes are compared using `crypto.timingSafeEqual()`.
4. **Session Scoping**: A token is cryptographically bound to `sessionId`. It cannot authenticate into any other session.
5. **Dual-Tier Client Storage**:
   - **Primary**: `sessionStorage` with key `barea:session:<sessionId>` to ensure clean tab isolation when multiple family members/children play on the same iPad or laptop in separate tabs.
   - **Cookie Fallback**: Ephemeral `SameSite=Lax; Path=/join` cookie (`barea_ptok_<sessionId>`) to preserve resumption if mobile Safari reloads or user rescans the QR code.

### Resumption Sequence

```text
Participant Client                           BAREA Server Action (resumeSessionAction)
       │                                                      │
       ├──── POST { sessionId, participantId, token } ───────►│
       │                                                      │
       │                                                      ├─ Check session status (LOBBY/ACTIVE)
       │                                                      ├─ Compute HMAC-SHA256(token)
       │                                                      ├─ timingSafeEqual(computed, stored_hash)
       │                                                      ├─ Verify participantId matches row
       │                                                      ├─ Update last_active_at = now()
       │                                                      │
       │◄─── Response { success: true, participant, info } ───┤
       │                                                      │
```

---

## 7. Join URL & QR Code Contract

### Canonical URL Specification
- **Direct Route**: `https://<host>/join/[roomCode]`
- **Query Fallback**: `https://<host>/join?code=[roomCode]`
- **Host Poisoning Protection**: The join URL is constructed strictly from `process.env.NEXT_PUBLIC_APP_URL`. The HTTP `Host` or `X-Forwarded-Host` request header is **never** used to construct join links.
- **Pure Vector SVG QR Code**:
  - Rendered entirely in memory as pure vector SVG without external API calls (e.g. Google Charts QR API or third-party web services).
  - Error correction: Level M (15% redundancy) with a 4-module quiet zone for reliable mobile camera scanning from church pews (up to 30 feet away from sanctuary projector screens).
  - Security Invariant: The QR code contains **strictly** the canonical join URL (e.g. `https://barea.church/join/8K4M9Z`). It **must never** contain host tokens, participant IDs, session authorization secrets, or quiz question content.

---

## 8. Nickname Normalization & Deterministic Collision Suffixing

### Validation Rules
- **Allowed Characters**: Unicode letters, digits, spaces, hyphens, and underscores (`^[\p{L}\p{N}\s\-_]+$`).
- **Disallowed / Rejected**: Null bytes, control characters `[\x00-\x1F\x7F]`, invisible/zero-width formatting characters `[\u200B-\u200D\u202A-\u202E\uFEFF\p{Cf}]`, and HTML tags.
- **Length**: 2 to 24 characters after NFKC normalization and trim.

### Deterministic Suffixing Strategy
Church youth groups frequently have participants with identical first names ("David", "Sarah"). To prevent participant rejection at the start of a service:
1. When a participant joins with a nickname, the server checks if an existing participant in that session has the same normalized nickname.
2. If `"Sarah"` exists, the server checks `"Sarah (2)"`, `"Sarah (3)"`, up to `"Sarah (99)"`.
3. The assigned display name is returned in `ParticipantAuthPayload.nickname`.
4. **Mobile UX Requirement**: The mobile client UI presents an immediate notice banner:  
   *"Welcome, Sarah! Another participant is already using that name, so your display name is **Sarah (2)**."*

---

## 9. Persistence Schema & SQLite Architecture

Persistence is implemented in `src/persistence/sqlite-session-repository.ts` using Node.js `node:sqlite` (`DatabaseSync`).

### Pragmas & Concurrency Tuning
- `PRAGMA journal_mode = WAL;` (enables non-blocking reads while writing).
- `PRAGMA busy_timeout = 5000;` (prevents immediate `SQLITE_BUSY` errors when multiple participants join simultaneously).
- `PRAGMA foreign_keys = ON;`.

### DDL Specification

```sql
-- 1. Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  published_quiz_snapshot_id TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('LOBBY', 'ACTIVE', 'COMPLETED', 'CLOSED')),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
  state_version INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 100 CHECK(max_participants BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (published_quiz_snapshot_id) REFERENCES published_quiz_snapshots(id) ON DELETE RESTRICT
);

-- Active Room Codes must be unique while in LOBBY or ACTIVE status
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_room_code
ON quiz_sessions(room_code)
WHERE status IN ('LOBBY', 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_sessions_org_status
ON quiz_sessions(organization_id, status);

-- 2. Session Participants Table
CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  normalized_nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  is_connected INTEGER NOT NULL DEFAULT 1 CHECK(is_connected IN (0, 1)),
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE
);

-- Unique normalized nickname per session (guarantees Unicode-safe uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_session_norm_nickname
ON session_participants(session_id, normalized_nickname);

-- Unique token hash lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token_hash
ON session_participants(token_hash);

CREATE INDEX IF NOT EXISTS idx_participants_session_id
ON session_participants(session_id);
```

### Lazy Expiration & Zombie Code Recycling
In `lookupPublicSession` and `joinSession`, the repository enforces:
`WHERE room_code = ? AND status IN ('LOBBY', 'ACTIVE') AND expires_at > datetime('now')`
If a session has reached its expiration time (`now >= expires_at`) but is still marked `LOBBY`, the repository lazily marks it `CLOSED` and records `closed_at = expires_at`, freeing the room code for immediate recycling.

### Atomic Concurrency & Lock Duration
To eliminate `SQLITE_BUSY` bottlenecks when a congregation joins simultaneously:
1. Token generation (`crypto.randomBytes`), HMAC-SHA256 hashing, and input validation occur **in memory before** acquiring the SQLite write lock.
2. The transaction acquires `BEGIN IMMEDIATE`, performs the capacity check `COUNT(*) < max_participants`, checks nickname availability, inserts the row, and executes `COMMIT` in < 2ms.

### Typed Row Interfaces (Zero-`any` Standard)
```typescript
export interface SessionRow {
  readonly id: string;
  readonly organization_id: string;
  readonly published_quiz_snapshot_id: string;
  readonly host_user_id: string;
  readonly room_code: string;
  readonly status: string;
  readonly is_locked: number;
  readonly state_version: number;
  readonly max_participants: number;
  readonly created_at: string;
  readonly expires_at: string;
  readonly closed_at: string | null;
}

export interface ParticipantRow {
  readonly id: string;
  readonly session_id: string;
  readonly nickname: string;
  readonly normalized_nickname: string;
  readonly token_hash: string;
  readonly joined_at: string;
  readonly last_active_at: string;
  readonly is_connected: number;
}
```

---

## 10. Server Action Boundaries & Runtime Validation

All BAREA-006 entry points reside under Next.js Server Actions:

| Action | Caller | Auth Mechanism | Input Allowlist | Output (Safe Response) |
| :--- | :--- | :--- | :--- | :--- |
| `createSessionAction` | Teacher / Host | `getAuthorizedTeacherContext()` | `publishedQuizSnapshotId`, `maxParticipants?` | `ActionResponse<QuizSession>` |
| `closeSessionAction` | Teacher / Host | `getAuthorizedTeacherContext()` | `sessionId` | `ActionResponse<{ success: boolean }>` |
| `lockSessionAction` | Teacher / Host | `getAuthorizedTeacherContext()` | `sessionId`, `locked: boolean` | `ActionResponse<{ success: boolean; isLocked: boolean }>` |
| `kickParticipantAction`| Teacher / Host | `getAuthorizedTeacherContext()` | `sessionId`, `participantId` | `ActionResponse<{ success: boolean }>` |
| `getHostSessionRosterAction` | Teacher / Host | `getAuthorizedTeacherContext()` | `sessionId` | `ActionResponse<HostRosterEntry[]>` |
| `lookupRoomAction` | Public / Participant | Rate-Limited IP | `roomCode` (6 chars) | `ActionResponse<SessionPublicInfo>` |
| `joinSessionAction` | Public / Participant | Rate-Limited IP | `roomCode`, `nickname` *(sessionId resolved server-side)* | `ActionResponse<ParticipantAuthPayload>` |
| `resumeSessionAction` | Public / Participant | Cryptographic Token | `sessionId`, `participantId`, `token` | `ActionResponse<{ participant: SessionParticipant; sessionInfo: SessionPublicInfo }>` |

---

## 11. Domain Error Hierarchy & Taxonomy

The domain implements a clean, strongly-typed error hierarchy in `src/domain/domain-errors.ts`:

```typescript
export abstract class BareaDomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SessionNotFoundError extends BareaDomainError {
  readonly code = 'SESSION_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(identifier: string) {
    super(`Session not found or is no longer accepting participants: '${identifier}'`);
  }
}

export class SessionClosedError extends BareaDomainError {
  readonly code = 'SESSION_CLOSED';
  readonly httpStatus = 409;
  constructor(status: string) {
    super(`Session is closed to participants (status: '${status}').`);
  }
}

export class SessionLockedError extends BareaDomainError {
  readonly code = 'SESSION_LOCKED';
  readonly httpStatus = 423;
  constructor() {
    super('This session is currently locked by the host.');
  }
}

export class SessionFullError extends BareaDomainError {
  readonly code = 'SESSION_FULL';
  readonly httpStatus = 429;
  constructor(limit: number) {
    super(`Session has reached its maximum capacity of ${limit} participants.`);
  }
}

export class InvalidNicknameError extends BareaDomainError {
  readonly code = 'INVALID_NICKNAME';
  readonly httpStatus = 422;
}

export class InvalidRoomCodeError extends BareaDomainError {
  readonly code = 'INVALID_ROOM_CODE';
  readonly httpStatus = 400;
}

export class InvalidParticipantTokenError extends BareaDomainError {
  readonly code = 'INVALID_PARTICIPANT_TOKEN';
  readonly httpStatus = 401;
}

export class RoomCodeCollisionExhaustedError extends BareaDomainError {
  readonly code = 'ROOM_CODE_COLLISION_EXHAUSTED';
  readonly httpStatus = 500;
  constructor() {
    super('Failed to generate a unique room code after maximum retry attempts.');
  }
}

export class RateLimitExceededError extends BareaDomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly httpStatus = 429;
  constructor() {
    super('Too many requests. Please wait a moment before trying again.');
  }
}
```

---

## 12. Security Boundary with BAREA-007

To safeguard upcoming live quiz mechanics, BAREA-006 strictly guarantees:
1. **Zero Answer Key Leakage**: Neither `lookupRoomAction`, `joinSessionAction`, nor `resumeSessionAction` return question choices, stems, explanations, or correct answer indices.
2. **No Authoritative Time Synchronization**: No server clock ticks or countdown states are served in BAREA-006.
3. **No Scoring or Answer Endpoints**: No endpoint exists to submit answers or query participant scores.
4. **No Live Websocket Connections**: All BAREA-006 operations are handled via HTTP Server Actions.

---

## 13. Comprehensive Adversarial Test Matrix (ADV-SJ-01 through ADV-SJ-34)

| Test ID | Category | Adversarial Scenario / Vector | Expected Behavior / Security Assertion |
| :--- | :--- | :--- | :--- |
| `ADV-SJ-01` | Multi-Tenant | Host Org A attempts to create a session referencing Org B's snapshot | Fails closed (`403 Forbidden` / `Quiz snapshot not found`). |
| `ADV-SJ-02` | Multi-Tenant | Host Org A attempts to close/manage a session created by Org B | Rejected; session remains untouched. |
| `ADV-SJ-03` | Authorization | Client injects forged `organizationId` or `hostUserId` in `createSessionAction` | Ignored; strictly derived from `getAuthorizedTeacherContext()`. |
| `ADV-SJ-04` | Validation | Host attempts to create session for unapproved or draft quiz ID | Fails closed with `QuizValidationError`. |
| `ADV-SJ-05` | Room Code | Participant enters invalid room code format (symbols, wrong length) | Rejected with schema validation error. |
| `ADV-SJ-06` | Room Code | Participant enters nonexistent room code | Returns generic `"Session not found or closed"`. |
| `ADV-SJ-07` | Room Code | Participant attempts to join closed or expired session | Rejected; zero participant rows inserted. |
| `ADV-SJ-08` | Room Code | Case-insensitive room code lookup (`8k4m9z` vs `8K4M9Z`) | Normalizes cleanly and resolves the same session. |
| `ADV-SJ-09` | Concurrency | Room code collision during session creation | Generator retries and succeeds with unique active code. |
| `ADV-SJ-10` | Concurrency | Concurrent joins at maximum participant limit (`maxParticipants`) | `BEGIN IMMEDIATE` atomically enforces limit; excess join rejected. |
| `ADV-SJ-11` | Nickname | Empty string or whitespace-only nickname | Rejected with `"Nickname must be at least 2 characters"`. |
| `ADV-SJ-12` | Nickname | Oversized nickname (> 24 characters) | Rejected with length error. |
| `ADV-SJ-13` | Nickname | Control characters (`\x00`, `\r`, `\n`, `\t`) in nickname | Stripped/rejected. |
| `ADV-SJ-14` | Nickname | HTML / XSS payload in nickname (`<script>alert(1)</script>`) | Sanitized/escaped; zero script injection. |
| `ADV-SJ-15` | Nickname | Duplicate nickname submitted sequentially | Suffix appended (`"David (2)"`); join succeeds. |
| `ADV-SJ-16` | Concurrency | Two participants submit exact same nickname concurrently | `idx_participants_session_norm_nickname` + retry safely suffixes both without error. |
| `ADV-SJ-17` | Token Security | Participant attempts to forge token without knowing secret | Verification fails (`401 Unauthorized`). |
| `ADV-SJ-18` | Token Security | Participant attempts to replay token from Session A in Session B | Scoping check rejects token (`401 Unauthorized`). |
| `ADV-SJ-19` | Token Security | Raw token is never persisted in plaintext in SQLite | Verified via direct SQL query asserting only HMAC-SHA256 hash exists. |
| `ADV-SJ-20` | Resumption | Legitimate participant resumes session with valid token | Successfully returns participant profile and updates `last_active_at`. |
| `ADV-SJ-21` | Resumption | Attacker tries to resume Participant A's identity with wrong token | Rejected; identity cannot be hijacked. |
| `ADV-SJ-22` | QR Code | QR code decoded string inspection | Contains only join URL; zero tokens or secrets present. |
| `ADV-SJ-23` | Secrecy | Public lookup action response payload inspection | Contains zero questions, answer choices, or correct indices. |
| `ADV-SJ-24` | Rate Limit | Rapid brute-force room code scanning attempts | Trigger rate limiting; fails closed after threshold. |
| `ADV-SJ-25` | Lifecycle | Attempting to join a session in `COMPLETED` or `CLOSED` state | Rejected with `"Session has ended"`. |
| `ADV-SJ-26` | SQL Injection | Malicious SQL payload in nickname or room code parameter | Parameterized queries reject/escape payload; zero database corruption. |
| `ADV-SJ-27` | Concurrency | Suffix collision race: 5 workers simultaneously join as `"Sarah"` when `"Sarah (2)"` already exists | Suffix allocator safely assigns `(3)`, `(4)`, `(5)`, `(6)`, `(7)` without unique constraint failure. |
| `ADV-SJ-28` | Nickname | NFKC homoglyphs and invisible formatting (`\u200B`, `\uFEFF`, Cyrillic confusable letters) | Normalized to canonical form; invisible zero-width spaces rejected. |
| `ADV-SJ-29` | Lifecycle | Exact timestamp expiry boundary race (`now() == expires_at`) | Evaluated as expired; join rejected and session marked `CLOSED`. |
| `ADV-SJ-30` | Rate Limit | Dual-bucket rate limiter triggers on rapid failed room code probes across IP thresholds | Throttles and returns 429 before database query is dispatched. |
| `ADV-SJ-31` | Persistence | Concurrent `createSessionAction` executions handle `SQLITE_BUSY` gracefully | Handled via `PRAGMA busy_timeout = 5000` and retries without error. |
| `ADV-SJ-32` | Capacity | Exact capacity race: 25 workers attempt to fill 5 remaining participant slots | Exactly 5 succeed; exactly 20 receive `SessionFullError`. |
| `ADV-SJ-33` | Authorization | Host admin cookie vs participant token role separation | Host cannot act as participant without token; participant cannot access host actions. |
| `ADV-SJ-34` | Room Code | Ambiguous characters excluded (`0`, `1`, `I`, `O`) | Generator never produces excluded characters; validator rejects them with clear error. |

---

## 14. Multi-Agent Verification Audit (Post-Remediation Verification)

| Role | Sub-Agent ID | Audit Scope | Post-Remediation Findings | Final Role Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Security Architect & Red Team** | `974d2bd6` | Token hashing, rate limiting, host header poisoning, homoglyphs | All 8 initial challenge points addressed (HMAC-SHA256, dual-bucket rate limit, APP_URL base, regex tightening, lobby lock/kick). | **PASS / GO** |
| **SQLite Persistence Architect** | `7b832450` | WAL mode, busy timeout, state version, normalized nickname, zombie sessions | Schema incorporates `state_version`, `normalized_nickname`, WAL, busy timeout, and lazy expiration. | **PASS / GO** |
| **QA & Test Architect** | `03dd012f` | Adversarial test matrix expansion, deterministic seams, concurrency harnesses | Matrix expanded from 26 to 34 tests (`ADV-SJ-27..34`), `ClockProvider` and `RoomCodeGenerator` seams specified. | **PASS / GO** |
| **TypeScript & Code Quality** | `4dbfb264` | Branded types, discriminated unions, error taxonomy, zero-any mappers | Value objects (`RoomCode`, `Nickname`, `ParticipantToken`), custom error hierarchy, typed row mappers included. | **PASS / GO** |
| **Frontend & Next.js Specialist** | `567b4c44` | Server components, mobile ergonomics, sessionStorage, vector SVG QR | Canonical routes, `sessionStorage` + cookie fallback, pure SVG QR generator, duplicate name notice banner specified. | **PASS / GO** |
| **Independent Product & Architecture Reviewer** | `4fe8e64f` | ADR alignment, church demographic stress-test, lobby management, milestone boundaries | Sanctuary QR visibility, host roster action (`getHostSessionRosterAction`), church elder/youth UX addressed; zero BAREA-007 creep. | **PASS / GO** |

---

## 15. Gate Conclusion & Operational Status

The BAREA-006 Share/Join System Design and Verification Gate has successfully undergone comprehensive challenge, remediation, and multi-agent verification across all 6 specialized architectural domains.

**FINAL GATE STATUS: DESIGN GATE COMPLETE — AWAITING INDEPENDENT USER GO / NO-GO**  
**IMPLEMENTATION STATUS: ZERO APPLICATION CODE WRITTEN — STOPPED PER INSTRUCTIONS**
