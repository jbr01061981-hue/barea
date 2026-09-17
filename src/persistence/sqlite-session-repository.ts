import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'crypto';
import {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  SessionStatus,
  type QuizSession,
  type SessionPublicInfo,
  type AuthenticatedParticipant,
  type SessionGroup,
  type SessionGroupPupil,
  type SessionInvitation,
  assertValidModeAdmissionCompatibility
} from '../domain/session';
import {
  RoomCode,
  ParticipantToken,
  normalizeAndValidateRoomCode,
  validateParticipantToken,
  normalizeAllowlistEmail,
  normalizeAllowlistPhone,
  validateScheduledStartTime,
  derivePersonalTenantId
} from '../domain/value-objects';
import {
  SessionNotFoundError,
  SessionClosedError,
  SessionLockedError,
  SessionFullError,
  SessionAccessDeniedError,
  HostCannotParticipateInOwnSessionError,
  CrossTenantSnapshotError,
  InvalidParticipantTokenError,
  InvalidLiveStateTransitionError,
  AnswerDeadlineExpiredError,
  DuplicateAnswerSubmissionError,
  NotSessionHostError,
  SessionNotActiveError,
  InvalidQuestionChoiceError,
  ConcurrencyConflictError
} from '../domain/domain-errors';
import {
  QuestionLifecycleState,
  type LiveSessionState,
  type ParticipantSubmission
} from '../domain/live-quiz';
import type { PublishedQuizSnapshot, SnapshotQuestion } from '../domain/quiz';

export interface CreateSessionPayload {
  readonly workspaceType: WorkspaceType;
  readonly organizationId: string; // Authoritative tenant identity
  readonly publishedQuizSnapshotId: string;
  readonly hostUserId: string;
  readonly participationMode: ParticipationMode;
  readonly admissionPolicy: AdmissionPolicy;
  readonly scheduledStartAt?: string | null;
  readonly maxParticipants?: number;
  readonly invitations?: readonly { readonly type: 'EMAIL' | 'PHONE'; readonly identifier: string }[];
}

export interface SessionRepository {
  createSession(payload: CreateSessionPayload): Promise<QuizSession>;
  findSessionById(sessionId: string): Promise<QuizSession | null>;
  findSessionByRoomCode(roomCode: RoomCode): Promise<QuizSession | null>;
  getPublicInfo(roomCode: RoomCode): Promise<SessionPublicInfo>;
  lockSession(sessionId: string, hostUserId: string, locked: boolean): Promise<QuizSession>;
  closeSession(sessionId: string, hostUserId: string): Promise<QuizSession>;

  // Participant Operations
  joinSession(
    sessionId: string,
    participant: {
      userId: string;
      providerType: string;
      providerSub: string;
      verifiedEmail: string | null;
      verifiedPhone: string | null;
      displayName: string;
    }
  ): Promise<{ participant: AuthenticatedParticipant; token: ParticipantToken }>;

  resumeSession(sessionId: string, token: ParticipantToken): Promise<{ participant: AuthenticatedParticipant; session: QuizSession }>;
  listParticipants(sessionId: string): Promise<readonly AuthenticatedParticipant[]>;

  // Teacher Group Operations
  createGroup(sessionId: string, hostUserId: string, groupName: string): Promise<SessionGroup>;
  deleteGroup(sessionId: string, hostUserId: string, groupId: string): Promise<boolean>;
  assignPupil(sessionId: string, hostUserId: string, groupId: string, pupilName: string): Promise<SessionGroupPupil>;
  removePupil(sessionId: string, hostUserId: string, groupId: string, pupilId: string): Promise<boolean>;
  listGroups(sessionId: string): Promise<readonly SessionGroup[]>;

  // Live Quiz Operations (BAREA-007)
  getLiveSessionState(sessionId: string): Promise<LiveSessionState | null>;
  getPublishedQuizSnapshot(snapshotId: string): Promise<PublishedQuizSnapshot | null>;
  startLiveSession(sessionId: string, hostUserId: string, question1: SnapshotQuestion): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  openQuestion(sessionId: string, hostUserId: string, question: SnapshotQuestion, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  previewQuestion(sessionId: string, hostUserId: string, question: SnapshotQuestion, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  lockQuestion(sessionId: string, hostUserId: string, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  advanceQuestion(sessionId: string, hostUserId: string, nextQuestion: SnapshotQuestion | null, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  completeLiveSession(sessionId: string, hostUserId: string, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }>;
  recordAnswerSubmission(submission: {
    sessionId: string;
    questionPosition: number;
    questionId: string;
    participantId?: string | null;
    userId?: string | null;
    sessionGroupId?: string | null;
    sessionGroupPupilId?: string | null;
    selectedOptionIndices: readonly number[];
    submittedAt?: string;
    clientTimestamp?: string;
    isWithinDeadline?: boolean;
  }): Promise<ParticipantSubmission>;
  getCurrentTimeMs?(): number;
  setClockForTesting?(clock: (() => number) | null): void;
  getParticipantSubmission(sessionId: string, questionPosition: number, participantIdOrUserId: string): Promise<ParticipantSubmission | null>;
  getGroupSubmission(sessionId: string, questionPosition: number, groupId: string): Promise<ParticipantSubmission | null>;
  getSubmissionCountForQuestion(sessionId: string, questionPosition: number): Promise<number>;

  transaction<T>(action: () => T): T;
  close(): void;
}

export interface SessionRow {
  id: string;
  tenant_type: string;
  organization_id: string;
  published_quiz_snapshot_id: string;
  host_user_id: string;
  room_code: string;
  participation_mode: string;
  admission_policy: string;
  status: string;
  scheduled_start_at: string | null;
  is_locked: number;
  state_version: number;
  max_participants: number;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  user_id: string;
  provider_type: string;
  provider_sub: string;
  verified_email: string | null;
  verified_phone: string | null;
  display_name: string;
  joined_at: string;
  last_active_at: string;
  token_hash: string;
}

export interface GroupRow {
  id: string;
  session_id: string;
  group_name: string;
  sort_order: number;
  created_at: string;
}

export interface PupilRow {
  id: string;
  session_group_id: string;
  session_id: string;
  pupil_name: string;
  assigned_at: string;
}

export interface InvitationRow {
  id: string;
  session_id: string;
  invitation_type: string;
  normalized_identifier: string;
  invited_at: string;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
}

export class SqliteSessionRepository implements SessionRepository {
  private db: DatabaseSync;
  private ownsDb: boolean;
  private testClock: (() => number) | null = null;

  constructor(dbOrPath: DatabaseSync | string = ':memory:', clock?: () => number) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsDb = true;
    } else {
      this.db = dbOrPath;
      this.ownsDb = false;
    }
    if (clock) {
      this.setClockForTesting(clock);
    }
    this.init();
  }

  setClockForTesting(clock: (() => number) | null): void {
    if (process.env.NODE_ENV === 'production' || (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development')) {
      throw new Error('Forbidden: test clock overrides cannot be executed in production or unauthorized environments.');
    }
    this.testClock = clock;
  }

  getCurrentTimeMs(): number {
    if (this.testClock !== null) {
      if (process.env.NODE_ENV === 'production' || (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development')) {
        throw new Error('Forbidden: test clock overrides are disabled in production.');
      }
      return this.testClock();
    }
    return Date.now();
  }

  getDatabase(): DatabaseSync {
    return this.db;
  }

  init(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id TEXT PRIMARY KEY,
        tenant_type TEXT NOT NULL CHECK(tenant_type IN ('ORGANIZATION', 'PERSONAL')),
        organization_id TEXT NOT NULL,
        published_quiz_snapshot_id TEXT NOT NULL,
        host_user_id TEXT NOT NULL,
        room_code TEXT NOT NULL,
        participation_mode TEXT NOT NULL CHECK(participation_mode IN ('TEACHER_GROUP', 'INDIVIDUAL_AUTHENTICATED')),
        admission_policy TEXT NOT NULL CHECK(admission_policy IN ('TEACHER_ASSIGNED', 'OPEN', 'RESTRICTED')),
        status TEXT NOT NULL CHECK(status IN ('LOBBY', 'ACTIVE', 'COMPLETED', 'CLOSED')),
        scheduled_start_at TEXT CHECK(scheduled_start_at IS NULL OR ((length(scheduled_start_at) = 20 OR length(scheduled_start_at) = 24) AND scheduled_start_at LIKE '%Z')),
        is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
        state_version INTEGER NOT NULL DEFAULT 1 CHECK(state_version >= 1),
        max_participants INTEGER NOT NULL DEFAULT 100 CHECK(max_participants BETWEEN 1 AND 1000),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        closed_at TEXT,
        FOREIGN KEY (published_quiz_snapshot_id) REFERENCES published_quiz_snapshots(id) ON DELETE RESTRICT,
        CONSTRAINT chk_mode_admission_compatibility CHECK (
          (participation_mode = 'TEACHER_GROUP' AND admission_policy = 'TEACHER_ASSIGNED') OR
          (participation_mode = 'INDIVIDUAL_AUTHENTICATED' AND admission_policy IN ('OPEN', 'RESTRICTED'))
        ),
        CONSTRAINT chk_closed_consistency CHECK (
          (status IN ('LOBBY', 'ACTIVE') AND closed_at IS NULL) OR
          (status IN ('COMPLETED', 'CLOSED') AND closed_at IS NOT NULL)
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_room_code
      ON quiz_sessions(room_code)
      WHERE status IN ('LOBBY', 'ACTIVE');

      CREATE INDEX IF NOT EXISTS idx_sessions_organization
      ON quiz_sessions(organization_id, status);

      CREATE INDEX IF NOT EXISTS idx_sessions_host
      ON quiz_sessions(host_user_id, status);

      CREATE TRIGGER IF NOT EXISTS trg_enforce_session_snapshot_tenant_insert
      BEFORE INSERT ON quiz_sessions
      FOR EACH ROW
      BEGIN
        SELECT RAISE(ABORT, 'Tenant mismatch: referenced snapshot does not belong to session organization/tenant')
        WHERE NOT EXISTS (
          SELECT 1 
          FROM published_quiz_snapshots pqs
          WHERE pqs.id = NEW.published_quiz_snapshot_id 
            AND pqs.organization_id = NEW.organization_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_prevent_session_tenant_mutation
      BEFORE UPDATE OF organization_id, published_quiz_snapshot_id ON quiz_sessions
      FOR EACH ROW
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Session tenant and snapshot binding are immutable and cannot be updated');
      END;

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

      CREATE TABLE IF NOT EXISTS session_live_states (
        session_id TEXT PRIMARY KEY,
        current_question_position INTEGER NOT NULL DEFAULT 0,
        current_question_id TEXT,
        question_state TEXT NOT NULL CHECK(question_state IN ('NOT_STARTED', 'PREVIEW', 'ANSWERING', 'LOCKED', 'COMPLETED')),
        question_opened_at TEXT,
        answer_deadline_at TEXT,
        time_limit_seconds INTEGER,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS session_answers (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_position INTEGER NOT NULL,
        question_id TEXT NOT NULL,
        participant_id TEXT,
        user_id TEXT,
        session_group_id TEXT,
        session_group_pupil_id TEXT,
        selected_option_indices TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        client_submitted_at TEXT,
        is_within_deadline INTEGER NOT NULL CHECK(is_within_deadline IN (0, 1)),
        FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (participant_id) REFERENCES session_participants(id) ON DELETE CASCADE,
        FOREIGN KEY (session_group_id) REFERENCES session_groups(id) ON DELETE CASCADE,
        CONSTRAINT uq_session_question_user UNIQUE (session_id, question_position, user_id),
        CONSTRAINT uq_session_question_group UNIQUE (session_id, question_position, session_group_id)
      );

      CREATE INDEX IF NOT EXISTS idx_answers_session_pos
      ON session_answers(session_id, question_position);
    `);
  }

  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = action();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  async createSession(payload: CreateSessionPayload): Promise<QuizSession> {
    assertValidModeAdmissionCompatibility(payload.participationMode, payload.admissionPolicy);

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
    const sessionId = 'ses_' + crypto.randomUUID();

    let scheduledStartIso: string | null = null;
    if (payload.scheduledStartAt) {
      scheduledStartIso = validateScheduledStartTime(payload.scheduledStartAt, now.getTime(), new Date(expiresAt).getTime());
    }

    const roomCode = this.generateUniqueRoomCode();
    const maxParticipants = payload.maxParticipants ?? 100;

    return this.transaction(() => {
      // Validate snapshot existence and tenant matching in BAREA-005 table
      const snapshotStmt = this.db.prepare(
        'SELECT id, organization_id, title FROM published_quiz_snapshots WHERE id = ?'
      );
      const snapshot = snapshotStmt.get(payload.publishedQuizSnapshotId) as unknown as { id: string; organization_id: string; title: string } | undefined;

      if (!snapshot) {
        throw new CrossTenantSnapshotError('Quiz snapshot does not exist.');
      }
      if (snapshot.organization_id !== payload.organizationId) {
        throw new CrossTenantSnapshotError('Quiz snapshot does not belong to authorized organization/tenant.');
      }

      const insertSessionStmt = this.db.prepare(`
        INSERT INTO quiz_sessions (
          id, tenant_type, organization_id, published_quiz_snapshot_id, host_user_id,
          room_code, participation_mode, admission_policy, status, scheduled_start_at,
          is_locked, state_version, max_participants, created_at, expires_at, closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'LOBBY', ?, 0, 1, ?, ?, ?, NULL)
      `);

      insertSessionStmt.run(
        sessionId,
        payload.workspaceType,
        payload.organizationId,
        payload.publishedQuizSnapshotId,
        payload.hostUserId,
        roomCode,
        payload.participationMode,
        payload.admissionPolicy,
        scheduledStartIso,
        maxParticipants,
        nowIso,
        expiresAt
      );

      this.db.prepare(`
        INSERT INTO session_live_states (
          session_id, current_question_position, current_question_id,
          question_state, question_opened_at, answer_deadline_at,
          time_limit_seconds, updated_at
        ) VALUES (?, 0, NULL, 'NOT_STARTED', NULL, NULL, NULL, ?)
      `).run(sessionId, nowIso);

      if (payload.invitations && payload.invitations.length > 0) {
        const insertInvStmt = this.db.prepare(`
          INSERT INTO session_invitations (
            id, session_id, invitation_type, normalized_identifier, invited_at, claimed_by_user_id, claimed_at
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL)
        `);

        for (const inv of payload.invitations) {
          const invId = 'inv_' + crypto.randomUUID();
          const normalized = inv.type === 'EMAIL'
            ? normalizeAllowlistEmail(inv.identifier)
            : normalizeAllowlistPhone(inv.identifier);

          insertInvStmt.run(invId, sessionId, inv.type, normalized, nowIso);
        }
      }

      const created = this._findSessionByIdSync(sessionId);
      if (!created) {
        throw new Error('Failed to retrieve newly created session.');
      }
      return created;
    });
  }

  private _findSessionByIdSync(sessionId: string): QuizSession | null {
    const stmt = this.db.prepare('SELECT * FROM quiz_sessions WHERE id = ?');
    const row = stmt.get(sessionId) as unknown as SessionRow | undefined;
    return row ? this.mapSessionRow(row) : null;
  }

  async findSessionById(sessionId: string): Promise<QuizSession | null> {
    return this._findSessionByIdSync(sessionId);
  }

  private _findSessionByRoomCodeSync(roomCode: RoomCode): QuizSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM quiz_sessions 
      WHERE room_code = ? AND status IN ('LOBBY', 'ACTIVE')
    `);
    const row = stmt.get(roomCode) as unknown as SessionRow | undefined;
    if (!row) return null;
    const session = this.mapSessionRow(row);
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    return session;
  }

  async findSessionByRoomCode(roomCode: RoomCode): Promise<QuizSession | null> {
    return this._findSessionByRoomCodeSync(roomCode);
  }

  async getPublicInfo(roomCode: RoomCode): Promise<SessionPublicInfo> {
    const session = this._findSessionByRoomCodeSync(roomCode);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const snapshotStmt = this.db.prepare(`
      SELECT title, default_time_limit_seconds, snapshot_json
      FROM published_quiz_snapshots
      WHERE id = ?
    `);
    const snapshotRow = snapshotStmt.get(session.publishedQuizSnapshotId) as {
      title: string;
      default_time_limit_seconds: number;
      snapshot_json: string;
    } | undefined;

    let totalQuestions = 0;
    if (snapshotRow) {
      try {
        const parsed = JSON.parse(snapshotRow.snapshot_json) as { questions?: unknown[] };
        totalQuestions = Array.isArray(parsed.questions) ? parsed.questions.length : 0;
      } catch {
        totalQuestions = 0;
      }
    }

    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM session_participants WHERE session_id = ?');
    const countRow = countStmt.get(session.id) as unknown as { count: number };

    return {
      sessionId: session.id,
      roomCode: session.roomCode,
      quizTitle: snapshotRow ? snapshotRow.title : 'Bible Quiz',
      workspaceName: session.workspaceType === WorkspaceType.PERSONAL ? 'Personal Study' : undefined,
      participationMode: session.participationMode,
      admissionPolicy: session.admissionPolicy,
      sessionStatus: session.status,
      scheduledStartAt: session.scheduledStartAt,
      isLocked: session.isLocked,
      totalQuestions,
      defaultTimeLimitSeconds: snapshotRow ? snapshotRow.default_time_limit_seconds : 30,
      participantCount: countRow.count
    };
  }

  async lockSession(sessionId: string, hostUserId: string, locked: boolean): Promise<QuizSession> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can lock session.');
      if (session.status === SessionStatus.CLOSED || session.status === SessionStatus.COMPLETED) {
        throw new SessionClosedError();
      }

      this.db.prepare('UPDATE quiz_sessions SET is_locked = ?, state_version = state_version + 1 WHERE id = ?').run(
        locked ? 1 : 0,
        sessionId
      );
      return this._findSessionByIdSync(sessionId)!;
    });
  }

  async closeSession(sessionId: string, hostUserId: string): Promise<QuizSession> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can close session.');

      const nowIso = new Date().toISOString();
      this.db.prepare(`
        UPDATE quiz_sessions 
        SET status = 'CLOSED', closed_at = ?, state_version = state_version + 1 
        WHERE id = ?
      `).run(nowIso, sessionId);

      return this._findSessionByIdSync(sessionId)!;
    });
  }

  async joinSession(
    sessionId: string,
    participant: {
      userId: string;
      providerType: string;
      providerSub: string;
      verifiedEmail: string | null;
      verifiedPhone: string | null;
      displayName: string;
    }
  ): Promise<{ participant: AuthenticatedParticipant; token: ParticipantToken }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);

      if (session.status !== SessionStatus.LOBBY && session.status !== SessionStatus.ACTIVE) {
        throw new SessionClosedError();
      }
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        throw new SessionClosedError();
      }
      if (session.isLocked) {
        throw new SessionLockedError();
      }
      if (session.participationMode === ParticipationMode.TEACHER_GROUP) {
        throw new SessionAccessDeniedError('Direct individual join is not supported in teacher group mode.');
      }
      if (session.hostUserId === participant.userId) {
        throw new HostCannotParticipateInOwnSessionError();
      }

      // Check capacity
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM session_participants WHERE session_id = ?');
      const countRow = countStmt.get(sessionId) as unknown as { count: number };
      if (countRow.count >= session.maxParticipants) {
        throw new SessionFullError(session.maxParticipants);
      }

      // Evaluate admission policy
      if (session.admissionPolicy === AdmissionPolicy.RESTRICTED) {
        let admitted = false;
        let matchedInvId: string | null = null;

        if (participant.verifiedEmail) {
          const normEmail = normalizeAllowlistEmail(participant.verifiedEmail);
          const invStmt = this.db.prepare(`
            SELECT id FROM session_invitations 
            WHERE session_id = ? AND invitation_type = 'EMAIL' AND normalized_identifier = ?
          `);
          const inv = invStmt.get(sessionId, normEmail) as unknown as { id: string } | undefined;
          if (inv) {
            admitted = true;
            matchedInvId = inv.id;
          }
        }

        if (!admitted && participant.verifiedPhone) {
          const normPhone = normalizeAllowlistPhone(participant.verifiedPhone);
          const invStmt = this.db.prepare(`
            SELECT id FROM session_invitations 
            WHERE session_id = ? AND invitation_type = 'PHONE' AND normalized_identifier = ?
          `);
          const inv = invStmt.get(sessionId, normPhone) as unknown as { id: string } | undefined;
          if (inv) {
            admitted = true;
            matchedInvId = inv.id;
          }
        }

        if (!admitted) {
          // Generic 404 to prevent enumeration
          throw new SessionNotFoundError(sessionId);
        }

        if (matchedInvId) {
          this.db.prepare(`
            UPDATE session_invitations 
            SET claimed_by_user_id = ?, claimed_at = ? 
            WHERE id = ? AND claimed_by_user_id IS NULL
          `).run(participant.userId, new Date().toISOString(), matchedInvId);
        }
      }

      // Check if user is already joined
      const existingStmt = this.db.prepare(`
        SELECT * FROM session_participants 
        WHERE session_id = ? AND (user_id = ? OR (provider_type = ? AND provider_sub = ?))
      `);
      const existing = existingStmt.get(
        sessionId,
        participant.userId,
        participant.providerType,
        participant.providerSub
      ) as unknown as unknown as ParticipantRow | undefined;

      const rawToken = 'ptok_' + crypto.randomBytes(32).toString('base64url');
      const token = validateParticipantToken(rawToken);
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const nowIso = new Date().toISOString();

      if (existing) {
        // Rehydrate existing participant with fresh token
        this.db.prepare(`
          UPDATE session_participants 
          SET token_hash = ?, last_active_at = ? 
          WHERE id = ?
        `).run(tokenHash, nowIso, existing.id);

        const updated = this.db.prepare('SELECT * FROM session_participants WHERE id = ?').get(existing.id) as unknown as ParticipantRow;
        return {
          participant: this.mapParticipantRow(updated),
          token
        };
      }

      const participantId = 'pt_' + crypto.randomUUID();
      const insertStmt = this.db.prepare(`
        INSERT INTO session_participants (
          id, session_id, user_id, provider_type, provider_sub,
          verified_email, verified_phone, display_name, joined_at, last_active_at, token_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        participantId,
        sessionId,
        participant.userId,
        participant.providerType,
        participant.providerSub,
        participant.verifiedEmail,
        participant.verifiedPhone,
        participant.displayName,
        nowIso,
        nowIso,
        tokenHash
      );

      const inserted = this.db.prepare('SELECT * FROM session_participants WHERE id = ?').get(participantId) as unknown as ParticipantRow;
      return {
        participant: this.mapParticipantRow(inserted),
        token
      };
    });
  }

  async resumeSession(sessionId: string, token: ParticipantToken): Promise<{ participant: AuthenticatedParticipant; session: QuizSession }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stmt = this.db.prepare(`
      SELECT * FROM session_participants 
      WHERE session_id = ? AND token_hash = ?
    `);
    const row = stmt.get(sessionId, tokenHash) as unknown as unknown as ParticipantRow | undefined;
    if (!row) {
      throw new InvalidParticipantTokenError();
    }

    const session = this._findSessionByIdSync(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);

    if (session.status === SessionStatus.CLOSED || session.status === SessionStatus.COMPLETED) {
      throw new SessionClosedError();
    }
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new SessionClosedError();
    }

    // Update last_active_at
    const nowIso = new Date().toISOString();
    this.db.prepare('UPDATE session_participants SET last_active_at = ? WHERE id = ?').run(nowIso, row.id);

    const refreshed = this.db.prepare('SELECT * FROM session_participants WHERE id = ?').get(row.id) as unknown as ParticipantRow;

    return {
      participant: this.mapParticipantRow(refreshed),
      session
    };
  }

  async listParticipants(sessionId: string): Promise<readonly AuthenticatedParticipant[]> {
    const stmt = this.db.prepare('SELECT * FROM session_participants WHERE session_id = ? ORDER BY joined_at ASC');
    const rows = stmt.all(sessionId) as unknown as unknown as ParticipantRow[];
    return rows.map(r => this.mapParticipantRow(r));
  }

  async createGroup(sessionId: string, hostUserId: string, groupName: string): Promise<SessionGroup> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can create groups.');
      if (session.participationMode !== ParticipationMode.TEACHER_GROUP) {
        throw new Error('Groups can only be created in teacher group mode.');
      }

      const groupId = 'grp_' + crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM session_groups WHERE session_id = ?');
      const countRow = countStmt.get(sessionId) as unknown as { count: number };

      this.db.prepare(`
        INSERT INTO session_groups (id, session_id, group_name, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(groupId, sessionId, groupName.trim(), countRow.count, nowIso);

      return {
        id: groupId,
        sessionId,
        groupName: groupName.trim(),
        sortOrder: countRow.count,
        createdAt: nowIso,
        pupils: []
      };
    });
  }

  async deleteGroup(sessionId: string, hostUserId: string, groupId: string): Promise<boolean> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can delete groups.');

      const res = this.db.prepare('DELETE FROM session_groups WHERE id = ? AND session_id = ?').run(groupId, sessionId);
      return res.changes > 0;
    });
  }

  async assignPupil(sessionId: string, hostUserId: string, groupId: string, pupilName: string): Promise<SessionGroupPupil> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can assign pupils.');

      const group = this.db.prepare('SELECT id FROM session_groups WHERE id = ? AND session_id = ?').get(groupId, sessionId);
      if (!group) throw new Error('Group not found in this session.');

      const pupilId = 'pup_' + crypto.randomUUID();
      const nowIso = new Date().toISOString();

      this.db.prepare(`
        INSERT INTO session_group_pupils (id, session_group_id, session_id, pupil_name, assigned_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(pupilId, groupId, sessionId, pupilName.trim(), nowIso);

      return {
        id: pupilId,
        sessionGroupId: groupId,
        sessionId,
        pupilName: pupilName.trim(),
        assignedAt: nowIso
      };
    });
  }

  async removePupil(sessionId: string, hostUserId: string, groupId: string, pupilId: string): Promise<boolean> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new SessionAccessDeniedError('Only host can remove pupils.');

      const res = this.db.prepare(`
        DELETE FROM session_group_pupils 
        WHERE id = ? AND session_group_id = ? AND session_id = ?
      `).run(pupilId, groupId, sessionId);

      return res.changes > 0;
    });
  }

  async listGroups(sessionId: string): Promise<readonly SessionGroup[]> {
    const groupStmt = this.db.prepare('SELECT * FROM session_groups WHERE session_id = ? ORDER BY sort_order ASC');
    const groupRows = groupStmt.all(sessionId) as unknown as GroupRow[];

    const pupilStmt = this.db.prepare('SELECT * FROM session_group_pupils WHERE session_id = ? ORDER BY assigned_at ASC');
    const pupilRows = pupilStmt.all(sessionId) as unknown as PupilRow[];

    const pupilsByGroup = new Map<string, SessionGroupPupil[]>();
    for (const p of pupilRows) {
      const list = pupilsByGroup.get(p.session_group_id) || [];
      list.push({
        id: p.id,
        sessionGroupId: p.session_group_id,
        sessionId: p.session_id,
        pupilName: p.pupil_name,
        assignedAt: p.assigned_at
      });
      pupilsByGroup.set(p.session_group_id, list);
    }

    return groupRows.map(g => ({
      id: g.id,
      sessionId: g.session_id,
      groupName: g.group_name,
      sortOrder: g.sort_order,
      createdAt: g.created_at,
      pupils: pupilsByGroup.get(g.id) || []
    }));
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }

  private generateUniqueRoomCode(): RoomCode {
    const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const checkStmt = this.db.prepare(`
      SELECT 1 FROM quiz_sessions WHERE room_code = ? AND status IN ('LOBBY', 'ACTIVE')
    `);

    for (let attempts = 0; attempts < 100; attempts++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
      }
      const validated = normalizeAndValidateRoomCode(code);
      const collision = checkStmt.get(validated);
      if (!collision) {
        return validated;
      }
    }
    throw new Error('Exhausted room code generator attempts without collision resolution.');
  }

  private mapSessionRow(row: SessionRow): QuizSession {
    const base = {
      id: row.id,
      workspaceType: row.tenant_type as WorkspaceType,
      organizationId: row.organization_id,
      workspaceId: row.organization_id,
      publishedQuizSnapshotId: row.published_quiz_snapshot_id,
      hostUserId: row.host_user_id,
      roomCode: normalizeAndValidateRoomCode(row.room_code),
      participationMode: row.participation_mode as ParticipationMode,
      admissionPolicy: row.admission_policy as AdmissionPolicy,
      scheduledStartAt: row.scheduled_start_at,
      isLocked: row.is_locked === 1,
      stateVersion: row.state_version,
      maxParticipants: row.max_participants,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };

    if (row.status === 'LOBBY' || row.status === 'ACTIVE') {
      return {
        ...base,
        status: row.status as 'LOBBY' | 'ACTIVE',
        closedAt: null
      };
    } else {
      return {
        ...base,
        status: row.status as 'COMPLETED' | 'CLOSED',
        closedAt: row.closed_at || row.expires_at
      };
    }
  }

  private mapParticipantRow(row: ParticipantRow): AuthenticatedParticipant {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerSub: row.provider_sub,
      verifiedEmail: row.verified_email,
      verifiedPhone: row.verified_phone,
      displayName: row.display_name,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at
    };
  }

  // --- BAREA-007 Live Quiz Operations ---

  private _getLiveSessionStateSync(sessionId: string): LiveSessionState | null {
    const session = this._findSessionByIdSync(sessionId);
    if (!session) return null;

    const snapshot = this._getPublishedQuizSnapshotSync(session.publishedQuizSnapshotId);
    const totalQuestions = snapshot ? snapshot.questions.length : 0;

    const row = this.db.prepare(
      'SELECT * FROM session_live_states WHERE session_id = ?'
    ).get(sessionId) as unknown as {
      session_id: string;
      current_question_position: number;
      current_question_id: string | null;
      question_state: string;
      question_opened_at: string | null;
      answer_deadline_at: string | null;
      time_limit_seconds: number | null;
      updated_at: string;
    } | undefined;

    const now = new Date().toISOString();

    if (!row) {
      return {
        sessionId: session.id,
        organizationId: session.organizationId,
        hostUserId: session.hostUserId,
        sessionStatus: session.status,
        participationMode: session.participationMode,
        stateVersion: session.stateVersion,
        totalQuestions,
        currentQuestionPosition: 0,
        currentQuestionId: null,
        questionLifecycleState: QuestionLifecycleState.NOT_STARTED,
        questionOpenedAt: null,
        answerDeadlineAt: null,
        timeLimitSeconds: null,
        serverTime: now,
        isLocked: session.isLocked
      };
    }

    return {
      sessionId: session.id,
      organizationId: session.organizationId,
      hostUserId: session.hostUserId,
      sessionStatus: session.status,
      participationMode: session.participationMode,
      stateVersion: session.stateVersion,
      totalQuestions,
      currentQuestionPosition: row.current_question_position,
      currentQuestionId: row.current_question_id,
      questionLifecycleState: row.question_state as QuestionLifecycleState,
      questionOpenedAt: row.question_opened_at,
      answerDeadlineAt: row.answer_deadline_at,
      timeLimitSeconds: row.time_limit_seconds,
      serverTime: now,
      isLocked: session.isLocked
    };
  }

  async getLiveSessionState(sessionId: string): Promise<LiveSessionState | null> {
    return this._getLiveSessionStateSync(sessionId);
  }

  private _getPublishedQuizSnapshotSync(snapshotId: string): PublishedQuizSnapshot | null {
    const row = this.db.prepare(
      'SELECT id, quiz_id, organization_id, title, description, default_time_limit_seconds, scoring_style, option_shuffle, version_number, snapshot_json, published_at, published_by_user_id FROM published_quiz_snapshots WHERE id = ?'
    ).get(snapshotId) as unknown as {
      id: string;
      quiz_id: string;
      organization_id: string;
      title: string;
      description: string | null;
      default_time_limit_seconds: number;
      scoring_style: string;
      option_shuffle: number;
      version_number: number;
      snapshot_json: string;
      published_at: string;
      published_by_user_id: string;
    } | undefined;

    if (!row) return null;

    let parsedQuestions: SnapshotQuestion[] = [];
    try {
      const parsed = JSON.parse(row.snapshot_json);
      if (Array.isArray(parsed.questions)) {
        parsedQuestions = parsed.questions;
      }
    } catch {
      parsedQuestions = [];
    }

    return {
      id: row.id,
      quizId: row.quiz_id,
      organizationId: row.organization_id,
      title: row.title,
      description: row.description,
      defaultTimeLimitSeconds: row.default_time_limit_seconds,
      scoringStyle: row.scoring_style as any,
      optionShuffle: row.option_shuffle === 1,
      versionNumber: row.version_number,
      publishedAt: row.published_at,
      publishedByUserId: row.published_by_user_id,
      questions: parsedQuestions
    };
  }

  async getPublishedQuizSnapshot(snapshotId: string): Promise<PublishedQuizSnapshot | null> {
    return this._getPublishedQuizSnapshotSync(snapshotId);
  }

  async startLiveSession(sessionId: string, hostUserId: string, question1: SnapshotQuestion): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.LOBBY) {
        throw new InvalidLiveStateTransitionError(`Cannot start session from status '${session.status}'. Session must be in LOBBY.`);
      }
      if (session.isLocked) throw new SessionLockedError();
      const nowMs = Date.now();
      if (nowMs > new Date(session.expiresAt).getTime()) throw new SessionClosedError();

      const timeLimitSeconds = question1.timeLimitSeconds > 0 ? question1.timeLimitSeconds : 30;
      const nowIso = new Date(nowMs).toISOString();
      const deadlineIso = new Date(nowMs + timeLimitSeconds * 1000).toISOString();

      this.db.prepare(`
        UPDATE quiz_sessions
        SET status = 'ACTIVE', state_version = state_version + 1
        WHERE id = ?
      `).run(sessionId);

      this.db.prepare(`
        INSERT INTO session_live_states (
          session_id, current_question_position, current_question_id,
          question_state, question_opened_at, answer_deadline_at,
          time_limit_seconds, updated_at
        ) VALUES (?, 1, ?, 'ANSWERING', ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          current_question_position = 1,
          current_question_id = excluded.current_question_id,
          question_state = 'ANSWERING',
          question_opened_at = excluded.question_opened_at,
          answer_deadline_at = excluded.answer_deadline_at,
          time_limit_seconds = excluded.time_limit_seconds,
          updated_at = excluded.updated_at
      `).run(sessionId, question1.id, nowIso, deadlineIso, timeLimitSeconds, nowIso);

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async openQuestion(sessionId: string, hostUserId: string, question: SnapshotQuestion, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();
      if (expectedVersion !== undefined && session.stateVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(`Expected state version ${expectedVersion} does not match current ${session.stateVersion}.`);
      }

      const timeLimitSeconds = question.timeLimitSeconds > 0 ? question.timeLimitSeconds : 30;
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const deadlineIso = new Date(nowMs + timeLimitSeconds * 1000).toISOString();

      this.db.prepare(`
        UPDATE quiz_sessions
        SET state_version = state_version + 1
        WHERE id = ?
      `).run(sessionId);

      this.db.prepare(`
        UPDATE session_live_states
        SET current_question_position = ?,
            current_question_id = ?,
            question_state = 'ANSWERING',
            question_opened_at = ?,
            answer_deadline_at = ?,
            time_limit_seconds = ?,
            updated_at = ?
        WHERE session_id = ?
      `).run(question.position, question.id, nowIso, deadlineIso, timeLimitSeconds, nowIso, sessionId);

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async previewQuestion(sessionId: string, hostUserId: string, question: SnapshotQuestion, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();
      if (expectedVersion !== undefined && session.stateVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(`Expected state version ${expectedVersion} does not match current ${session.stateVersion}.`);
      }

      const nowIso = new Date().toISOString();

      this.db.prepare(`
        UPDATE quiz_sessions
        SET state_version = state_version + 1
        WHERE id = ?
      `).run(sessionId);

      this.db.prepare(`
        UPDATE session_live_states
        SET current_question_position = ?,
            current_question_id = ?,
            question_state = 'PREVIEW',
            question_opened_at = NULL,
            answer_deadline_at = NULL,
            time_limit_seconds = ?,
            updated_at = ?
        WHERE session_id = ?
      `).run(question.position, question.id, question.timeLimitSeconds, nowIso, sessionId);

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async lockQuestion(sessionId: string, hostUserId: string, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();
      if (expectedVersion !== undefined && session.stateVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(`Expected state version ${expectedVersion} does not match current ${session.stateVersion}.`);
      }

      const liveRow = this.db.prepare(
        'SELECT * FROM session_live_states WHERE session_id = ?'
      ).get(sessionId) as any;

      if (!liveRow || liveRow.question_state !== 'ANSWERING') {
        throw new InvalidLiveStateTransitionError(`Cannot lock question from state '${liveRow ? liveRow.question_state : 'UNKNOWN'}'. Must be in ANSWERING.`);
      }

      const nowIso = new Date().toISOString();

      this.db.prepare(`
        UPDATE quiz_sessions
        SET state_version = state_version + 1
        WHERE id = ?
      `).run(sessionId);

      this.db.prepare(`
        UPDATE session_live_states
        SET question_state = 'LOCKED',
            updated_at = ?
        WHERE session_id = ?
      `).run(nowIso, sessionId);

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async advanceQuestion(sessionId: string, hostUserId: string, nextQuestion: SnapshotQuestion | null, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();
      if (expectedVersion !== undefined && session.stateVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(`Expected state version ${expectedVersion} does not match current ${session.stateVersion}.`);
      }

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      if (nextQuestion !== null) {
        const timeLimitSeconds = nextQuestion.timeLimitSeconds > 0 ? nextQuestion.timeLimitSeconds : 30;
        const deadlineIso = new Date(nowMs + timeLimitSeconds * 1000).toISOString();

        this.db.prepare(`
          UPDATE quiz_sessions
          SET state_version = state_version + 1
          WHERE id = ?
        `).run(sessionId);

        this.db.prepare(`
          UPDATE session_live_states
          SET current_question_position = ?,
              current_question_id = ?,
              question_state = 'ANSWERING',
              question_opened_at = ?,
              answer_deadline_at = ?,
              time_limit_seconds = ?,
              updated_at = ?
          WHERE session_id = ?
        `).run(nextQuestion.position, nextQuestion.id, nowIso, deadlineIso, timeLimitSeconds, nowIso, sessionId);
      } else {
        // Quiz completed
        this.db.prepare(`
          UPDATE quiz_sessions
          SET status = 'COMPLETED', closed_at = ?, state_version = state_version + 1
          WHERE id = ?
        `).run(nowIso, sessionId);

        this.db.prepare(`
          UPDATE session_live_states
          SET question_state = 'COMPLETED',
              updated_at = ?
          WHERE session_id = ?
        `).run(nowIso, sessionId);
      }

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async completeLiveSession(sessionId: string, hostUserId: string, expectedVersion?: number): Promise<{ session: QuizSession; liveState: LiveSessionState }> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(sessionId);
      if (!session) throw new SessionNotFoundError(sessionId);
      if (session.hostUserId !== hostUserId) throw new NotSessionHostError();
      if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.LOBBY) {
        throw new InvalidLiveStateTransitionError(`Cannot complete session from status '${session.status}'.`);
      }
      if (expectedVersion !== undefined && session.stateVersion !== expectedVersion) {
        throw new ConcurrencyConflictError(`Expected state version ${expectedVersion} does not match current ${session.stateVersion}.`);
      }

      const nowIso = new Date().toISOString();

      this.db.prepare(`
        UPDATE quiz_sessions
        SET status = 'COMPLETED', closed_at = ?, state_version = state_version + 1
        WHERE id = ?
      `).run(nowIso, sessionId);

      this.db.prepare(`
        UPDATE session_live_states
        SET question_state = 'COMPLETED',
            updated_at = ?
        WHERE session_id = ?
      `).run(nowIso, sessionId);

      const updatedSession = this._findSessionByIdSync(sessionId)!;
      const liveState = this._getLiveSessionStateSync(sessionId)!;
      return { session: updatedSession, liveState };
    });
  }

  async recordAnswerSubmission(submission: {
    sessionId: string;
    questionPosition: number;
    questionId: string;
    participantId?: string | null;
    userId?: string | null;
    sessionGroupId?: string | null;
    sessionGroupPupilId?: string | null;
    selectedOptionIndices: readonly number[];
    submittedAt?: string;
    clientTimestamp?: string;
    isWithinDeadline?: boolean;
  }): Promise<ParticipantSubmission> {
    return this.transaction(() => {
      const session = this._findSessionByIdSync(submission.sessionId);
      if (!session) throw new SessionNotFoundError(submission.sessionId);
      if (session.status !== SessionStatus.ACTIVE) throw new SessionNotActiveError();
      if (session.isLocked) throw new SessionLockedError();

      const liveRow = this.db.prepare(
        'SELECT * FROM session_live_states WHERE session_id = ?'
      ).get(submission.sessionId) as any;

      if (!liveRow || liveRow.question_state !== 'ANSWERING') {
        throw new InvalidLiveStateTransitionError('Answer window is not currently open.');
      }

      if (liveRow.current_question_position !== submission.questionPosition) {
        throw new InvalidLiveStateTransitionError(`Question position mismatch: live question is at position ${liveRow.current_question_position}, submission was for position ${submission.questionPosition}`);
      }

      if (!liveRow.answer_deadline_at) {
        throw new InvalidLiveStateTransitionError('No active answer deadline configured for current question.');
      }

      // Authoritative deadline check at persistence boundary using fresh server time
      const serverNowMs = this.getCurrentTimeMs();
      const deadlineMs = new Date(liveRow.answer_deadline_at).getTime();
      if (serverNowMs > deadlineMs) {
        throw new AnswerDeadlineExpiredError();
      }

      const authoritativeSubmittedAt = new Date(serverNowMs).toISOString();

      // Deterministic duplicate check (First accepted submission wins)
      if (submission.userId) {
        const existing = this.db.prepare(
          'SELECT id FROM session_answers WHERE session_id = ? AND question_position = ? AND user_id = ?'
        ).get(submission.sessionId, submission.questionPosition, submission.userId);
        if (existing) {
          throw new DuplicateAnswerSubmissionError();
        }
      } else if (submission.sessionGroupId) {
        const existing = this.db.prepare(
          'SELECT id FROM session_answers WHERE session_id = ? AND question_position = ? AND session_group_id = ?'
        ).get(submission.sessionId, submission.questionPosition, submission.sessionGroupId);
        if (existing) {
          throw new DuplicateAnswerSubmissionError();
        }
      }

      const id = 'ans_' + crypto.randomUUID();
      try {
        this.db.prepare(`
          INSERT INTO session_answers (
            id, session_id, question_position, question_id,
            participant_id, user_id, session_group_id, session_group_pupil_id,
            selected_option_indices, submitted_at, client_submitted_at, is_within_deadline
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          submission.sessionId,
          submission.questionPosition,
          submission.questionId,
          submission.participantId ?? null,
          submission.userId ?? null,
          submission.sessionGroupId ?? null,
          submission.sessionGroupPupilId ?? null,
          JSON.stringify(submission.selectedOptionIndices),
          authoritativeSubmittedAt,
          submission.clientTimestamp ?? null,
          1 // Accepted answers are authoritatively within deadline
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          throw new DuplicateAnswerSubmissionError();
        }
        throw err;
      }

      return {
        id,
        sessionId: submission.sessionId,
        questionPosition: submission.questionPosition,
        questionId: submission.questionId,
        participantId: submission.participantId ?? null,
        userId: submission.userId ?? null,
        sessionGroupId: submission.sessionGroupId ?? null,
        sessionGroupPupilId: submission.sessionGroupPupilId ?? null,
        selectedOptionIndices: submission.selectedOptionIndices,
        submittedAt: authoritativeSubmittedAt,
        clientTimestamp: submission.clientTimestamp,
        isWithinDeadline: true
      };
    });
  }

  async getParticipantSubmission(sessionId: string, questionPosition: number, participantIdOrUserId: string): Promise<ParticipantSubmission | null> {
    const row = this.db.prepare(`
      SELECT * FROM session_answers
      WHERE session_id = ? AND question_position = ? AND (user_id = ? OR participant_id = ?)
    `).get(sessionId, questionPosition, participantIdOrUserId, participantIdOrUserId) as any;

    if (!row) return null;

    let selectedIndices: number[] = [];
    try {
      selectedIndices = JSON.parse(row.selected_option_indices);
    } catch {
      selectedIndices = [];
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      questionPosition: row.question_position,
      questionId: row.question_id,
      participantId: row.participant_id,
      userId: row.user_id,
      sessionGroupId: row.session_group_id,
      sessionGroupPupilId: row.session_group_pupil_id,
      selectedOptionIndices: selectedIndices,
      submittedAt: row.submitted_at,
      clientTimestamp: row.client_submitted_at ?? undefined,
      isWithinDeadline: row.is_within_deadline === 1
    };
  }

  async getGroupSubmission(sessionId: string, questionPosition: number, groupId: string): Promise<ParticipantSubmission | null> {
    const row = this.db.prepare(`
      SELECT * FROM session_answers
      WHERE session_id = ? AND question_position = ? AND session_group_id = ?
    `).get(sessionId, questionPosition, groupId) as any;

    if (!row) return null;

    let selectedIndices: number[] = [];
    try {
      selectedIndices = JSON.parse(row.selected_option_indices);
    } catch {
      selectedIndices = [];
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      questionPosition: row.question_position,
      questionId: row.question_id,
      participantId: row.participant_id,
      userId: row.user_id,
      sessionGroupId: row.session_group_id,
      sessionGroupPupilId: row.session_group_pupil_id,
      selectedOptionIndices: selectedIndices,
      submittedAt: row.submitted_at,
      clientTimestamp: row.client_submitted_at ?? undefined,
      isWithinDeadline: row.is_within_deadline === 1
    };
  }

  async getSubmissionCountForQuestion(sessionId: string, questionPosition: number): Promise<number> {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM session_answers
      WHERE session_id = ? AND question_position = ?
    `).get(sessionId, questionPosition) as { count: number } | undefined;
    return row ? row.count : 0;
  }
}
