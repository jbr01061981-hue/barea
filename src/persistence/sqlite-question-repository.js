const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const {
  validateQuestionPayload,
  assertValidStatusTransition,
  QuestionStatus,
  QuestionDifficulty,
  QuestionType,
  DomainValidationError,
  ApprovedQuestionModificationError
} = require('../domain/question');

class SqliteQuestionRepository {
  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        stem TEXT NOT NULL,
        type TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_option_indices_json TEXT NOT NULL,
        explanation TEXT,
        scripture_reference TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        language TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_questions_org ON questions (organization_id);
      CREATE INDEX IF NOT EXISTS idx_questions_org_status ON questions (organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_questions_org_topic ON questions (organization_id, topic);
      CREATE INDEX IF NOT EXISTS idx_questions_org_diff ON questions (organization_id, difficulty);
    `);
  }

  _rowToEntity(row) {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      stem: row.stem,
      type: row.type,
      options: JSON.parse(row.options_json),
      correctOptionIndices: JSON.parse(row.correct_option_indices_json),
      explanation: row.explanation || '',
      scriptureReference: row.scripture_reference,
      topic: row.topic,
      difficulty: row.difficulty,
      language: row.language,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  create(data) {
    const payload = Object.assign({}, data);
    if (!payload.status) {
      payload.status = QuestionStatus.DRAFT;
    }
    validateQuestionPayload(payload, false);

    const id = payload.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = payload.createdAt || now;
    const updatedAt = now;

    const stmt = this.db.prepare(`
      INSERT INTO questions (
        id, organization_id, stem, type, options_json, correct_option_indices_json,
        explanation, scripture_reference, topic, difficulty, language, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      payload.organizationId,
      payload.stem,
      payload.type,
      JSON.stringify(payload.options),
      JSON.stringify(payload.correctOptionIndices),
      payload.explanation || '',
      payload.scriptureReference,
      payload.topic,
      payload.difficulty,
      payload.language,
      payload.status,
      createdAt,
      updatedAt
    );

    return this.findById(payload.organizationId, id);
  }

  findById(organizationId, id) {
    const stmt = this.db.prepare('SELECT * FROM questions WHERE organization_id = ? AND id = ?');
    const row = stmt.get(organizationId, id);
    return this._rowToEntity(row);
  }

  update(organizationId, id, updates) {
    const existing = this.findById(organizationId, id);
    if (!existing) {
      return null;
    }

    const isStatusOnlyChange = Object.keys(updates).every((k) => k === 'status' || k === 'organizationId' || k === 'id');

    // Domain-safe rule for APPROVED question content modification:
    // Approved questions cannot silently have their content modified while retaining APPROVED status.
    // Any content change on an APPROVED question automatically resets status to PENDING_REVIEW
    // (unless an explicit valid status transition such as ARCHIVED was specified).
    if (existing.status === QuestionStatus.APPROVED && !isStatusOnlyChange) {
      if (updates.status === undefined || updates.status === QuestionStatus.APPROVED) {
        updates.status = QuestionStatus.PENDING_REVIEW;
      }
    }

    if (updates.status !== undefined && updates.status !== existing.status) {
      assertValidStatusTransition(existing.status, updates.status);
    }

    const merged = Object.assign({}, existing, updates, { organizationId });
    validateQuestionPayload(merged, true);

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE questions SET
        stem = ?,
        type = ?,
        options_json = ?,
        correct_option_indices_json = ?,
        explanation = ?,
        scripture_reference = ?,
        topic = ?,
        difficulty = ?,
        language = ?,
        status = ?,
        updated_at = ?
      WHERE organization_id = ? AND id = ?
    `);

    stmt.run(
      merged.stem,
      merged.type,
      JSON.stringify(merged.options),
      JSON.stringify(merged.correctOptionIndices),
      merged.explanation || '',
      merged.scriptureReference,
      merged.topic,
      merged.difficulty,
      merged.language,
      merged.status,
      now,
      organizationId,
      id
    );

    return this.findById(organizationId, id);
  }

  list(organizationId, filter = {}) {
    let sql = 'SELECT * FROM questions WHERE organization_id = ?';
    const params = [organizationId];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.difficulty) {
      sql += ' AND difficulty = ?';
      params.push(filter.difficulty);
    }
    if (filter.topic) {
      sql += ' AND topic = ?';
      params.push(filter.topic);
    }
    if (filter.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter.language) {
      sql += ' AND language = ?';
      params.push(filter.language);
    }
    if (filter.search) {
      sql += ' AND (stem LIKE ? OR explanation LIKE ? OR scripture_reference LIKE ?)';
      const q = '%' + filter.search + '%';
      params.push(q, q, q);
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this._rowToEntity(r));
  }

  transitionStatus(organizationId, id, targetStatus) {
    return this.update(organizationId, id, { status: targetStatus });
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  SqliteQuestionRepository
};
