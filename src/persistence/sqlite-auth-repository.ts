import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'crypto';
import type {
  User,
  FederatedIdentity,
  UserSession,
  OrganizationMembership,
  AuthenticatedSessionContext,
  OAuthTransaction
} from '../domain/auth';

export interface AuthRepository {
  // Users (Public Safe Domain Model)
  createUser(data: {
    email: string | null;
    emailVerified?: boolean;
    passwordHash?: string | null;
    displayName: string;
  }): Promise<User>;
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;

  // Federated Identity
  findFederatedIdentity(providerType: string, providerSub: string): Promise<FederatedIdentity | null>;
  createFederatedIdentity(data: {
    userId: string;
    providerType: string;
    providerSub: string;
  }): Promise<FederatedIdentity>;

  // Sessions
  createSession(
    userId: string,
    ttlOrOptions?: number | {
      ttlSeconds?: number;
      authProvider?: string;
      providerSub?: string;
    }
  ): Promise<{ rawToken: string; session: UserSession }>;
  findSessionByToken(rawToken: string): Promise<AuthenticatedSessionContext | null>;
  deleteSession(rawToken: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  // Organization Memberships
  addOrganizationMembership(organizationId: string, userId: string, role: 'teacher' | 'admin'): Promise<void>;
  getOrganizationMemberships(userId: string): Promise<OrganizationMembership[]>;

  // OAuth Transactions
  createOAuthTransaction(data: {
    id: string;
    stateHash: string;
    codeVerifier: string;
    nonceHash: string;
    returnTo: string;
    ttlSeconds?: number;
  }): Promise<OAuthTransaction>;
  findOAuthTransaction(id: string): Promise<OAuthTransaction | null>;
  consumeOAuthTransaction(id: string, nowIso?: string): Promise<boolean>;
  pruneExpiredOAuthTransactions(beforeIso?: string): Promise<number>;

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

      CREATE TABLE IF NOT EXISTS oauth_transactions (
        id TEXT PRIMARY KEY,
        state_hash TEXT NOT NULL UNIQUE,
        code_verifier TEXT NOT NULL,
        nonce_hash TEXT NOT NULL,
        return_to TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_federated_identities_sub ON federated_identities(provider_type, provider_sub);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_transactions_expires_at ON oauth_transactions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_oauth_transactions_state_hash ON oauth_transactions(state_hash);
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

  private _findUserByIdSync(id: string): User | null {
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

  private _findUserByEmailSync(email: string): User | null {
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

  private _findFederatedIdentitySync(providerType: string, providerSub: string): FederatedIdentity | null {
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

  private _createUserSync(data: {
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

  private _createFederatedIdentitySync(data: {
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

  createSessionSync(
    userId: string,
    ttlOrOptions?: number | {
      ttlSeconds?: number;
      authProvider?: string;
      providerSub?: string;
    }
  ): { rawToken: string; session: UserSession } {
    return this._createSessionSync(userId, ttlOrOptions);
  }

  private _createSessionSync(
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

  private _consumeOAuthTransactionSync(id: string, nowIso?: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const now = nowIso || new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE oauth_transactions
      SET consumed_at = ?
      WHERE id = ?
        AND consumed_at IS NULL
        AND expires_at > ?
    `).run(now, id, now);

    return (result.changes ?? 0) > 0;
  }

  private _getOrganizationMembershipsSync(userId: string): OrganizationMembership[] {
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

  async createUser(data: {
    email: string | null;
    emailVerified?: boolean;
    passwordHash?: string | null;
    displayName: string;
  }): Promise<User> {
    return this._createUserSync(data);
  }

  async findUserById(id: string): Promise<User | null> {
    return this._findUserByIdSync(id);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this._findUserByEmailSync(email);
  }

  async findFederatedIdentity(providerType: string, providerSub: string): Promise<FederatedIdentity | null> {
    return this._findFederatedIdentitySync(providerType, providerSub);
  }

  async createFederatedIdentity(data: {
    userId: string;
    providerType: string;
    providerSub: string;
  }): Promise<FederatedIdentity> {
    return this._createFederatedIdentitySync(data);
  }

  async createSession(
    userId: string,
    ttlOrOptions?: number | {
      ttlSeconds?: number;
      authProvider?: string;
      providerSub?: string;
    }
  ): Promise<{ rawToken: string; session: UserSession }> {
    return this._createSessionSync(userId, ttlOrOptions);
  }

  async findSessionByToken(rawToken: string): Promise<AuthenticatedSessionContext | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    const sessionRow = this.db.prepare(`
      SELECT id, user_id, auth_provider, provider_sub, expires_at, created_at
      FROM user_sessions
      WHERE id = ? AND expires_at > ?
    `).get(tokenHash, now) as any;

    if (!sessionRow) return null;

    const user = this._findUserByIdSync(sessionRow.user_id);
    if (!user) return null;

    const memberships = this._getOrganizationMembershipsSync(user.id);

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

  async deleteSession(rawToken: string): Promise<void> {
    if (!rawToken || typeof rawToken !== 'string') return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    this.db.prepare(`
      DELETE FROM user_sessions WHERE id = ?
    `).run(tokenHash);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM user_sessions WHERE user_id = ?
    `).run(userId);
  }

  async addOrganizationMembership(organizationId: string, userId: string, role: 'teacher' | 'admin'): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO organization_memberships (organization_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(organizationId, userId, role);
  }

  async getOrganizationMemberships(userId: string): Promise<OrganizationMembership[]> {
    return this._getOrganizationMembershipsSync(userId);
  }

  async createOAuthTransaction(data: {
    id: string;
    stateHash: string;
    codeVerifier: string;
    nonceHash: string;
    returnTo: string;
    ttlSeconds?: number;
  }): Promise<OAuthTransaction> {
    const now = new Date();
    const createdAt = now.toISOString();
    const ttl = data.ttlSeconds ?? 600; // default 10 minutes (600s)
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    this.db.prepare(`
      INSERT INTO oauth_transactions (id, state_hash, code_verifier, nonce_hash, return_to, created_at, expires_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      data.id,
      data.stateHash,
      data.codeVerifier,
      data.nonceHash,
      data.returnTo,
      createdAt,
      expiresAt
    );

    return {
      id: data.id,
      stateHash: data.stateHash,
      codeVerifier: data.codeVerifier,
      nonceHash: data.nonceHash,
      returnTo: data.returnTo,
      createdAt,
      expiresAt,
      consumedAt: null
    };
  }

  async findOAuthTransaction(id: string): Promise<OAuthTransaction | null> {
    if (!id || typeof id !== 'string') return null;
    const row = this.db.prepare(`
      SELECT id, state_hash, code_verifier, nonce_hash, return_to, created_at, expires_at, consumed_at
      FROM oauth_transactions
      WHERE id = ?
    `).get(id) as any;

    if (!row) return null;
    return {
      id: row.id,
      stateHash: row.state_hash,
      codeVerifier: row.code_verifier,
      nonceHash: row.nonce_hash,
      returnTo: row.return_to,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at ?? null
    };
  }

  async consumeOAuthTransaction(id: string, nowIso?: string): Promise<boolean> {
    return this._consumeOAuthTransactionSync(id, nowIso);
  }

  async pruneExpiredOAuthTransactions(beforeIso?: string): Promise<number> {
    const cutoff = beforeIso || new Date(Date.now() - 3600 * 1000).toISOString(); // Expired 1 hour ago
    const result = this.db.prepare(`
      DELETE FROM oauth_transactions
      WHERE expires_at < ?
    `).run(cutoff);

    return Number(result.changes ?? 0);
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
