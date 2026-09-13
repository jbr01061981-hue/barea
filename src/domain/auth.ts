export interface User {
  readonly id: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly passwordHash: string | null;
  readonly displayName: string;
  readonly createdAt: string;
}

export interface FederatedIdentity {
  readonly id: string;
  readonly userId: string;
  readonly providerType: 'GOOGLE' | string;
  readonly providerSub: string;
  readonly createdAt: string;
}

export interface UserSession {
  readonly id: string; // Token hash
  readonly userId: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface OrganizationMembership {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: 'teacher' | 'admin';
}

export interface AuthenticatedSessionContext {
  readonly user: User;
  readonly session: UserSession;
  readonly memberships: readonly OrganizationMembership[];
}
