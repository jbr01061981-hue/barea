'use server';

import { revalidatePath } from 'next/cache';
import {
  ParticipationMode,
  AdmissionPolicy,
  WorkspaceType,
  type QuizSession,
  type SessionPublicInfo,
  type AuthenticatedParticipant,
  type SessionGroup,
  type SessionGroupPupil
} from '../../domain/session';
import {
  RoomCode,
  ParticipantToken,
  normalizeAndValidateRoomCode,
  validateParticipantToken
} from '../../domain/value-objects';
import {
  BareaDomainError,
  SessionNotFoundError,
  SessionAccessDeniedError,
  CrossTenantSnapshotError
} from '../../domain/domain-errors';
import {
  getSessionService,
  getAuthorizedTeacherContext,
  getAuthenticatedUserContext
} from '../teacher/review/db';

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Gracefully ignore when invoked outside Next.js request context (e.g. unit/integration tests)
  }
}

export type ActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly code: string; readonly message: string; readonly httpStatus: number } };

export interface CreateSessionInput {
  workspaceType?: WorkspaceType;
  organizationId?: string;
  publishedQuizSnapshotId: string;
  participationMode: ParticipationMode;
  admissionPolicy: AdmissionPolicy;
  scheduledStartAt?: string | null;
  maxParticipants?: number;
  invitations?: readonly { readonly type: 'EMAIL' | 'PHONE'; readonly identifier: string }[];
}

function errorResponse(err: unknown): ActionResult<never> {
  if (err instanceof BareaDomainError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        httpStatus: err.httpStatus
      }
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: msg,
      httpStatus: 500
    }
  };
}

export async function createSessionAction(input: CreateSessionInput): Promise<ActionResult<QuizSession>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const workspaceType = input.workspaceType ?? WorkspaceType.ORGANIZATION;
    const organizationId = workspaceType === WorkspaceType.ORGANIZATION
      ? teacherContext.organizationId
      : ''; // Handled by service for personal tenant derivation

    const session = service.createSession({
      workspaceType,
      organizationId,
      publishedQuizSnapshotId: input.publishedQuizSnapshotId,
      hostUserId: teacherContext.userId,
      participationMode: input.participationMode,
      admissionPolicy: input.admissionPolicy,
      scheduledStartAt: input.scheduledStartAt,
      maxParticipants: input.maxParticipants,
      invitations: input.invitations
    });

    safeRevalidate('/teacher/quizzes');
    return { success: true, data: session };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function closeSessionAction(sessionId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to manage this session.');
    }

    service.closeSession(sessionId, teacherContext.userId);
    safeRevalidate('/teacher/quizzes');
    return { success: true, data: { success: true } };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function lockSessionAction(sessionId: string, locked: boolean): Promise<ActionResult<{ isLocked: boolean }>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to manage this session.');
    }

    const updated = service.lockSession(sessionId, teacherContext.userId, locked);
    return { success: true, data: { isLocked: updated.isLocked } };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function createSessionGroupAction(sessionId: string, groupName: string): Promise<ActionResult<SessionGroup>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to manage groups for this session.');
    }

    const group = service.createGroup(sessionId, teacherContext.userId, groupName);
    return { success: true, data: group };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function assignPupilAction(sessionId: string, groupId: string, pupilName: string): Promise<ActionResult<SessionGroupPupil>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to assign pupils in this session.');
    }

    const pupil = service.assignPupil(sessionId, teacherContext.userId, groupId, pupilName);
    return { success: true, data: pupil };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function removePupilAction(sessionId: string, groupId: string, pupilId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to remove pupils in this session.');
    }

    const removed = service.removePupil(sessionId, teacherContext.userId, groupId, pupilId);
    return { success: true, data: { success: removed } };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function deleteSessionGroupAction(sessionId: string, groupId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const session = service.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.hostUserId !== teacherContext.userId) {
      throw new SessionAccessDeniedError('Unauthorized to delete groups in this session.');
    }

    const deleted = service.deleteGroup(sessionId, teacherContext.userId, groupId);
    return { success: true, data: { success: deleted } };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function getHostSessionRosterAction(sessionId: string): Promise<ActionResult<{
  mode: ParticipationMode;
  participants?: readonly AuthenticatedParticipant[];
  groups?: readonly SessionGroup[];
}>> {
  try {
    const teacherContext = await getAuthorizedTeacherContext();
    const service = getSessionService();

    const roster = service.getRoster(sessionId, teacherContext.userId);
    return { success: true, data: roster };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function lookupRoomAction(roomCode: string, clientIp?: string): Promise<ActionResult<SessionPublicInfo>> {
  try {
    const service = getSessionService();
    const info = service.getPublicInfo(roomCode, clientIp);
    return { success: true, data: info };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function joinSessionAction(roomCode: string, clientIp?: string): Promise<ActionResult<{ participantId: string; token: ParticipantToken }>> {
  try {
    const userContext = await getAuthenticatedUserContext();
    const service = getSessionService();

    const sessionInfo = service.getPublicInfo(roomCode, clientIp);

    const result = service.joinSession(
      sessionInfo.sessionId,
      {
        userId: userContext.userId,
        providerType: userContext.providerType,
        providerSub: userContext.providerSub,
        verifiedEmail: userContext.emailVerified ? userContext.email : null,
        verifiedPhone: userContext.phoneVerified ? userContext.phone : null,
        displayName: userContext.displayName
      },
      clientIp
    );

    return {
      success: true,
      data: {
        participantId: result.participant.id,
        token: result.token
      }
    };
  } catch (err) {
    return errorResponse(err);
  }
}

export async function resumeSessionAction(sessionId: string, token: string): Promise<ActionResult<{
  participant: AuthenticatedParticipant;
  sessionInfo: SessionPublicInfo;
}>> {
  try {
    const service = getSessionService();
    const validatedToken = validateParticipantToken(token);
    const result = service.resumeSession(sessionId, validatedToken);
    const sessionInfo = service.getPublicInfo(result.session.roomCode);

    return {
      success: true,
      data: {
        participant: result.participant,
        sessionInfo
      }
    };
  } catch (err) {
    return errorResponse(err);
  }
}
