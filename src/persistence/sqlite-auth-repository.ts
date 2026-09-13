import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'crypto';
import type {
  User,
  FederatedIdentity,
  UserSession,
  OrganizationMembership,
  AuthenticatedSessionContext
} from '../domain/auth';

export interface AuthRepository {
  // Users (Public Safe Domain Model)
  createUser(data: {
    email: string | null;
    emailVerified?: boolean;
    passwordHash?: string | null;
    displayName: string;
  }): User;
  findUserById(id: string): User | null;
  findUserByEmail(email: string): User | null;
  findUserCredentialsByEmail(email: string): { user: User; passwordHash: string | null } | null;
  updateUserPassword(id: string, passwordHash: string): void;

  // Federated Identity
  findFederatedIdentity(providerType: string, providerSub: string): FederatedIdentity | null;
  createFederatedIdentity(data: {
    userId: string;
    providerType: string;
    providerSub: string;
  }): FederatedIdentity;

  // Sessions
  createSession(
    userId: string,
    ttlOrOptions?: number | {
      ttlSeconds?: number;
      authProvider?: string;
      providerSub?: string;
    }
  ): { rawToken: string; session: UserSession };
  findSessionByToken(rawToken: string): AuthenticatedSessionContext | null;
  deleteSession(rawToken: string): void;
  deleteUserSessions(userId: string): void;

  // Organization Memberships
  addOrganizationMembership(organizationId: string, userId: string, role: 'teacher' | 'admin'): void;
  getOrganizationMemberships(userId: string): OrganizationMembership[];

  transaction<T>(action: () => T): T;
  close(): void;
}

export class SqliteAuthRepository implements AuthRepository {
  private db: DatabaseSync;
  private ownsDb: boolean;

  constructor(dbOrPath: DatabaseSync | string = ':memory:') {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
      this.ownsDb = true;
    } else {
      this.db = dbOrPath;
      this.ownsDb = false;
    }
    this.init();
  }

  getDatabase(): DatabaseSync {
    return this.db;
  }

  init(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0, 1)),
        password_hash TEXT,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS federated_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_type TEXT NOT NULL,
        provider_sub TEXT NOT NULL,
        created_at TEXT NOT NULL,
        CONSTRAINT uq_provider_sub UNIQUE (provider_type, provider_sub)
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY, -- SHA-256 hash of raw token
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        auth_provider TEXT NOT NULL DEFAULT 'LOCAL_PASSWORD',
        provider_sub TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organization_memberships (
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'admin')),
        PRIMARY KEY (organization_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_federated_identities_sub ON federated_identities(provider_type, provider_sub);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
    `);

    // Migration helper for existing databases: ensure auth_provider and provider_sub exist
    try {
      const sessionCols = this.db.prepare(`PRAGMA table_info(user_sessions)`).all() as any[];
      const hasAuthProvider = sessionCols.some((c) => c.name === 'auth_provider');
      if (!hasAuthProvider) {
        this.db.exec(`ALTER TABLE user_sessions ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL_PASSWORD';`);
        this.db.exec(`ALTER TABLE user_sessions ADD COLUMN provider_sub TEXT;`);
      }
    } catch {
      // Ignore if table was just created above
    }
  }

  createUser(data: {
    email: string | null;
    emailVerified?: boolean;
    passwordHash?: string | null;
    displayName: string;
  }): User {
    const id = 'usr_' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;

    this.db.prepare(`
      INSERT INTO users (id, email, email_verified, password_hash, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      normalizedEmail,
      data.emailVerified ? 1 : 0,
      data.passwordHash ?? null,
      data.displayName.trim(),
      now
    );

    return {
      id,
      email: normalizedEmail,
      emailVerified: Boolean(data.emailVerified),
      displayName: data.displayName.trim(),
      createdAt: now
    };
  }

  findUserById(id: string): User | null {
    const row = this.db.prepare(`
      SELECT id, email, email_verified, display_name, created_at
      FROM users
      WHERE id = ?
    `).get(id) as any;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      displayName: row.display_name,
      createdAt: row.created_at
    };
  }

  findUserByEmail(email: string): User | null {
    if (!email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const row = this.db.prepare(`
      SELECT id, email, email_verified, display_name, created_at
      FROM users
      WHERE email = ?
    `).get(normalizedEmail) as any;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      displayName: row.display_name,
      createdAt: row.created_at
    };
  }

  findUserCredentialsByEmail(email: string): { user: User; passwordHash: string | null } | null {
    if (!email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const row = this.db.prepare(`
      SELECT id, email, email_verified, password_hash, display_name, created_at
      FROM users
      WHERE email = ?
    `).get(normalizedEmail) as any;

    if (!row) return null;
    return {
      user: {
        id: row.id,
        email: row.email,
        emailVerified: Boolean(row.email_verified),
        displayName: row.display_name,
        createdAt: row.created_at
      },
      passwordHash: row.password_hash ?? null
    };
  }

  updateUserPassword(id: string, passwordHash: string): void {
    this.db.prepare(`
      UPDATE users SET password_hash = ? WHERE id = ?
    `).run(passwordHash, id);
  }

  findFederatedIdentity(providerType: string, providerSub: string): FederatedIdentity | null {
    const row = this.db.prepare(`
      SELECT id, user_id, provider_type, provider_sub, created_at
      FROM federated_identities
      WHERE provider_type = ? AND provider_sub = ?
    `).get(providerType.toUpperCase(), providerSub.trim()) as any;

    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      providerType: row.provider_type,
      providerSub: row.provider_sub,
      createdAt: row.created_at
    };
  }

  createFederatedIdentity(data: {
    userId: string;
    providerType: string;
    providerSub: string;
  }): FederatedIdentity {
    const id = 'fid_' + crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const normalizedType = data.providerType.toUpperCase();
    const normalizedSub = data.providerSub.trim();

    this.db.prepare(`
      INSERT INTO federated_identities (id, user_id, provider_type, provider_sub, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.userId, normalizedType, normalizedSub, now);

    return {
      id,
      userId: data.userId,
      providerType: normalizedType,
      providerSub: normalizedSub,
      createdAt: now
    };
  }

  createSession(
    userId: string,
    ttlOrOptions?: number | {
      ttlSeconds?: number;
      authProvider?: string;
      providerSub?: string;
    }
  ): { rawToken: string; session: UserSession } {
    const opts = typeof ttlOrOptions === 'number' ? { ttlSeconds: ttlOrOptions } : ttlOrOptions;
    const ttlSeconds = opts?.ttlSeconds ?? 60 * 60 * 24 * 7;
    const authProvider = opts?.authProvider || 'LOCAL_PASSWORD';
    const providerSub = opts?.providerSub || userId;

    const rawToken = 'bst_' + crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const createdAt = now.toISOString();

    this.db.prepare(`
      INSERT INTO user_sessions (id, user_id, auth_provider, provider_sub, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tokenHash, userId, authProvider, providerSub, expiresAt, createdAt);

    return {
      rawToken,
      session: {
        id: tokenHash,
        userId,
        authProvider,
        providerSub,
        expiresAt,
        createdAt
      }
    };
  }

  findSessionByToken(rawToken: string): AuthenticatedSessionContext | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    const sessionRow = this.db.prepare(`
      SELECT id, user_id, auth_provider, provider_sub, expires_at, created_at
      FROM user_sessions
      WHERE id = ? AND expires_at > ?
    `).get(tokenHash, now) as any;

    if (!sessionRow) return null;

    const user = this.findUserById(sessionRow.user_id);
    if (!user) return null;

    const memberships = this.getOrganizationMemberships(user.id);

    return {
      user,
      session: {
        id: sessionRow.id,
        userId: sessionRow.user_id,
        authProvider: sessionRow.auth_provider,
        providerSub: sessionRow.provider_sub || sessionRow.user_id,
        expiresAt: sessionRow.expires_at,
        createdAt: sessionRow.created_at
      },
      memberships
    };
  }

  deleteSession(rawToken: string): void {
    if (!rawToken || typeof rawToken !== 'string') return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    this.db.prepare(`
      DELETE FROM user_sessions WHERE id = ?
    `).run(tokenHash);
  }

  deleteUserSessions(userId: string): void {
    this.db.prepare(`
      DELETE FROM user_sessions WHERE user_id = ?
    `).run(userId);
  }

  addOrganizationMembership(organizationId: string, userId: string, role: 'teacher' | 'admin'): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO organization_memberships (organization_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(organizationId, userId, role);
  }

  getOrganizationMemberships(userId: string): OrganizationMembership[] {
    const rows = this.db.prepare(`
      SELECT organization_id, user_id, role
      FROM organization_memberships
      WHERE user_id = ?
    `).all(userId) as any[];

    return rows.map((r) => ({
      organizationId: r.organization_id,
      userId: r.user_id,
      role: r.role
    }));
  }

  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = action();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
