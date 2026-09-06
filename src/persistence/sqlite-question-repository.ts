import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'crypto';
import {
  validateQuestionPayload,
  assertValidStatusTransition,
  QuestionStatus,
  QuestionDifficulty,
  QuestionType,
  DomainValidationError,
  type Question,
  type CreateQuestionPayload,
  type UpdateQuestionPayload,
  type QuestionFilter
} from '../domain/question';

export interface QuestionRepository {
  create(data: CreateQuestionPayload): Question;
  findById(organizationId: string, id: string): Question | null;
  update(organizationId: string, id: string, updates: UpdateQuestionPayload): Question | null;
  list(organizationId: string, filter?: QuestionFilter): Question[];
  transitionStatus(organizationId: string, id: string, targetStatus: QuestionStatus): Question | null;
  close(): void;
}

interface QuestionRow {
  id: string;
  organization_id: string;
  stem: string;
  type: string;
  options_json: string;
  correct_option_indices_json: string;
  explanation: string | null;
  scripture_reference: string;
  topic: string;
  difficulty: string;
  language: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class SqliteQuestionRepository implements QuestionRepository {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  init(): void {
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

  private _rowToEntity(row: QuestionRow | null | undefined): Question | null {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      stem: row.stem,
      type: row.type as QuestionType,
      options: JSON.parse(row.options_json) as string[],
      correctOptionIndices: JSON.parse(row.correct_option_indices_json) as number[],
      explanation: row.explanation || '',
      scriptureReference: row.scripture_reference,
      topic: row.topic,
      difficulty: row.difficulty as QuestionDifficulty,
      language: row.language,
      status: row.status as QuestionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  create(data: CreateQuestionPayload): Question {
    const payload: CreateQuestionPayload = {
      ...data,
      status: data.status || QuestionStatus.DRAFT
    };
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
      (payload.status || QuestionStatus.DRAFT),
      createdAt,
      updatedAt
    );

    return this.findById(payload.organizationId, id)!;
  }

  findById(organizationId: string, id: string): Question | null {
    const stmt = this.db.prepare('SELECT * FROM questions WHERE organization_id = ? AND id = ?');
    const row = stmt.get(organizationId, id) as unknown as QuestionRow | undefined;
    return this._rowToEntity(row);
  }

  update(organizationId: string, id: string, updates: UpdateQuestionPayload): Question | null {
    const existing = this.findById(organizationId, id);
    if (!existing) {
      return null;
    }

    const updatesObj: UpdateQuestionPayload = { ...updates };
    const updateKeys = Object.keys(updatesObj) as (keyof UpdateQuestionPayload)[];
    const isStatusOnlyChange = updateKeys.every((k) => k === 'status' || k === 'organizationId' || k === 'id');

    // Domain-safe rule for APPROVED question content modification:
    // Approved questions cannot silently have their content modified while retaining APPROVED status.
    // Any content change on an APPROVED question automatically resets status to PENDING_REVIEW
    // (unless an explicit valid status transition such as ARCHIVED was specified).
    if (existing.status === QuestionStatus.APPROVED && !isStatusOnlyChange) {
      if (updatesObj.status === undefined || updatesObj.status === QuestionStatus.APPROVED) {
        updatesObj.status = QuestionStatus.PENDING_REVIEW;
      }
    }

    if (updatesObj.status !== undefined && updatesObj.status !== existing.status) {
      assertValidStatusTransition(existing.status, updatesObj.status);
    }

    const merged: Question = {
      ...existing,
      ...updatesObj,
      organizationId,
      id
    };
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

  list(organizationId: string, filter: QuestionFilter = {}): Question[] {
    let sql = 'SELECT * FROM questions WHERE organization_id = ?';
    const params: string[] = [organizationId];

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
    const rows = stmt.all(...params) as unknown as QuestionRow[];
    return rows.map((r) => this._rowToEntity(r)!);
  }

  transitionStatus(organizationId: string, id: string, targetStatus: QuestionStatus): Question | null {
    return this.update(organizationId, id, { status: targetStatus });
  }

  close(): void {
    this.db.close();
  }
}