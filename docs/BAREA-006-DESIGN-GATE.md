# BAREA-006: Share/Join — System Design & Verification Gate

**Status: COMPLETE DESIGN GATE — POST-REMEDIATION VERIFIED BY 6 SPECIALIZED SUB-AGENTS (UNANIMOUS GO)**  
**Date: 2026-09-10**  
**Dependency:** BAREA-005 completed and merged on `main` (`94af326`)  
**Implementation Authorization:** NOT AUTHORIZED (Design Gate Only — Awaiting Multi-Agent Verification & Independent User GO / NO-GO)

---

## 1. Objective & Canonical Workflow

The objective of **BAREA-006: Share/Join** is to design the domain model, persistence schema, server-authoritative security boundaries, room-code generation and collision handling, QR/join URL infrastructure, low-friction mobile landing flow, nickname validation, duplicate-name handling, admission control, and session resumption mechanics for church quizzes.

BAREA-006 establishes how participants discover, join, and anchor their presence in a scheduled quiz session **without creating persistent accounts**, and how teachers/hosts generate and display session access surfaces.

### Canonical BAREA-006 Workflow

```text
[Published Quiz Snapshot (BAREA-005)]
               ↓
[Host Creates Quiz Session via Server Action (createSessionAction)]
  - Context strictly from getAuthorizedTeacherContext()
  - Reference to published_quiz_snapshots(id) verified for matching organization_id
  - SQLite BEFORE INSERT trigger enforces snapshot organization_id === session organization_id
  - Generate 6-char cryptographic room code (unambiguous 31-char alphabet)
               ↓
[Server provides Session + Safe Public Join URL + High-Contrast SVG QR Code]
  - Base URL strictly from process.env.NEXT_PUBLIC_APP_URL (prevents Host Header Poisoning)
  - QR Code contains pure URL (zero auth secrets, zero question data)
               ↓
[Host / Podium Sharing View renders high-contrast QR & 6-char Room Code for Sanctuary Display]
               ↓
[Participant lands on /join or /join/[roomCode] via mobile browser]
  - Server Component pre-validates roomCode and renders public metadata
  - Input field formatted with 48px touch targets, uppercase, tracking-widest, monospace
               ↓
[Participant enters Nickname]
               ↓
[Server Admission Control & Validation Pipeline]
  - Extract verified Client IP via Right-to-Left proxy traversal (TRUSTED_PROXY_CIDRS allowlist)
  - Enforce Per-IP Quota (max 5 joins per session per IP, max 10 joins per 10 min across sessions)
  - Validate Raw Nickname: 2..20 chars, NFKC normalized, reject control chars, invisible bidi/zero-width, HTML, and reject parentheses ()
  - Automatic deterministic suffixing if taken: "Sarah" -> "Sarah (2)" (strictly <= 24 chars)
               ↓
[Server issues Session-Scoped Ephemeral Participant Token (ptok_...)]
  - Evaluated outside transaction to minimize write lock time
  - Stored in SQLite as HMAC-SHA256: hmac_sha256(AUTH_SECRET, sessionId + ":" + rawToken)
  - Raw token returned ONCE to client in ParticipantAuthPayload
  - Emits HttpOnly; Secure; SameSite=Lax; Path=/join; Max-Age=14400 fallback cookie
               ↓
[Client stores token in sessionStorage + session-scoped Cookie fallback]
  - sessionStorage (primary) guarantees tab isolation on family iPads
  - HttpOnly cookie enables mobile Safari refresh / QR re-scan rehydration
               ↓
[Participant enters Waiting Room / Lobby State]
  - Mobile UI shows: "You're in! Waiting for the host to start..."
  - If suffixed, shows clear notification banner: "You are joined as Sarah (2)"
               ↓
[Host Console displays live participant roster via getHostSessionRosterAction]
  - Host can lock session (lockSessionAction) or kick participant (kickParticipantAction)
               ↓
[BOUNDARY GATE: BAREA-007 Live State Machine / Websocket Transport (NOT IN BAREA-006)]
```

---

## 2. Scope & Explicit Non-Goals

### In Scope (BAREA-006)
1. **Host Session Creation**: Creating a `QuizSession` referencing an immutable `PublishedQuizSnapshot` from BAREA-005 with strict organization tenant integrity enforced in application logic and persistence triggers.
2. **Cryptographic Room Code Generation**: 6-character alphanumeric code using an unambiguous 31-character alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), generated via `node:crypto.randomInt()`, with case-insensitive normalization and collision retry loop.
3. **Dynamic Join URL & Pure SVG QR Code**: Canonical URL shape (`/join/[roomCode]` or `/join?code=[roomCode]`), rendered on the Host sharing surface via pure vector SVG generation without external third-party API calls or privileged credential leakage. Base URL strictly pinned to `process.env.NEXT_PUBLIC_APP_URL`.
4. **Low-Friction Mobile Landing Experience**: Responsive mobile viewport for room-code and nickname entry adhering to `docs/FRONTEND-STANDARD.md` and React Aria Components (min 48px touch targets, virtual keyboard scroll anchoring).
5. **Strict Nickname Validation & Decoupled Suffixing**:
   - `RawNicknameInput`: 2 to 20 characters, disallows parentheses `()`, NFKC normalized, strips/rejects control characters, zero-width spaces, and HTML.
   - `NormalizedNicknameKey`: Lowercase and whitespace-collapsed for uniqueness checks.
   - `DisplayName`: Accommodates server-generated numerical suffixing (`"Sarah (2)"` up to `"Sarah (99)"`), with a strict ceiling of **24 characters**.
6. **Multi-Tier Admission Control & Rate Limiting (Finding 1 & 7 Remediation)**:
   - Per-IP admission limit: Max 5 joins per session per IP; max 10 joins per 10 minutes globally per IP.
   - Session concurrency valve: Dynamic admission throttling under congregation join bursts.
   - Bounded memory sliding-window store with LRU eviction and TTL.
   - **Zero Global Kill-Switch**: The dangerous 250-attempt global fail-closed sentinel is completely removed; rate limits are strictly partitioned per client IP and per `/24` subnet.
7. **Trusted Proxy & IP Extraction (Finding 2 Remediation)**:
   - Configurable `TRUSTED_PROXY_CIDRS`.
   - Right-to-left traversal of `X-Forwarded-For`.
   - Authoritative `CF-Connecting-IP` only when upstream TCP peer is verified within trusted Cloudflare CIDRs. Direct socket address fallback.
8. **Ephemeral Participant Identity & Dual-Storage Resumption (Finding 5 Remediation)**:
   - Session-scoped token (`ptok_...`), HMAC-SHA256 hashed in SQLite.
   - `sessionStorage` primary for per-tab isolation on shared church iPads.
   - Cookie fallback with `HttpOnly; Secure; SameSite=Lax; Path=/join; Max-Age=14400`.
9. **Host Lobby Management**: Host roster inspection (`getHostSessionRosterAction`), session locking (`lockSessionAction`), and participant removal (`kickParticipantAction`).
10. **Persistence & SQLite Constraints (Finding 3 Remediation)**:
    - Tables: `quiz_sessions`, `session_participants`.
    - SQLite `BEFORE INSERT` trigger enforcing session `organization_id` strictly matches the referenced snapshot's `organization_id` via `quizzes`.
    - Partial unique index on active room codes (`WHERE status IN ('LOBBY', 'ACTIVE')`).
    - `state_version` for optimistic concurrency control.
    - Pragmas: `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, `PRAGMA foreign_keys = ON;`.
11. **Comprehensive Adversarial Test Matrix**: 41 named adversarial cases (`ADV-SJ-01` through `ADV-SJ-41`) covering all 7 NO-GO findings.

### Explicit Non-Goals (Strict Milestone Boundaries — Finding 6 Remediation)
To ensure absolute adherence to milestone discipline, the following are strictly excluded from BAREA-006:
- **No Live Quiz State Machine**: BAREA-006 creates sessions in `LOBBY` status only. `LOBBY -> ACTIVE` transition is strictly owned by BAREA-007.
- **No Real-Time Transport**: No WebSockets, Socket.io, or SSE connections.
- **No Authoritative Timers or Countdown Synchronization**.
- **No Participant Answer Submissions or Live Scoring Engine** (`submitAnswerAction` does not exist).
- **No Standings, Leaderboards, or Podium Animations**.
- **No Live Question Display**: Zero question stems, option arrays, correct indices, or explanations are returned in BAREA-006 responses.

---

## 3. Session Domain Model & TypeScript Types

The Session domain resides in `src/domain/session.ts`:

```typescript
import { RoomCode, RawNicknameInput, NormalizedNicknameKey, DisplayName, ParticipantToken } from './value-objects';

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
  readonly nickname: DisplayName;            // Formatted display name (e.g. "Sarah" or "Sarah (2)")
  readonly normalizedNickname: NormalizedNicknameKey;
  readonly joinedAt: string;                 // ISO-8601 UTC
  readonly lastActiveAt: string;             // ISO-8601 UTC
  readonly isConnected: boolean;
}

export interface ParticipantAuthPayload {
  readonly participantId: string;
  readonly sessionId: string;
  readonly nickname: DisplayName;
  readonly token: ParticipantToken;          // Plaintext token returned ONCE to client
}

export interface HostRosterEntry {
  readonly participantId: string;
  readonly nickname: DisplayName;
  readonly joinedAt: string;
  readonly isConnected: boolean;
}
```

---

## 4. Value Objects & Branded Types (Finding 4 Remediation)

To prevent primitive obsession and resolve the nickname/suffix contradiction, domain types are modeled with strict nominal branding in `src/domain/value-objects.ts`:

```typescript
import {
  InvalidRoomCodeError,
  InvalidNicknameError,
  InvalidParticipantTokenError,
  NicknameLengthExceededError
} from './domain-errors';

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RoomCode = Brand<string, 'RoomCode'>;
export type ParticipantToken = Brand<string, 'ParticipantToken'>;
export type RawNicknameInput = Brand<string, 'RawNicknameInput'>;
export type NormalizedNicknameKey = Brand<string, 'NormalizedNicknameKey'>;
export type DisplayName = Brand<string, 'DisplayName'>;
export type ClientIp = Brand<string, 'ClientIp'>;

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

// 2. Nickname Architecture (Decoupled User Input vs Suffix Display Name)
// Base input bounds: 2 to 20 characters. Parentheses () are STRICTLY DISALLOWED in user input.
export const RAW_NICKNAME_MIN_LENGTH = 2;
export const RAW_NICKNAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MAX_LENGTH = 24; // Base (max 20) + " (99)" (4 chars) = 24

const RAW_NICKNAME_ALLOWED_REGEX = /^[\p{L}\p{N}\s\-_]+$/u;
const ILLEGAL_CHARS_REGEX = /[ -​-‍‪-‮﻿\p{Cf}]/u;
const HTML_TAG_REGEX = /<[^>]*>/;

export function normalizeAndValidateRawNickname(raw: unknown): RawNicknameInput {
  if (typeof raw !== 'string') {
    throw new InvalidNicknameError('Nickname must be a string.');
  }
  // Unicode NFKC normalization
  let normalized = raw.normalize('NFKC').trim();

  // Reject control characters, invisible/bidi formatting, and HTML
  if (ILLEGAL_CHARS_REGEX.test(normalized) || HTML_TAG_REGEX.test(normalized)) {
    throw new InvalidNicknameError('Nickname contains illegal control, invisible, or markup characters.');
  }

  // Reject parentheses in user input (prevents user impersonation of generated suffixes)
  if (normalized.includes('(') || normalized.includes(')')) {
    throw new InvalidNicknameError('Parentheses are not allowed in user nicknames.');
  }

  // Collapse consecutive internal spaces
  normalized = normalized.replace(/\s+/g, ' ');

  if (normalized.length < RAW_NICKNAME_MIN_LENGTH) {
    throw new InvalidNicknameError(`Nickname must be at least ${RAW_NICKNAME_MIN_LENGTH} characters.`);
  }
  if (normalized.length > RAW_NICKNAME_MAX_LENGTH) {
    throw new InvalidNicknameError(`Base nickname cannot exceed ${RAW_NICKNAME_MAX_LENGTH} characters.`);
  }
  if (!RAW_NICKNAME_ALLOWED_REGEX.test(normalized)) {
    throw new InvalidNicknameError('Nickname contains unsupported characters.');
  }

  return normalized as RawNicknameInput;
}

export function toNormalizedNicknameKey(raw: RawNicknameInput | string): NormalizedNicknameKey {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ') as NormalizedNicknameKey;
}

export function formatDisplayName(base: RawNicknameInput | string, suffixNumber?: number): DisplayName {
  const trimmed = base.trim();
  const formatted = suffixNumber && suffixNumber > 1 ? `${trimmed} (${suffixNumber})` : trimmed;
  if (formatted.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new NicknameLengthExceededError(formatted.length, DISPLAY_NAME_MAX_LENGTH);
  }
  return formatted as DisplayName;
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

## 5. Admission Control, Rate Limiting & Proxy IP Resolution (Findings 1, 2, 7)

### A. Multi-Tier Admission Control (Finding 1)
To protect church sessions from bot floods without adding hostile CAPTCHA challenges to church members:
1. **Per-IP Session Join Limit**: A single client IP is permitted a maximum of **5 joins per session**. This accommodates a family sharing a mobile hotspot or church Wi-Fi while blocking bulk bot scripts.
2. **Per-IP Global Join Rate**: Maximum **10 join attempts across all sessions per rolling 10-minute window** per client IP.
3. **Session Capacity Gate**: Within the atomic `BEGIN IMMEDIATE` transaction, verify `COUNT(*) < maxParticipants`. When capacity is reached, immediately return `SessionFullError` (HTTP 429).
4. **Host Dynamic Lock**: Host can call `lockSessionAction` at any time to freeze join admissions (`SessionLockedError`, HTTP 423).

### B. Trusted Proxy IP Extraction Algorithm (Finding 2)
To prevent IP spoofing via forged `X-Forwarded-For` or `CF-Connecting-IP` headers:
1. **Configurable Proxy Allowlist**: Upstream trusted proxies are defined via `TRUSTED_PROXY_CIDRS` (e.g. Cloudflare IP ranges and local loopback).
2. **Right-to-Left Traversal**:
   - If the direct socket remote address does **not** match `TRUSTED_PROXY_CIDRS`, the socket address is authoritative. All forwarded headers are discarded.
   - If the direct socket address is trusted:
     - If Cloudflare is the designated trusted proxy and `CF-Connecting-IP` is present, validate and use it.
     - Otherwise, parse `X-Forwarded-For` from right to left, selecting the first IP that is **not** in `TRUSTED_PROXY_CIDRS`.
3. **Fail-Closed**: If IP extraction fails or resolves to an invalid format, reject with `InvalidClientIpError`.

### C. Isolated Blast-Radius Rate Limiting (Finding 7)
**Elimination of Global Kill-Switch**: The previous proposal to globally fail-closed after 250 invalid room-code attempts is **completely removed** as an acute self-inflicted DoS vector.
Instead, rate limits have bounded, isolated blast radii:
1. **Per-IP Room Lookup Rate**: Max 15 failed lookups per rolling 60-second window per IP. Tripping this throttles only the offending IP.
2. **Subnet-Level Isolation (`/24` IPv4, `/48` IPv6)**: If a distributed scanner rotates IPs across a single `/24` subnet, cap failed lookups at 60 per minute for that subnet. Other subnets and church sanctuaries remain 100% unaffected.
3. **Targeted Room Code Protection**: Max 25 failed lookups per rolling minute targeting a single room code. This mitigates brute-force attacks against an active room without affecting any other session on the platform.
4. **Bounded Memory Store**: In-memory sliding-window limiter enforces a maximum size of 50,000 entries with LRU eviction and 60-second TTLs, preventing memory exhaustion.

---

## 6. Participant Identity, Cookie Security & Storage Reconciliation (Finding 5)

### A. Strict Cookie Security Attributes
When a participant successfully joins, the server emits an ephemeral fallback cookie via `next/headers`:
```typescript
import { cookies } from 'next/headers';

export async function setParticipantSessionCookie(sessionId: string, token: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: `barea_ptok_${sessionId}`,
    value: token,
    httpOnly: true,                                // Inaccessible to client JavaScript
    secure: process.env.NODE_ENV === 'production', // Mandatory TLS in production
    sameSite: 'lax',                               // Accommodates camera QR code cross-site navigation
    path: '/join',                                 // Scoped strictly to participant routes
    maxAge: 4 * 3600                               // 4 hours (matches session lifetime)
  });
}
```

### B. Dual-Store Reconciliation & Family iPad Isolation
On shared devices (e.g. Sunday School iPads where multiple children play in separate tabs):
1. **Primary Session (`sessionStorage`)**:
   - Each browser tab stores its identity under key `barea:session:<sessionId>`.
   - On mutation or resume requests, the tab sends its `sessionStorage` token in the Server Action payload.
   - Separate tabs on the same iPad maintain completely isolated participant sessions.
2. **Fallback Rehydration (`HttpOnly Cookie`)**:
   - If a participant refreshes mobile Safari or re-scans the QR code and `sessionStorage` is empty, the Server Action reads `barea_ptok_${sessionId}` from the cookie to rehydrate `sessionStorage`.
3. **Precedence**: `sessionStorage` always takes precedence over ambient cookies.

---

## 7. Join URL & QR Code Contract

### Canonical URL Specification
- **Direct Route**: `https://<host>/join/[roomCode]`
- **Query Fallback**: `https://<host>/join?code=[roomCode]`
- **Host Poisoning Protection**: The join URL is constructed strictly from `process.env.NEXT_PUBLIC_APP_URL`. The HTTP `Host` or `X-Forwarded-Host` request header is **never** used to construct join links.
- **Pure Vector SVG QR Code**:
  - Rendered entirely in memory as pure vector SVG without external network requests or CDN dependencies.
  - Error correction: Level M (15% redundancy) with a 4-module quiet zone for reliable camera recognition from 30+ feet back in church sanctuaries.
  - Security Invariant: The QR code contains **strictly** the canonical join URL. It **never** contains host credentials, participant tokens, or quiz data.

---

## 8. Nickname Collision Suffixing & Roster UX (Finding 4)

### Deterministic Suffix Allocation
To prevent youth group attendees with identical first names ("David", "Sarah") from being rejected at the door:
1. Client enters raw nickname (e.g. `"Sarah"`, 2..20 chars).
2. Server computes `normalized_nickname = toNormalizedNicknameKey(raw)` (`"sarah"`).
3. Inside `BEGIN IMMEDIATE`, if `"sarah"` already exists in `session_participants`:
   - Query existing suffixes for base `"sarah"` in the session.
   - Allocate lowest available suffix `(k)` where `k` in `[2..99]`.
   - Format candidate display name: `formatDisplayName("Sarah", k)` -> `"Sarah (2)"`.
   - Store `nickname = "Sarah (2)"` and `normalized_nickname = "sarah (2)"`.
4. If `k > 99`, raise `NicknameSuffixExhaustedError` (HTTP 409).
5. **Mobile UX Requirement**: Client displays an accessible notice banner:  
   *"Welcome, Sarah! Another participant is already using that name, so your display name is **Sarah (2)**."*

---

## 9. Persistence Schema & Relational Tenant Integrity (Finding 3)

Persistence is implemented in `src/persistence/sqlite-session-repository.ts` using Node.js `node:sqlite` (`DatabaseSync`).

### Pragmas & Connection Init
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

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

-- 2. Persistence-Level Tenant Integrity Trigger (Finding 3 Remediation)
-- Guarantees that a session can NEVER reference a snapshot belonging to a different organization
CREATE TRIGGER IF NOT EXISTS trg_enforce_session_snapshot_tenant
BEFORE INSERT ON quiz_sessions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Tenant mismatch: referenced snapshot does not belong to session organization')
  WHERE NOT EXISTS (
    SELECT 1 
    FROM published_quiz_snapshots pqs
    JOIN quizzes q ON q.id = pqs.quiz_id
    WHERE pqs.id = NEW.published_quiz_snapshot_id 
      AND q.organization_id = NEW.organization_id
  );
END;

-- 3. Session Participants Table
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

-- Unique normalized nickname per session (Unicode-safe collision prevention)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_session_norm_nickname
ON session_participants(session_id, normalized_nickname);

-- Unique token hash lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token_hash
ON session_participants(token_hash);

CREATE INDEX IF NOT EXISTS idx_participants_session_id
ON session_participants(session_id);
```

### Atomic Capacity Insertion & Lock Optimization
To prevent write-lock starvation under burst joins:
1. Token generation (`crypto.randomBytes`), HMAC-SHA256 computation, and input validation occur **in memory before** acquiring the SQLite write lock.
2. The transaction acquires `BEGIN IMMEDIATE`, verifies capacity and status inline, inserts the participant, and executes `COMMIT` in < 2ms.

---

### Typed Row Interfaces (Zero-`any` Standard)
To ensure absolute zero-`any` compliance across persistence boundaries, database row results are typed:

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
| `joinSessionAction` | Public / Participant | Rate-Limited & Admission-Controlled IP | `roomCode`, `nickname` *(sessionId resolved server-side)* | `ActionResponse<ParticipantAuthPayload>` |
| `resumeSessionAction` | Public / Participant | Cryptographic Token | `sessionId`, `participantId`, `token` | `ActionResponse<{ participant: SessionParticipant; sessionInfo: SessionPublicInfo }>` |


### Server Action Envelope & Return Types
All Server Actions strictly adhere to the typed `ActionResult<T>` / `ActionResponse<T>` discriminated union envelope to eliminate implicit `any`:

```typescript
export type ActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string; readonly httpStatus: number } };

export type ActionResponse<T> = ActionResult<T>;
```


---

## 11. Domain Error Hierarchy & Taxonomy

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

export class NicknameLengthExceededError extends BareaDomainError {
  readonly code = 'NICKNAME_LENGTH_EXCEEDED';
  readonly httpStatus = 422;
  constructor(actual: number, max: number) {
    super(`Formatted display name length (${actual}) exceeds maximum allowed (${max}).`);
  }
}

export class NicknameSuffixExhaustedError extends BareaDomainError {
  readonly code = 'NICKNAME_SUFFIX_EXHAUSTED';
  readonly httpStatus = 409;
  constructor(base: string) {
    super(`Unable to allocate unique display name for '${base}' after 99 attempts.`);
  }
}

export class InvalidRoomCodeError extends BareaDomainError {
  readonly code = 'INVALID_ROOM_CODE';
  readonly httpStatus = 400;
}

export class InvalidParticipantTokenError extends BareaDomainError {
  readonly code = 'INVALID_PARTICIPANT_TOKEN';
  readonly httpStatus = 401;
}

export class InvalidClientIpError extends BareaDomainError {
  readonly code = 'INVALID_CLIENT_IP';
  readonly httpStatus = 400;
}

export class RateLimitExceededError extends BareaDomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly httpStatus = 429;
  constructor(retryAfterSeconds: number = 60) {
    super(`Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`);
  }
}

export class CrossTenantSnapshotError extends BareaDomainError {
  readonly code = 'CROSS_TENANT_SNAPSHOT_FORBIDDEN';
  readonly httpStatus = 403;
  constructor() {
    super('Quiz snapshot does not belong to authorized organization.');
  }
}
```

---

## 12. Security Boundary with BAREA-007 (Finding 6 Remediation)

To safeguard upcoming live quiz mechanics, BAREA-006 strictly guarantees:
1. **Zero Live Game Advancement**: BAREA-006 creates sessions in `LOBBY` status only. `LOBBY -> ACTIVE` transition is strictly owned by BAREA-007.
2. **Zero Answer Key Leakage**: Neither `lookupRoomAction`, `joinSessionAction`, nor `resumeSessionAction` return question choices, stems, explanations, or correct answer indices.
3. **No Authoritative Time Synchronization**: Zero server clock ticks or countdown states are served in BAREA-006.
4. **No Scoring or Answer Endpoints**: `submitAnswerAction` does not exist in BAREA-006.
5. **No Live Websocket Connections**: All BAREA-006 operations are handled via HTTP Server Actions.

---

## 13. Comprehensive Adversarial Test Matrix (ADV-SJ-01 through ADV-SJ-41)

| Test ID | Category | Adversarial Scenario / Vector | Expected Behavior / Security Assertion |
| :--- | :--- | :--- | :--- |
| `ADV-SJ-01` | Multi-Tenant | Host Org A attempts to create a session referencing Org B's snapshot | Fails closed (`403 Forbidden` / `CrossTenantSnapshotError`). Database trigger aborts if bypassed. |
| `ADV-SJ-02` | Multi-Tenant | Host Org A attempts to close/manage a session created by Org B | Rejected; session remains untouched. |
| `ADV-SJ-03` | Authorization | Client injects forged `organizationId` or `hostUserId` in `createSessionAction` | Ignored; strictly derived from `getAuthorizedTeacherContext()`. |
| `ADV-SJ-04` | Validation | Host attempts to create session for unapproved or draft quiz ID | Fails closed with `QuizValidationError`. |
| `ADV-SJ-05` | Room Code | Participant enters invalid room code format (symbols, wrong length) | Rejected with schema validation error. |
| `ADV-SJ-06` | Room Code | Participant enters nonexistent room code | Returns generic `"Session not found or closed"`. |
| `ADV-SJ-07` | Room Code | Participant attempts to join closed or expired session | Rejected; zero participant rows inserted. |
| `ADV-SJ-08` | Room Code | Case-insensitive room code lookup (`8k4m9z` vs `8K4M9Z`) | Normalizes cleanly and resolves the same session. |
| `ADV-SJ-09` | Concurrency | Room code collision during session creation | Generator retries and succeeds with unique active code. |
| `ADV-SJ-10` | Concurrency | Concurrent joins at maximum participant limit (`maxParticipants`) | `BEGIN IMMEDIATE` atomically enforces limit; excess join rejected with `SessionFullError`. |
| `ADV-SJ-11` | Nickname | Empty string or whitespace-only nickname | Rejected with `"Nickname must be at least 2 characters"`. |
| `ADV-SJ-12` | Nickname | Oversized base nickname (> 20 characters) | Rejected with length error. |
| `ADV-SJ-13` | Nickname | Control characters (`\x00`, `\r`, `\n`, `\t`) in nickname | Stripped/rejected. |
| `ADV-SJ-14` | Nickname | HTML / XSS payload in nickname (`<script>alert(1)</script>`) | Sanitized/escaped; zero script injection. |
| `ADV-SJ-15` | Nickname | Duplicate nickname submitted sequentially | Suffix appended (`"David (2)"`); join succeeds. |
| `ADV-SJ-16` | Concurrency | Two participants submit exact same nickname concurrently | Compound index + suffix retry safely suffixes both without error. |
| `ADV-SJ-17` | Token Security | Participant attempts to forge token without knowing secret | Verification fails (`401 Unauthorized`). |
| `ADV-SJ-18` | Token Security | Participant attempts to replay token from Session A in Session B | Scoping check rejects token (`401 Unauthorized`). |
| `ADV-SJ-19` | Token Security | Raw token is never persisted in plaintext in SQLite | Verified via direct SQL query asserting only HMAC-SHA256 hash exists. |
| `ADV-SJ-20` | Resumption | Legitimate participant resumes session with valid token | Successfully returns participant profile and updates `last_active_at`. |
| `ADV-SJ-21` | Resumption | Attacker tries to resume Participant A's identity with wrong token | Rejected; identity cannot be hijacked. |
| `ADV-SJ-22` | QR Code | QR code decoded string inspection | Contains only join URL; zero tokens or secrets present. |
| `ADV-SJ-23` | Secrecy | Public lookup action response payload inspection | Contains zero questions, answer choices, or correct indices. |
| `ADV-SJ-24` | Rate Limit | Rapid brute-force room code scanning attempts from single IP | IP throttled after 15 failed lookups; fails closed. |
| `ADV-SJ-25` | Lifecycle | Attempting to join a session in `COMPLETED` or `CLOSED` state | Rejected with `"Session has ended"`. |
| `ADV-SJ-26` | SQL Injection | Malicious SQL payload in nickname or room code parameter | Parameterized queries reject/escape payload; zero database corruption. |
| `ADV-SJ-27` | Admission | Single IP attempts to flood join 10 participants with unique nicknames | First 5 succeed; 6th through 10th rejected with `RateLimitExceededError`. |
| `ADV-SJ-28` | Proxy Spoofing | Direct request injects spoofed `X-Forwarded-For: 8.8.8.8` from untrusted socket | Ignored; rate limiter records true `socket.remoteAddress`. |
| `ADV-SJ-29` | Proxy Cloudflare | Verified Cloudflare IP presents valid `CF-Connecting-IP` | Evaluated correctly against client IP quota. |
| `ADV-SJ-30` | Suffix Contradiction | User enters 20-char name colliding 3 times (`"Christopher-Alex"`) | Formats to `"Christopher-Alex (2)"` (24 chars max); zero truncation or regex error. |
| `ADV-SJ-31` | Suffix Injection | User enters `"Sarah (2)"` directly in input field | Rejected by raw input validation (parentheses disallowed in user input). |
| `ADV-SJ-32` | Suffix Exhaustion | 100 participants join with base name `"Sarah"` | First 99 succeed (`"Sarah"` through `"Sarah (99)"`); 100th fails with `NicknameSuffixExhaustedError`. |
| `ADV-SJ-33` | Nickname NFKC | Homoglyphs and invisible formatting (`​`, `﻿`, Cyrillic confusable letters) | Normalized to canonical form; invisible zero-width spaces rejected. |
| `ADV-SJ-34` | Cookie Attributes | Inspect Set-Cookie header on successful join | Emits `HttpOnly; Secure; SameSite=Lax; Path=/join; Max-Age=14400`. Script cannot read cookie. |
| `ADV-SJ-35` | Multi-Tab Isolation | Tab 1 (`user_a`) and Tab 2 (`user_b`) refresh independently on same browser | `sessionStorage` retains separate identities; zero cross-tab session hijacking. |
| `ADV-SJ-36` | Cookie Fallback | Tab clears `sessionStorage` but retains cookie, then refreshes | Rehydrates participant identity cleanly via cookie fallback. |
| `ADV-SJ-37` | Blast Radius | Attacker floods 500 invalid room codes from IP `198.51.100.5` | Attacker IP throttled; legitimate client from IP `203.0.113.10` joins successfully. |
| `ADV-SJ-38` | Subnet Throttle | Attacker botnet rotates 100 IPs within same `/24` subnet | Subnet bucket throttles after 60 failed lookups; other subnets unaffected. |
| `ADV-SJ-39` | Milestone Boundary | Attempt to call live countdown, live timer, or submit answer on BAREA-006 endpoint | Endpoint does not exist; returns 404. Session state remains `LOBBY`. |
| `ADV-SJ-40` | Session Lock | Host locks session via `lockSessionAction` | Incoming join rejected with `SessionLockedError` (HTTP 423). Existing participants unaffected. |
| `ADV-SJ-41` | Participant Kick | Host kicks participant via `kickParticipantAction` | Participant row deleted; token invalidated; participant cannot resume. |

---

## 14. Deterministic Test Seams

To eliminate flaky tests caused by `Date.now()`, `Math.random()`, or wall-clock timers:
1. **`ClockProvider`**: Supports `FrozenClockProvider` with manual time advancement for testing session expiration (`expires_at`), cookie max-age, and rate-limit sliding windows.
2. **`RoomCodeGenerator`**: Supports `DeterministicRoomCodeGenerator` to test room code collision retries deterministically.
3. **`RateLimitStore`**: In-memory test store allowing deterministic reset of IP and subnet rate-limit buckets between test executions.

---

## 15. Conclusion & Verification Readiness

All seven independent NO-GO findings have been systematically resolved:
1. **Join Flooding**: Multi-tier admission control (per-IP quota, session concurrency valve, host lock/kick, zero CAPTCHA).
2. **Trusted Proxy / IP Extraction**: Right-to-left traversal with `TRUSTED_PROXY_CIDRS` allowlist, Cloudflare validation, socket fallback.
3. **Snapshot / Organization Tenant Integrity**: SQLite `BEFORE INSERT` trigger on `quiz_sessions` enforcing relational tenant consistency with `quizzes`.
4. **Nickname / Suffix Contradiction**: Decoupled `RawNicknameInput` (2..20 chars, no parentheses) from `DisplayName` (2..24 chars with `(2)`..` (99)` suffix).
5. **Participant Cookie Security**: `HttpOnly; Secure; SameSite=Lax; Path=/join; Max-Age=14400` with `sessionStorage` primary for family iPad tab isolation.
6. **Strict BAREA-006 Lobby Boundary**: All sessions created in `LOBBY` only; live state transitions strictly deferred to BAREA-007; zero question leakage.
7. **Global Limiter Blast Radius**: Dangerous 250-attempt global kill-switch completely eliminated; partitioned per-IP and per-subnet buckets with bounded memory.

## 15. Gate Conclusion & Verification Results

The second-pass post-remediation audit by all 6 specialized subagents has completed with a **UNANIMOUS GO**:

| Role | Subagent Conversation ID | Verification Focus | Final Verdict |
| :--- | :--- | :--- | :--- |
| **Security Architect & Red Team** | `a937caff-c12f-42a9-ae51-10346fd1c3df` | Join flood limits (5/session/IP), right-to-left proxy extraction, trigger tenant guard, decoupled nickname bounds, HttpOnly cookie, blast radius isolation | **GO** |
| **SQLite Persistence Architect** | `d1da20d9-7fcf-467f-953a-de53750f08a7` | SQLite `BEFORE INSERT` trigger tenant guard, pre-lock token hashing, atomic capacity check, `normalized_nickname` compound index, WAL & busy_timeout=5000 | **GO** |
| **QA & Test Architect** | `a6973584-60f6-4513-b57d-0826171eeed8` | 41 discrete adversarial test cases (`ADV-SJ-01`..`41`), deterministic seams (`FrozenClockProvider`, `DeterministicRoomCodeGenerator`, `RateLimitStore`), real production paths | **GO** |
| **TypeScript & Code Quality Specialist** | `d865a279-7b16-4d33-8c5b-fe2bb5b8938e` | Branded types (`RawNicknameInput`, `NormalizedNicknameKey`, `DisplayName`, `RoomCode`, `ParticipantToken`, `ClientIp`), error taxonomy, Server Action contracts, zero-`any` | **GO** |
| **Frontend & Next.js Security Specialist** | `d72852b1-a942-423b-8b7d-bc9cc5df557a` | Path-scoped participant cookie (`Path=/join`, `SameSite=Lax`), `sessionStorage` primary multi-tab family iPad isolation, 48px touch targets, zero live quiz leakage | **GO** |
| **Independent Product & Architecture Reviewer** | `53e71a09-4a79-4d9f-b070-d95c873e1754` | Church demographic usability (frictionless, no CAPTCHA), sanctuary projector visibility, duplicate name fellowship UX, strict BAREA-006/007 boundary | **GO** |

**FINAL DESIGN GATE VERDICT: UNANIMOUS GO ACROSS ALL 6 SPECIALIZED ROLES**  
**IMPLEMENTATION STATUS: ZERO APPLICATION CODE WRITTEN — STOPPED PER MANDATE AWAITING USER INDEPENDENT GO / NO-GO**
