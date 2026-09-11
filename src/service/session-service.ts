import {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  SessionStatus,
  type QuizSession,
  type SessionPublicInfo,
  type AuthenticatedParticipant,
  type SessionGroup,
  type SessionGroupPupil
} from '../domain/session';
import {
  RoomCode,
  ParticipantToken,
  normalizeAndValidateRoomCode,
  derivePersonalTenantId,
  isPersonalTenantId
} from '../domain/value-objects';
import {
  SessionNotFoundError,
  SessionAccessDeniedError,
  CrossTenantSnapshotError,
  InvalidRoomCodeError
} from '../domain/domain-errors';
import type { SessionRepository, CreateSessionPayload } from '../persistence/sqlite-session-repository';
import type { RateLimiter } from './rate-limiter';

export interface CreateSessionServiceInput {
  readonly workspaceType: WorkspaceType;
  readonly organizationId: string;
  readonly publishedQuizSnapshotId: string;
  readonly hostUserId: string;
  readonly participationMode: ParticipationMode;
  readonly admissionPolicy: AdmissionPolicy;
  readonly scheduledStartAt?: string | null;
  readonly maxParticipants?: number;
  readonly invitations?: readonly { readonly type: 'EMAIL' | 'PHONE'; readonly identifier: string }[];
}

export class SessionService {
  private repo: SessionRepository;
  private rateLimiter?: RateLimiter;

  constructor(repo: SessionRepository, rateLimiter?: RateLimiter) {
    this.repo = repo;
    this.rateLimiter = rateLimiter;
  }

  createSession(input: CreateSessionServiceInput): QuizSession {
    // Determine authoritative tenant identity
    let authoritativeTenantId = input.organizationId;
    if (input.workspaceType === WorkspaceType.PERSONAL) {
      authoritativeTenantId = derivePersonalTenantId(input.hostUserId);
    }

    return this.repo.createSession({
      ...input,
      organizationId: authoritativeTenantId
    });
  }

  getSession(sessionId: string): QuizSession | null {
    return this.repo.findSessionById(sessionId);
  }

  getPublicInfo(rawRoomCode: string, clientIp?: string | null): SessionPublicInfo {
    if (this.rateLimiter) {
      this.rateLimiter.checkUnauthenticatedRequest(clientIp);
      this.rateLimiter.checkRoomLookup(clientIp);
    }

    let validatedCode: RoomCode;
    try {
      validatedCode = normalizeAndValidateRoomCode(rawRoomCode);
    } catch (err) {
      if (err instanceof InvalidRoomCodeError && this.rateLimiter && clientIp) {
        this.rateLimiter.recordFailedLookup(clientIp);
      }
      throw err;
    }

    try {
      return this.repo.getPublicInfo(validatedCode);
    } catch (err) {
      if (err instanceof SessionNotFoundError && this.rateLimiter && clientIp) {
        this.rateLimiter.recordFailedLookup(clientIp);
      }
      throw err;
    }
  }

  joinSession(
    sessionId: string,
    participant: {
      userId: string;
      providerType: string;
      providerSub: string;
      verifiedEmail: string | null;
      verifiedPhone: string | null;
      displayName: string;
    },
    clientIp?: string | null
  ): { participant: AuthenticatedParticipant; token: ParticipantToken } {
    if (this.rateLimiter) {
      this.rateLimiter.checkJoinMutation(participant.userId);
    }

    return this.repo.joinSession(sessionId, participant);
  }

  resumeSession(sessionId: string, token: ParticipantToken): { participant: AuthenticatedParticipant; session: QuizSession } {
    return this.repo.resumeSession(sessionId, token);
  }

  lockSession(sessionId: string, hostUserId: string, locked: boolean): QuizSession {
    return this.repo.lockSession(sessionId, hostUserId, locked);
  }

  closeSession(sessionId: string, hostUserId: string): QuizSession {
    return this.repo.closeSession(sessionId, hostUserId);
  }

  createGroup(sessionId: string, hostUserId: string, groupName: string): SessionGroup {
    return this.repo.createGroup(sessionId, hostUserId, groupName);
  }

  deleteGroup(sessionId: string, hostUserId: string, groupId: string): boolean {
    return this.repo.deleteGroup(sessionId, hostUserId, groupId);
  }

  assignPupil(sessionId: string, hostUserId: string, groupId: string, pupilName: string): SessionGroupPupil {
    return this.repo.assignPupil(sessionId, hostUserId, groupId, pupilName);
  }

  removePupil(sessionId: string, hostUserId: string, groupId: string, pupilId: string): boolean {
    return this.repo.removePupil(sessionId, hostUserId, groupId, pupilId);
  }

  getRoster(sessionId: string, hostUserId: string): {
    mode: ParticipationMode;
    participants?: readonly AuthenticatedParticipant[];
    groups?: readonly SessionGroup[];
  } {
    const session = this.repo.findSessionById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.hostUserId !== hostUserId) {
      throw new SessionAccessDeniedError('Only host can access session roster.');
    }

    if (session.participationMode === ParticipationMode.TEACHER_GROUP) {
      return {
        mode: session.participationMode,
        groups: this.repo.listGroups(sessionId)
      };
    } else {
      return {
        mode: session.participationMode,
        participants: this.repo.listParticipants(sessionId)
      };
    }
  }
}
