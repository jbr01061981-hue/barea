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
      readonly organizationId: string;         // Authoritative tenant identity matching BAREA-005 organization_id
      readonly workspaceId: string;            // Alias getter returning organizationId
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
      readonly organizationId: string;         // Authoritative tenant identity matching BAREA-005 organization_id
      readonly workspaceId: string;            // Alias getter returning organizationId
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

export function assertValidModeAdmissionCompatibility(
  mode: ParticipationMode,
  admission: AdmissionPolicy
): void {
  if (mode === ParticipationMode.TEACHER_GROUP && admission !== AdmissionPolicy.TEACHER_ASSIGNED) {
    throw new Error('Teacher-controlled group mode must use TEACHER_ASSIGNED admission policy.');
  }
  if (
    mode === ParticipationMode.INDIVIDUAL_AUTHENTICATED &&
    admission !== AdmissionPolicy.OPEN &&
    admission !== AdmissionPolicy.RESTRICTED
  ) {
    throw new Error('Individual authenticated mode must use OPEN or RESTRICTED admission policy.');
  }
}
