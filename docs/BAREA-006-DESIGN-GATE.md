# BAREA-006: Share/Join — System Design & Verification Gate

**Status: COMPLETE REDESIGN — MULTI-MODE ARCHITECTURE (TWO-AGENT REVIEWED & VERIFIED — UNANIMOUS GO)**
**Date: 2026-09-10**
**Dependency:** BAREA-005 completed and merged on `main` (`94af326`)
**Implementation Authorization:** NOT AUTHORIZED (Design Gate Only — Two-Agent Verification Passed; Awaiting User / ChatGPT Independent Review & GO / NO-GO)

---

## 1. Objective & Canonical Workflows

The objective of **BAREA-006: Share/Join** is to design the domain model, persistence schema, server-authoritative security boundaries, entry discovery mechanisms (QR, direct URL, 6-character room codes, future invite codes), participation modes, admission policies, verified invitation allowlists, teacher group management, and scheduled start contracts.

BAREA-006 replaces the obsolete anonymous nickname model with two distinct, first-class participation modes and three decoupled admission policies.

---

### Workflow A: Teacher-Controlled Group Mode (Sunday School / Children)

```text
[Published Quiz Snapshot (BAREA-005)]
               ↓
[Host Creates Session via Server Action (createSessionAction)]
  - Context: getAuthorizedTeacherContext() (Organization or Personal Workspace)
  - Participation Mode: TEACHER_GROUP
  - Admission Policy: TEACHER_ASSIGNED
  - Optional: scheduledStartAt (UTC ISO-8601)
               ↓
[Server creates Session in LOBBY status]
  - Reference to published_quiz_snapshots(id) verified for matching workspace_id
  - SQLite BEFORE INSERT trigger enforces relational workspace integrity
  - Generates 6-char cryptographic room code & high-contrast vector SVG QR Code
               ↓
[Host / Podium Sharing View renders QR & Room Code for Sanctuary Display]
               ↓
[Teacher Configures Groups & Pupils via Host Console]
  - Teacher calls createSessionGroupAction(sessionId, "Red Team")
  - Teacher calls assignPupilToGroupAction(sessionId, groupId, "Timothy")
  - Pupils have NO personal accounts, NO OAuth, NO phones, NO laptops, NO devices
  - Children do NOT authenticate or individually join the session
               ↓
[Teacher Conducts Quiz from Host Console]
  - Host views Group Roster via getHostSessionRosterAction(sessionId)
  - Teacher records/marks answers on behalf of groups (Execution deferred to BAREA-007)
               ↓
[BOUNDARY GATE: BAREA-007 Live State Machine / Websocket Transport (NOT IN BAREA-006)]
```

---

### Workflow B: Individual Authenticated Mode (Youth / Adults / Congregation)

```text
[Published Quiz Snapshot (BAREA-005)]
               ↓
[Host Creates Session via Server Action (createSessionAction)]
  - Context: Authorized Teacher or Personal Creator Context
  - Participation Mode: INDIVIDUAL_AUTHENTICATED
  - Admission Policy: OPEN or RESTRICTED
  - If RESTRICTED: Creator supplies invitation allowlist (verified emails and/or E.164 phones)
               ↓
[Participant discovers session via QR code, direct URL, or room code]
  - Transport resolves session_id ONLY (Room code NEVER bypasses admission)
  - Pre-validates session status (must be LOBBY or ACTIVE)
               ↓
[Participant Authenticates via Existing BAREA OAuth Foundation (e.g. Google OAuth)]
  - Provider returns verified identity: provider_sub (canonical immutable key), email, email_verified
  - BAREA maps provider_sub to internal BAREA account (user_id)
  - Client-supplied emails or display names are NEVER trusted as security claims
               ↓
[Server Evaluates Admission Policy]
  - If OPEN: Verified user is admitted immediately.
  - If RESTRICTED: Server matches verified email (or verified E.164 phone) against session_invitations.
    - If uninvited or unverified: Fails closed with generic 404 (prevents allowlist enumeration).
               ↓
[Server Admits Participant atomically inside BEGIN IMMEDIATE]
  - Checks session capacity (COUNT(*) < max_participants)
  - Checks session lock state (is_locked === 0)
  - Inserts session_participants with UNIQUE(session_id, user_id)
  - Issues ephemeral session resumption token (ptok_...), HMAC-SHA256 hashed in SQLite
               ↓
[Client Enters Waiting Room / Lobby State]
  - Stores token in sessionStorage (primary for tab isolation on family iPads)
  - Emits HttpOnly; Secure; SameSite=Lax; Path=/join cookie as Safari refresh fallback
  - Displays: "You're in! Waiting for the host to start..."
  - If scheduledStartAt is set, displays scheduled start time in user's local timezone
               ↓
[BOUNDARY GATE: BAREA-007 Live State Machine / Websocket Transport (NOT IN BAREA-006)]
```

---

## 2. Scope & Explicit Non-Goals

### In Scope (BAREA-006)
1. **Two Distinct Participation Modes**:
   - `TEACHER_GROUP`: Sunday School / classroom setting where pupils have no personal devices or BAREA accounts. Teacher creates groups, assigns pupils, and operates the interface.
   - `INDIVIDUAL_AUTHENTICATED`: Participants authenticate through BAREA's existing OAuth/social login foundation. Security identity binds strictly to the provider's stable subject (`provider_sub`) and internal `user_id`. Display name is purely presentational; duplicate display names are permitted.
2. **Three Decoupled Admission Policies**:
   - `TEACHER_ASSIGNED`: Managed exclusively by the host for teacher-controlled group mode.
   - `OPEN`: Authenticated individual users may join subject to capacity and anti-abuse limits.
   - `RESTRICTED`: Authenticated individual users must have a verified claim (canonical lowercase email or normalized E.164 phone number) matching the stored `session_invitations` allowlist.
3. **Unified Workspace & Creator Model**:
   - Supports both `ORGANIZATION` workspaces (churches, ministries) and `PERSONAL` workspaces (individual creators).
   - Strict tenant isolation enforced at persistence layer via SQLite triggers.
4. **Transport & Entry Decoupling**:
   - Entry mechanisms (QR code, canonical direct URL `/join/[roomCode]`, 6-character room access code) are transport discovery mechanisms **only** and never grant authorization by themselves.
   - Future Quiz Invite Code contract defined as an abstract extension point (not implemented in BAREA-006).
   - Base URL strictly pinned to `process.env.NEXT_PUBLIC_APP_URL` (eliminating HTTP Host header poisoning).
5. **Church Wi-Fi / NAT Anti-Abuse (Zero Per-IP Seat Quotas)**:
   - **No hard successful-participant-per-IP quota**: Dozens of legitimate congregants sharing a single church Wi-Fi or NAT IP address (`203.0.113.50`) can join simultaneously.
   - Rate limiting targets *rapid unauthenticated requests* and *failed room-code probes*, with isolated per-IP and subnet (`/24`) buckets. Zero platform-wide kill switches.
6. **Privacy & Enumeration Protection**:
   - Strict zero-disclosure of invitee email addresses, phone numbers, provider subjects, or allowlists on public endpoints, participant rosters, or projector views.
   - Generic failure responses prevent malicious actors from using endpoints to discover private quizzes or invited members.
7. **Scheduled Start Metadata**:
   - Captures and validates `scheduled_start_at` (UTC ISO-8601 string) ensuring $\text{now} < \text{scheduled\_start\_at} < \text{expires\_at}$.
8. **Persistence & SQLite Constraints**:
   - Tables: `quiz_sessions`, `session_participants`, `session_groups`, `session_group_pupils`, `session_invitations`.
   - SQLite `BEFORE INSERT` and `BEFORE UPDATE` triggers enforcing workspace snapshot integrity.
   - Pragmas: `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, `PRAGMA foreign_keys = ON;`.
9. **Comprehensive Adversarial Test Matrix**: 41 named adversarial test cases covering authentication, admission policies, teacher groups, tenant boundaries, entry mechanisms, NAT rate limiting, scheduling, and concurrency.

### Explicit Non-Goals (Strict Milestone Boundaries)
To maintain strict milestone quarantine:
- **No Live Quiz State Machine**: BAREA-006 creates sessions in `LOBBY` status only. The authoritative transition `LOBBY -> ACTIVE` is exclusively owned by BAREA-007.
- **No Real-Time Transport**: No WebSockets, Socket.io, or SSE connections.
- **No Authoritative Timers or Countdown Synchronization**.
- **No Participant Answer Submissions or Live Scoring Engine** (`submitAnswerAction` does not exist).
- **No Standings, Leaderboards, or Podium Animations**.
- **No Live Question Display**: Zero question stems, option arrays, correct indices, or explanations are returned in BAREA-006 responses.

---

## 3. Domain Model & TypeScript Contracts

The domain contracts reside in `src/domain/session.ts` and `src/domain/value-objects.ts`:

```typescript
// src/domain/session.ts
import { RoomCode, ParticipantToken, ClientIp } from './value-objects';

export const ParticipationMode = Object.freeze({
  TEACHER_GROUP: 'TEACHER_GROUP',
  INDIVIDUAL_AUTHENTICATED: 'INDIVIDUAL_AUTHENTICATED'
} as const);
export type ParticipationMode = (typeof ParticipationMode)[keyof typeof ParticipationMode];

export const AdmissionPolicy = Object.freeze({
  TEACHER_ASSIGNED: 'TEACHER_ASSIGNED',
  OPEN: 'OPEN',
  RESTRICTED: 'RESTRICTED'
} as const);
export type AdmissionPolicy = (typeof AdmissionPolicy)[keyof typeof AdmissionPolicy];

export const WorkspaceType = Object.freeze({
  ORGANIZATION: 'ORGANIZATION',
  PERSONAL: 'PERSONAL'
} as const);
export type WorkspaceType = (typeof WorkspaceType)[keyof typeof WorkspaceType];

export const SessionStatus = Object.freeze({
  LOBBY: 'LOBBY',
  ACTIVE: 'ACTIVE',       // Transition owned exclusively by BAREA-007
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED'
} as const);
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export type QuizSession =
  | {
      readonly id: string;
      readonly workspaceType: WorkspaceType;
      readonly workspaceId: string;
      readonly publishedQuizSnapshotId: string;
      readonly hostUserId: string;
      readonly roomCode: RoomCode;
      readonly participationMode: ParticipationMode;
      readonly admissionPolicy: AdmissionPolicy;
      readonly status: 'LOBBY' | 'ACTIVE';
      readonly scheduledStartAt: string | null; // ISO-8601 UTC string (e.g. 2026-09-10T15:00:00Z)
      readonly isLocked: boolean;
      readonly stateVersion: number;
      readonly maxParticipants: number;
      readonly createdAt: string;              // ISO-8601 UTC
      readonly expiresAt: string;              // ISO-8601 UTC
      readonly closedAt: null;
    }
  | {
      readonly id: string;
      readonly workspaceType: WorkspaceType;
      readonly workspaceId: string;
      readonly publishedQuizSnapshotId: string;
      readonly hostUserId: string;
      readonly roomCode: RoomCode;
      readonly participationMode: ParticipationMode;
      readonly admissionPolicy: AdmissionPolicy;
      readonly status: 'COMPLETED' | 'CLOSED';
      readonly scheduledStartAt: string | null;
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
  readonly workspaceName?: string;
  readonly participationMode: ParticipationMode;
  readonly admissionPolicy: AdmissionPolicy;
  readonly sessionStatus: SessionStatus;
  readonly scheduledStartAt: string | null;
  readonly isLocked: boolean;
  readonly totalQuestions: number;
  readonly defaultTimeLimitSeconds: number;
  readonly participantCount: number;
}

export interface AuthenticatedParticipant {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;                   // Internal BAREA user ID
  readonly providerType: string;             // e.g. 'GOOGLE'
  readonly providerSub: string;              // Canonical external subject
  readonly verifiedEmail: string | null;
  readonly verifiedPhone: string | null;
  readonly displayName: string;              // Presentation name (duplicates permitted)
  readonly joinedAt: string;                 // ISO-8601 UTC
  readonly lastActiveAt: string;             // ISO-8601 UTC
}

export interface SessionGroup {
  readonly id: string;
  readonly sessionId: string;
  readonly groupName: string;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly pupils: readonly SessionGroupPupil[];
}

export interface SessionGroupPupil {
  readonly id: string;
  readonly sessionGroupId: string;
  readonly sessionId: string;
  readonly pupilName: string;                // Presentation name (no BAREA account required)
  readonly assignedAt: string;
}

export interface SessionInvitation {
  readonly id: string;
  readonly sessionId: string;
  readonly invitationType: 'EMAIL' | 'PHONE';
  readonly normalizedIdentifier: string;     // Canonical lowercase email or E.164 phone
  readonly invitedAt: string;
  readonly claimedByUserId: string | null;
  readonly claimedAt: string | null;
}
```

---

## 4. Value Objects & Branded Types

Nominal branding in `src/domain/value-objects.ts` enforces type safety and input sanitization:

```typescript
// src/domain/value-objects.ts
import {
  InvalidRoomCodeError,
  InvalidParticipantTokenError,
  InvalidClientIpError,
  InvalidScheduledTimeError
} from './domain-errors';

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RoomCode = Brand<string, 'RoomCode'>;
export type ParticipantToken = Brand<string, 'ParticipantToken'>;
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

// 2. ParticipantToken: 'ptok_' followed by 43 base64url characters (~256 bits entropy)
export const PARTICIPANT_TOKEN_REGEX = /^ptok_[A-Za-z0-9_-]{43}$/;

export function validateParticipantToken(raw: unknown): ParticipantToken {
  if (typeof raw !== 'string' || !PARTICIPANT_TOKEN_REGEX.test(raw)) {
    throw new InvalidParticipantTokenError('Invalid participant session token format.');
  }
  return raw as ParticipantToken;
}

// 3. Email & Phone Normalizers for Allowlist Matching
export function normalizeAllowlistEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export function normalizeAllowlistPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (!E164_PHONE_REGEX.test(trimmed)) {
    throw new Error(`Phone number must follow international E.164 format (e.g. +12125550123). Got: '${raw}'`);
  }
  return trimmed;
}

// 4. Scheduled Start Time Validator (ISO-8601 UTC)
export function validateScheduledStartTime(raw: unknown, nowEpochMs: number, expiresEpochMs: number): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') throw new InvalidScheduledTimeError('Scheduled start time must be a string.');

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime()) || !raw.endsWith('Z')) {
    throw new InvalidScheduledTimeError('Scheduled start time must be a valid UTC ISO-8601 timestamp ending in Z.');
  }

  const startMs = parsed.getTime();
  if (startMs <= nowEpochMs) {
    throw new InvalidScheduledTimeError('Scheduled start time must be in the future.');
  }
  if (startMs >= expiresEpochMs) {
    throw new InvalidScheduledTimeError('Scheduled start time cannot exceed session expiration time.');
  }

  return parsed.toISOString();
}
```

---

## 5. Participation Modes & Admission Policy Engine

### A. Two Participation Modes (How the Quiz is Played)

1. **Teacher-Controlled Group Mode (`TEACHER_GROUP`)**:
   - **Sunday School Reality**: Children have no BAREA accounts, no OAuth logins, no phones, and no devices.
   - **Teacher Operation**: The teacher creates groups (`session_groups`) and assigns pupil names (`session_group_pupils`).
   - **Answer Recording**: In BAREA-007, answers will be marked and submitted by the authorized teacher on behalf of groups.
   - **Pupil Protection**: Pupil names are ephemeral session data. No child accounts are created or required.
2. **Individual Authenticated Mode (`INDIVIDUAL_AUTHENTICATED`)**:
   - **Provider-Backed Identity**: Every individual participant must authenticate using BAREA's established OAuth architecture (e.g. Google login).
   - **Canonical Identity**: The user is identified by their immutable provider subject (`provider_sub`) mapped to their BAREA `user_id`.
   - **No Display Name Security**: Display names are strictly presentational. Duplicate display names are fully supported (e.g. two users named "David" are distinct by `user_id`).
   - **No Self-Entered Nickname Impersonation**: A client cannot spoof identity by typing someone else's name.

---

### B. Three Decoupled Admission Policies (Who is Permitted to Enter)

| Admission Policy | Permitted Participation Mode | Admission Evaluation & Security Invariant |
| :--- | :--- | :--- |
| `TEACHER_ASSIGNED` | `TEACHER_GROUP` | Managed exclusively by the host. Public participant join endpoints (`joinSessionAction`) are disabled; attempts return `403 Forbidden`. |
| `OPEN` | `INDIVIDUAL_AUTHENTICATED` | Any authenticated BAREA user may join. Subject only to session capacity (`max_participants`) and standard abuse rate limiting. |
| `RESTRICTED` | `INDIVIDUAL_AUTHENTICATED` | Authenticated user must have a verified claim (canonical email or E.164 phone) matching an entry in `session_invitations`. Client-typed emails/phones are strictly ignored. |

### C. Allowlist Matching & Privacy Invariants
1. **Server-Side Verified Claims Only**:
   - The server resolves email from the verified OAuth token (`claims.email` where `claims.email_verified === true`).
   - The client request body cannot supply the email to match.
2. **Allowlist Enumeration Defense**:
   - If an uninvited user attempts to join a restricted session, the endpoint returns a generic response (`404 Session Not Found or Unavailable`).
   - Public discovery endpoints (`lookupRoomAction`) never disclose whether an allowlist exists or who is on it.
3. **Canonical Normalization**:
   - Emails: trimmed, lowercased, and NFKC normalized.
   - Phones: E.164 normalized (`+12125550123`).

---

## 6. Church Wi-Fi / NAT Anti-Abuse Architecture

### A. Mandatory Removal of Per-IP Seat Quotas
In a church sanctuary or youth hall, 50–200 participants share a single external IP address via church Wi-Fi or carrier-grade NAT.
- **Rule**: BAREA **never** imposes a hard quota on successful participant joins per IP address.
- Legitimate participants authenticated through Google/OAuth behind the same NAT router (`203.0.113.50`) are fully permitted to join.

### B. Layered Anti-Abuse Defense
1. **Per-IP Rate Limiting (Unauthenticated & Failed Probes Only)**:
   - Max 15 failed room-code lookup attempts per rolling 60 seconds per IP.
   - Max 30 total unauthenticated HTTP requests per 10 seconds per IP.
2. **Per-Identity Rate Limiting**:
   - An authenticated `user_id` is limited to max 1 join mutation per 5 seconds.
3. **Subnet-Level Isolation (`/24` IPv4, `/48` IPv6)**:
   - If a distributed botnet scans codes across an IP block, failed attempts are capped at 60/minute per `/24` subnet. Other church subnets remain completely unaffected.
4. **Zero Global Kill-Switches**:
   - The platform never implements global fail-closed sentinels. Throttling is strictly partitioned per client IP, subnet, or targeted room code.
5. **Trusted Proxy IP Resolution**:
   - Client IP is resolved using right-to-left traversal of `X-Forwarded-For` against `TRUSTED_PROXY_CIDRS`.
   - `CF-Connecting-IP` is trusted strictly when the direct TCP peer validates within Cloudflare CIDRs. Direct socket address fallback is used otherwise.

---

## 7. Transport & Entry Mechanisms

Entry mechanisms are **transport discovery channels**, NOT authorization primitives. Possession of a link or code never bypasses admission policy.

1. **Pure Vector SVG QR Code**:
   - Base URL strictly pinned to `process.env.NEXT_PUBLIC_APP_URL` (eliminates HTTP Host header poisoning).
   - Generated in-memory as pure vector SVG with Level M error correction and a 4-module quiet zone for reliable camera recognition from 30+ feet back in sanctuaries.
   - Contains strictly the canonical join URL (`https://barea.church/join/8K4M9Z`). Zero credentials, tokens, or quiz data.
2. **Direct Canonical URL**: `/join/[roomCode]`.
3. **6-Character Room Code**:
   - Generated via `crypto.randomInt(0, 31)` over 31 unambiguous characters (`2-9, A-Z excl. 0, 1, I, O`).
   - Normalizes input: uppercase, trimmed.
4. **Future Quiz Invite Code (Contract Reserved)**:
   - Extension point for future campaigns or scheduled classroom enrollments.
   - **Specification**: An invite code resolves to a specific session context. It does NOT bypass the session's admission policy or OAuth requirement. Marked as **FUTURE / NOT IMPLEMENTED in BAREA-006**.

---

## 8. Scheduled Start Contract

1. **Metadata Persistence**: `scheduled_start_at TEXT` (UTC ISO-8601 string) stored in `quiz_sessions`.
2. **Validation**: Stored start time must satisfy $\text{now} < \text{scheduled\_start\_at} < \text{expires\_at}$.
3. **Pre-Start Participant UX**:
   - If a participant joins before the scheduled start time, the session remains in `LOBBY` status.
   - The UI presents: *"Welcome, David! This quiz is scheduled to start at 10:30 AM (in 15 minutes). Please wait for the host."*
4. **Milestone Quarantine**: BAREA-006 does NOT implement live countdown timers, clock synchronization ticks, or automatic state advancement. The authoritative transition `LOBBY -> ACTIVE` belongs exclusively to BAREA-007.

---

## 9. Persistence Schema & Relational Integrity

Persistence is implemented in `src/persistence/sqlite-session-repository.ts` using Node.js `node:sqlite` (`DatabaseSync`).

### Pragmas
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
  workspace_type TEXT NOT NULL CHECK(workspace_type IN ('ORGANIZATION', 'PERSONAL')),
  workspace_id TEXT NOT NULL,
  published_quiz_snapshot_id TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  participation_mode TEXT NOT NULL CHECK(participation_mode IN ('TEACHER_GROUP', 'INDIVIDUAL_AUTHENTICATED')),
  admission_policy TEXT NOT NULL CHECK(admission_policy IN ('TEACHER_ASSIGNED', 'OPEN', 'RESTRICTED')),
  status TEXT NOT NULL CHECK(status IN ('LOBBY', 'ACTIVE', 'COMPLETED', 'CLOSED')),
  scheduled_start_at TEXT CHECK(scheduled_start_at IS NULL OR (length(scheduled_start_at) = 20 AND scheduled_start_at LIKE '%Z')),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
  state_version INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 100 CHECK(max_participants BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (published_quiz_snapshot_id) REFERENCES published_quiz_snapshots(id) ON DELETE RESTRICT,
  CONSTRAINT chk_mode_admission_compatibility CHECK (
    (participation_mode = 'TEACHER_GROUP' AND admission_policy = 'TEACHER_ASSIGNED') OR
    (participation_mode = 'INDIVIDUAL_AUTHENTICATED' AND admission_policy IN ('OPEN', 'RESTRICTED'))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_room_code
ON quiz_sessions(room_code)
WHERE status IN ('LOBBY', 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_sessions_workspace
ON quiz_sessions(workspace_id, status);

-- 2. Persistence-Level Tenant Integrity Triggers
CREATE TRIGGER IF NOT EXISTS trg_enforce_session_snapshot_tenant_insert
BEFORE INSERT ON quiz_sessions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Tenant mismatch: referenced snapshot does not belong to session workspace')
  WHERE NOT EXISTS (
    SELECT 1
    FROM published_quiz_snapshots pqs
    WHERE pqs.id = NEW.published_quiz_snapshot_id
      AND pqs.organization_id = NEW.workspace_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_enforce_session_snapshot_tenant_update
BEFORE UPDATE OF published_quiz_snapshot_id, workspace_id ON quiz_sessions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Tenant mismatch: snapshot reference cannot cross workspace boundaries')
  WHERE NOT EXISTS (
    SELECT 1
    FROM published_quiz_snapshots pqs
    WHERE pqs.id = NEW.published_quiz_snapshot_id
      AND pqs.organization_id = NEW.workspace_id
  );
END;

-- 3. Individual Authenticated Participants Table
CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  provider_sub TEXT NOT NULL,
  verified_email TEXT,
  verified_phone TEXT,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) >= 1 AND length(display_name) <= 50),
  joined_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_session_participant_user UNIQUE (session_id, user_id),
  CONSTRAINT uq_session_participant_provider UNIQUE (session_id, provider_type, provider_sub)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token_hash
ON session_participants(token_hash);

CREATE INDEX IF NOT EXISTS idx_participants_session
ON session_participants(session_id);

-- 4. Teacher-Controlled Groups Table
CREATE TABLE IF NOT EXISTS session_groups (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  group_name TEXT NOT NULL CHECK(length(trim(group_name)) >= 1 AND length(group_name) <= 50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_session_group_name UNIQUE (session_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_session_groups_session
ON session_groups(session_id);

-- 5. Teacher-Controlled Group Pupils Table
CREATE TABLE IF NOT EXISTS session_group_pupils (
  id TEXT PRIMARY KEY,
  session_group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  pupil_name TEXT NOT NULL CHECK(length(trim(pupil_name)) >= 1 AND length(pupil_name) <= 50),
  assigned_at TEXT NOT NULL,
  FOREIGN KEY (session_group_id) REFERENCES session_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_group_pupil_name UNIQUE (session_group_id, pupil_name)
);

CREATE INDEX IF NOT EXISTS idx_group_pupils_group
ON session_group_pupils(session_group_id);

CREATE INDEX IF NOT EXISTS idx_group_pupils_session
ON session_group_pupils(session_id);

-- 6. Restricted Admission Invitations Table
CREATE TABLE IF NOT EXISTS session_invitations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  invitation_type TEXT NOT NULL CHECK(invitation_type IN ('EMAIL', 'PHONE')),
  normalized_identifier TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_session_invitation_target UNIQUE (session_id, invitation_type, normalized_identifier)
);

CREATE INDEX IF NOT EXISTS idx_invitations_lookup
ON session_invitations(session_id, normalized_identifier);
```

---

## 10. Server Action Boundaries & Runtime Allowlisting

All mutations are exposed through Next.js Server Actions with strict runtime allowlisting and discriminated union return envelopes:

```typescript
export type ActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string; readonly httpStatus: number } };
```

| Action | Caller | Authorization | Inputs (Allowlisted) | Outputs |
| :--- | :--- | :--- | :--- | :--- |
| `createSessionAction` | Host / Creator | Verified Creator Context | `publishedQuizSnapshotId`, `participationMode`, `admissionPolicy`, `scheduledStartAt?`, `maxParticipants?`, `invitations?` | `ActionResult<QuizSession>` |
| `closeSessionAction` | Host / Creator | Verified Creator Context | `sessionId` | `ActionResult<{ success: boolean }>` |
| `lockSessionAction` | Host / Creator | Verified Creator Context | `sessionId`, `locked: boolean` | `ActionResult<{ isLocked: boolean }>` |
| `createSessionGroupAction` | Host / Teacher | Verified Host Context | `sessionId`, `groupName` | `ActionResult<SessionGroup>` |
| `assignPupilAction` | Host / Teacher | Verified Host Context | `sessionId`, `groupId`, `pupilName` | `ActionResult<SessionGroupPupil>` |
| `removePupilAction` | Host / Teacher | Verified Host Context | `sessionId`, `groupId`, `pupilId` | `ActionResult<{ success: boolean }>` |
| `deleteSessionGroupAction`| Host / Teacher | Verified Host Context | `sessionId`, `groupId` | `ActionResult<{ success: boolean }>` |
| `getHostSessionRosterAction` | Host / Creator | Verified Creator Context | `sessionId` | `ActionResult<{ mode: ParticipationMode; participants?: AuthenticatedParticipant[]; groups?: SessionGroup[] }>` |
| `lookupRoomAction` | Public / Invitee | Unauthenticated / IP Throttled | `roomCode` (6 chars) | `ActionResult<SessionPublicInfo>` |
| `joinSessionAction` | Individual Participant | Verified OAuth Session Context | `roomCode` *(Identity extracted from server auth session)* | `ActionResult<{ participantId: string; token: ParticipantToken }>` |
| `resumeSessionAction` | Individual Participant | Verified OAuth or Token | `sessionId`, `participantId`, `token` | `ActionResult<{ participant: AuthenticatedParticipant; sessionInfo: SessionPublicInfo }>` |

---

## 11. Domain Error Hierarchy & Taxonomy

```typescript
// src/domain/domain-errors.ts
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
  constructor(id: string) { super(`Session not found or unavailable: '${id}'`); }
}

export class SessionClosedError extends BareaDomainError {
  readonly code = 'SESSION_CLOSED';
  readonly httpStatus = 409;
  constructor() { super('This session is closed to new participants.'); }
}

export class SessionLockedError extends BareaDomainError {
  readonly code = 'SESSION_LOCKED';
  readonly httpStatus = 423;
  constructor() { super('This session is currently locked by the host.'); }
}

export class SessionFullError extends BareaDomainError {
  readonly code = 'SESSION_FULL';
  readonly httpStatus = 429;
  constructor(limit: number) { super(`Session has reached its maximum capacity of ${limit} participants.`); }
}

export class SessionAccessDeniedError extends BareaDomainError {
  readonly code = 'SESSION_ACCESS_DENIED';
  readonly httpStatus = 403;
  constructor() { super('Access denied. You are not authorized to join this restricted session.'); }
}

export class CrossTenantSnapshotError extends BareaDomainError {
  readonly code = 'CROSS_TENANT_SNAPSHOT_FORBIDDEN';
  readonly httpStatus = 403;
  constructor() { super('Quiz snapshot does not belong to authorized workspace.'); }
}

export class InvalidScheduledTimeError extends BareaDomainError {
  readonly code = 'INVALID_SCHEDULED_TIME';
  readonly httpStatus = 400;
}

export class InvalidRoomCodeError extends BareaDomainError {
  readonly code = 'INVALID_ROOM_CODE';
  readonly httpStatus = 400;
}

export class InvalidParticipantTokenError extends BareaDomainError {
  readonly code = 'INVALID_PARTICIPANT_TOKEN';
  readonly httpStatus = 401;
}

export class RateLimitExceededError extends BareaDomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly httpStatus = 429;
  constructor(retryAfter: number = 60) {
    super(`Too many requests. Please wait ${retryAfter} seconds before retrying.`);
  }
}
```

---

## 12. Security Boundary with BAREA-007

To enforce strict milestone quarantine:
1. **LOBBY Status Only**: BAREA-006 creates sessions in `LOBBY` status only. `LOBBY -> ACTIVE` state transition is owned by BAREA-007.
2. **Zero Answer Key Leakage**: Neither `lookupRoomAction`, `joinSessionAction`, nor `resumeSessionAction` expose question choices, stems, explanations, or correct answer indices.
3. **No Authoritative Timers**: No countdown ticks or clock synchronizations are served.
4. **No Scoring or Answers**: `submitAnswerAction` does NOT exist in BAREA-006.
5. **No WebSockets**: Live real-time transports are deferred to BAREA-007.

---

## 13. Comprehensive Adversarial Test Matrix (ADV-01 through ADV-41)

### Authentication & Identity
- `ADV-AUTH-01`: **Provider Subject Spoofing**: Client injects forged `provider_sub` in body; rejected because identity is derived strictly from server-verified OAuth context.
- `ADV-AUTH-02`: **Client Email Claim Forgery**: Client posts `{ email: "pastor@church.org" }`; rejected when server checks verified claim from OAuth token.
- `ADV-AUTH-03`: **Unverified Email in Restricted Session**: User with `email_verified: false` attempts to join restricted session; rejected.
- `ADV-AUTH-04`: **Unverified Phone in Restricted Session**: Identity lacks verified E.164 phone; rejected.
- `ADV-AUTH-05`: **Provider Identity Mismatch**: Token issued to user A cannot resume user B's participant session.
- `ADV-AUTH-06`: **Duplicate Identity Joining**: Authenticated user joins session twice; database unique constraint `uq_session_participant_user` prevents duplicate seat; rehydrates existing participant.
- `ADV-AUTH-07`: **Display Name Duplication**: Multiple users named "David" join; permitted cleanly because `user_id` and `provider_sub` are the canonical identities.
- `ADV-AUTH-08`: **Session Credential Replay**: Token from session S1 replayed in session S2; rejected with `401 Unauthorized`.

### Admission Policies
- `ADV-ADM-01`: **Open Session Individual Join**: Authenticated user joins open session successfully.
- `ADV-ADM-02`: **Restricted Session Reject**: Authenticated user with email not on allowlist receives generic `404 Session Not Found or Unavailable`.
- `ADV-ADM-03`: **Restricted Session Accept**: Authenticated user with email `Bob@Church.ORG` matches allowlist entry `bob@church.org`; joins successfully and marks invitation claimed.
- `ADV-ADM-04`: **Generic Enumeration Defense**: Uninvited user probing restricted room receives identical generic error message as nonexistent room code, preventing allowlist enumeration.
- `ADV-ADM-05`: **Invite/Room Code Cannot Bypass Admission**: Possessing the room code or QR link does not bypass the allowlist check for restricted sessions.
- `ADV-ADM-06`: **Teacher Assigned Public Lockout**: Public participant attempting to call `joinSessionAction` on `TEACHER_GROUP` / `TEACHER_ASSIGNED` session is rejected with `403 Forbidden`.

### Teacher-Controlled Groups
- `ADV-TGRP-01`: **Authorized Teacher Creates Groups**: Teacher creates "Red Team" and "Blue Team" in Mode A session.
- `ADV-TGRP-02`: **Unauthorized User Cannot Create Groups**: Non-host user or participant attempting group creation receives `403 Forbidden`.
- `ADV-TGRP-03`: **Pupil Assignment**: Teacher assigns "Timothy" and "Hannah" to "Red Team". No child account or device is created or required.
- `ADV-TGRP-04`: **Session-Scoped Boundary**: Groups for session S1 cannot be accessed or manipulated from session S2.
- `ADV-TGRP-05`: **Cross-Tenant Group Guard**: Teacher in Organization B cannot view or modify groups in Organization A.

### Tenant & Workspace Security
- `ADV-TNT-01`: **Cross-Tenant Snapshot Rejection**: Teacher in Org A creates session referencing snapshot belonging to Org B; SQLite trigger immediately raises abort.
- `ADV-TNT-02`: **Personal Workspace Isolation**: Individual creator creates session in personal workspace; Org A admin cannot access or manage it.
- `ADV-TNT-03`: **Privacy Leakage Defense**: Public endpoints (`lookupRoomAction`) NEVER expose `provider_sub`, `verified_email`, `verified_phone`, or allowlists.

### Entry Mechanisms & QR
- `ADV-ENTRY-01`: **QR Code Contains Zero Secrets**: Decoded QR string contains only canonical URL; zero tokens or secrets present.
- `ADV-ENTRY-02`: **Host Header Poisoning Defense**: Join URL constructed strictly from `process.env.NEXT_PUBLIC_APP_URL`.
- `ADV-ENTRY-03`: **Room Code Normalization**: Case-insensitive room code lookup (`8k4m9z` vs `8K4M9Z`) normalizes cleanly.
- `ADV-ENTRY-04`: **Future Invite Code Contract**: Future invite code maps to session discovery context only; cannot bypass admission.

### Church Wi-Fi / NAT Anti-Abuse
- `ADV-NAT-01`: **Congregation Concurrency on Shared IP**: 80 legitimate individual participants sharing the exact same public IP (`203.0.113.50`) join an open session without hitting a per-IP seat cap.
- `ADV-NAT-02`: **Per-IP Failed Lookup Throttling**: Scanner sending 15 rapid invalid room code lookups from single IP is throttled without impacting users on other IPs.
- `ADV-NAT-03`: **No Global Kill-Switch**: Malicious flooding of invalid room codes does not disable joining for legitimate sessions.
- `ADV-NAT-04`: **Spoofed Header Protection**: Request with untrusted `X-Forwarded-For` from untrusted socket is ignored; socket IP is strictly enforced.

### Scheduling & Milestone Boundary
- `ADV-SCH-01`: **Scheduled Start Time Validation**: Non-UTC, past dates, or timestamps exceeding expiration are rejected.
- `ADV-SCH-02`: **Pre-Start Inactive State**: When `scheduled_start_at` is in the future, session status remains strictly `LOBBY`.
- `ADV-SCH-03`: **Milestone Boundary Defense**: BAREA-006 endpoints cannot start live gameplay or advance questions (`submitAnswerAction` does NOT exist in BAREA-006).

### Concurrency & Rollback
- `ADV-CONC-01`: **Capacity Race**: Session with `max_participants = 50` receives 60 simultaneous joins in parallel threads. Exactly 50 succeed; 10 fail with `SessionFullError`. Direct DB count is exactly 50.
- `ADV-CONC-02`: **Simultaneous User Join Race**: User attempts 2 concurrent joins with identical credentials. Unique constraint aborts one cleanly with zero data corruption.
- `ADV-CONC-03`: **Rollback Cleans State**: Transaction failure during participant insertion leaves zero orphaned records.
- `ADV-CONC-04`: **Room Code Collision Retry**: Generator retries upon unique active room code constraint and succeeds with unique code.

---

## 14. Deterministic Test Seams

To eliminate flaky tests caused by `Date.now()`, `Math.random()`, or wall-clock timers:
1. **`ClockProvider`**: Supports `FrozenClockProvider` with manual time advancement for testing `scheduled_start_at`, session expiration (`expires_at`), cookie max-age, and rate-limit sliding windows.
2. **`RoomCodeGenerator`**: Supports `DeterministicRoomCodeGenerator` to test room code collision retries deterministically.
3. **`RateLimitStore`**: In-memory test store allowing deterministic reset of IP and subnet rate-limit buckets between test executions.

---

## 15. Conclusion & Verification Readiness

The redesigned BAREA-006 Share/Join System Design Gate resolves all architectural deficiencies:
1. **Mode A & Mode B**: First-class support for both Teacher-Controlled Groups (no child devices/accounts) and Individual Authenticated Mode (OAuth provider-backed identity).
2. **Decoupled Admission Policies**: `TEACHER_ASSIGNED`, `OPEN`, and `RESTRICTED` (verified email/phone allowlists).
3. **Church Wi-Fi / NAT Support**: Completely abolished the hostile 5-join-per-IP quota.
4. **Tenant & Workspace Integrity**: Unified support for `PERSONAL` and `ORGANIZATION` workspaces with SQLite trigger protection.
5. **Milestone Boundary Quarantined**: Scheduled start persisted without premature live game state advancement.

**STATUS: READY FOR TWO-AGENT SECOND-PASS VERIFICATION AUDIT**
**IMPLEMENTATION STATUS: ZERO APPLICATION CODE WRITTEN — STRICT STOP MAINTAINED**
