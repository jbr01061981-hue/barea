import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'crypto';
import {
  QuizStatus,
  ScoringStyle,
  QUIZ_LIMITS,
  type Quiz,
  type CreateQuizPayload,
  type UpdateQuizPayload,
  type QuizQuestionItem,
  type PublishedQuizSnapshot,
  type SnapshotQuestion,
  type SnapshotChoice,
  validateCreateQuizPayload,
  validateUpdateQuizPayload,
  assertValidQuizStatusTransition,
  QuizValidationError,
  InvalidQuizLifecycleTransitionError
} from '../domain/quiz';
import {
  QuestionStatus,
  type Question,
  type QuestionType,
  type QuestionDifficulty
} from '../domain/question';

export interface QuizFilter {
  readonly status?: QuizStatus;
  readonly search?: string;
}

export interface QuizRepository {
  create(data: CreateQuizPayload): Quiz;
  findById(organizationId: string, id: string): Quiz | null;
  update(organizationId: string, id: string, updates: UpdateQuizPayload): Quiz | null;
  list(organizationId: string, filter?: QuizFilter): Quiz[];
  transitionStatus(organizationId: string, id: string, nextStatus: QuizStatus): Quiz | null;

  // Question attachments
  addQuestion(organizationId: string, quizId: string, questionId: string, sortOrder?: number): QuizQuestionItem;
  removeQuestion(organizationId: string, quizId: string, questionId: string): boolean;
  reorderQuestions(organizationId: string, quizId: string, questionIdsInOrder: readonly string[]): readonly QuizQuestionItem[];
  getQuizQuestions(organizationId: string, quizId: string): readonly QuizQuestionItem[];

  // Publication and Snapshot
  publishQuiz(organizationId: string, quizId: string, publishedByUserId: string): PublishedQuizSnapshot;
  getPublishedSnapshot(organizationId: string, quizId: string): PublishedQuizSnapshot | null;

  transaction<T>(action: () => T): T;
  close(): void;
}

interface QuizRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: string;
  default_time_limit_seconds: number;
  scoring_style: string;
  option_shuffle: number;
  created_at: string;
  updated_at: string;
}

interface QuizQuestionRow {
  quiz_id: string;
  question_id: string;
  sort_order: number;
  added_at: string;
  // joined fields
  stem?: string;
  type?: string;
  options_json?: string;
  correct_option_indices_json?: string;
  explanation?: string | null;
  scripture_reference?: string;
  topic?: string;
  difficulty?: string;
  language?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface PublishedSnapshotRow {
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
}

export class SqliteQuizRepository implements QuizRepository {
  private db: DatabaseSync;
  public simulateSnapshotFailure: boolean = false;

  constructor(dbOrPath: DatabaseSync | string = ':memory:') {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
    } else {
      this.db = dbOrPath;
    }
    this.init();
  }

  getDatabase(): DatabaseSync {
    return this.db;
  }

  init(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0 AND length(title) <= 255),
        description TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
        default_time_limit_seconds INTEGER NOT NULL DEFAULT 30 CHECK(default_time_limit_seconds BETWEEN 10 AND 120),
        scoring_style TEXT NOT NULL DEFAULT 'STANDARD' CHECK(scoring_style IN ('STANDARD', 'SPEED_WEIGHTED')),
        option_shuffle INTEGER NOT NULL DEFAULT 0 CHECK(option_shuffle IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_quizzes_org ON quizzes (organization_id);
      CREATE INDEX IF NOT EXISTS idx_quizzes_org_status ON quizzes (organization_id, status);

      CREATE TABLE IF NOT EXISTS quiz_questions (
        quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
        sort_order INTEGER NOT NULL CHECK(sort_order >= 1),
        added_at TEXT NOT NULL,
        PRIMARY KEY (quiz_id, question_id),
        UNIQUE (quiz_id, sort_order)
      );

      CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions (quiz_id);

      CREATE TABLE IF NOT EXISTS published_quiz_snapshots (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        default_time_limit_seconds INTEGER NOT NULL,
        scoring_style TEXT NOT NULL,
        option_shuffle INTEGER NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1 CHECK(version_number >= 1),
        snapshot_json TEXT NOT NULL,
        published_at TEXT NOT NULL,
        published_by_user_id TEXT NOT NULL,
        UNIQUE (quiz_id, version_number)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_quiz ON published_quiz_snapshots (quiz_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_org ON published_quiz_snapshots (organization_id);

      -- Trigger: Immutability on UPDATE
      CREATE TRIGGER IF NOT EXISTS prevent_snapshot_update
      BEFORE UPDATE ON published_quiz_snapshots
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Published quiz snapshots records are immutable and cannot be updated');
      END;

      -- Trigger: Immutability on DELETE
      CREATE TRIGGER IF NOT EXISTS prevent_snapshot_delete
      BEFORE DELETE ON published_quiz_snapshots
      BEGIN
        SELECT RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Published quiz snapshots records are immutable and cannot be deleted');
      END;

      -- Trigger: Prevent physical DELETE of quiz if published snapshot exists
      CREATE TRIGGER IF NOT EXISTS prevent_published_quiz_delete
      BEFORE DELETE ON quizzes
      WHEN (
        OLD.status = 'PUBLISHED'
        OR EXISTS (SELECT 1 FROM published_quiz_snapshots WHERE quiz_id = OLD.id)
      )
      BEGIN
        SELECT RAISE(ABORT, 'ILLEGAL_OPERATION: Published or historically published quizzes cannot be physically deleted');
      END;
    `);
  }

  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (err: unknown) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private _rowToQuiz(row: QuizRow | null | undefined): Quiz | null {
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      description: row.description,
      status: row.status as QuizStatus,
      defaultTimeLimitSeconds: row.default_time_limit_seconds,
      scoringStyle: row.scoring_style as ScoringStyle,
      optionShuffle: row.option_shuffle === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  create(data: CreateQuizPayload): Quiz {
    validateCreateQuizPayload(data);

    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const updatedAt = now;
    const defaultTimeLimit = data.defaultTimeLimitSeconds ?? QUIZ_LIMITS.DEFAULT_TIME_LIMIT_SECONDS;
    const scoringStyle = data.scoringStyle ?? ScoringStyle.STANDARD;
    const optionShuffle = data.optionShuffle ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO quizzes (
        id, organization_id, title, description, status,
        default_time_limit_seconds, scoring_style, option_shuffle,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.organizationId,
      data.title.trim(),
      data.description ?? null,
      QuizStatus.DRAFT,
      defaultTimeLimit,
      scoringStyle,
      optionShuffle,
      createdAt,
      updatedAt
    );

    const created = this.findById(data.organizationId, id);
    if (!created) {
      throw new Error(`Failed to create quiz with ID ${id}`);
    }
    return created;
  }

  findById(organizationId: string, id: string): Quiz | null {
    const stmt = this.db.prepare(`
      SELECT * FROM quizzes
      WHERE id = ? AND organization_id = ?
    `);
    const row = stmt.get(id, organizationId) as QuizRow | undefined;
    if (!row) return null;

    const quiz = this._rowToQuiz(row);
    if (!quiz) return null;

    const questions = this.getQuizQuestions(organizationId, id);
    return { ...quiz, questions };
  }

  update(organizationId: string, id: string, updates: UpdateQuizPayload): Quiz | null {
    validateUpdateQuizPayload(updates);

    return this.transaction(() => {
      const existing = this.findById(organizationId, id);
      if (!existing) return null;

      if (existing.status !== QuizStatus.DRAFT) {
        throw new QuizValidationError(
          `Cannot modify quiz in ${existing.status} status. Only DRAFT quizzes can be edited.`
        );
      }

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (updates.title !== undefined) {
        sets.push('title = ?');
        values.push(updates.title.trim());
      }
      if (updates.description !== undefined) {
        sets.push('description = ?');
        values.push(updates.description ?? null);
      }
      if (updates.defaultTimeLimitSeconds !== undefined) {
        sets.push('default_time_limit_seconds = ?');
        values.push(updates.defaultTimeLimitSeconds);
      }
      if (updates.scoringStyle !== undefined) {
        sets.push('scoring_style = ?');
        values.push(updates.scoringStyle);
      }
      if (updates.optionShuffle !== undefined) {
        sets.push('option_shuffle = ?');
        values.push(updates.optionShuffle ? 1 : 0);
      }

      if (sets.length === 0) {
        return existing;
      }

      const now = new Date().toISOString();
      sets.push('updated_at = ?');
      values.push(now);

      values.push(id);
      values.push(organizationId);

      const sql = `UPDATE quizzes SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`;
      this.db.prepare(sql).run(...values);

      return this.findById(organizationId, id);
    });
  }

  list(organizationId: string, filter: QuizFilter = {}): Quiz[] {
    let sql = `SELECT * FROM quizzes WHERE organization_id = ?`;
    const params: (string | number)[] = [organizationId];

    if (filter.status) {
      sql += ` AND status = ?`;
      params.push(filter.status);
    }
    if (filter.search && filter.search.trim()) {
      sql += ` AND (title LIKE ? OR description LIKE ?)`;
      const term = `%${filter.search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as unknown as QuizRow[];
    return rows.map((r) => this._rowToQuiz(r)!);
  }

  transitionStatus(organizationId: string, id: string, nextStatus: QuizStatus): Quiz | null {
    return this.transaction(() => {
      const existing = this.findById(organizationId, id);
      if (!existing) return null;

      const hasSnapshot = this.hasPublishedSnapshot(id);
      assertValidQuizStatusTransition(existing.status, nextStatus, hasSnapshot);

      const now = new Date().toISOString();
      this.db.prepare(`
        UPDATE quizzes SET status = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(nextStatus, now, id, organizationId);

      return this.findById(organizationId, id);
    });
  }

  private hasPublishedSnapshot(quizId: string): boolean {
    const row = this.db.prepare(`
      SELECT count(*) as count FROM published_quiz_snapshots WHERE quiz_id = ?
    `).get(quizId) as { count: number };
    return row.count > 0;
  }

  addQuestion(
    organizationId: string,
    quizId: string,
    questionId: string,
    sortOrder?: number
  ): QuizQuestionItem {
    return this.transaction(() => {
      const quiz = this.findById(organizationId, quizId);
      if (!quiz) {
        throw new QuizValidationError(`Quiz ${quizId} not found.`);
      }
      if (quiz.status !== QuizStatus.DRAFT) {
        throw new QuizValidationError(`Cannot add questions to quiz in ${quiz.status} status.`);
      }

      // Assert question exists, belongs to same organization, and is APPROVED
      const qStmt = this.db.prepare(`
        SELECT id, organization_id, status FROM questions WHERE id = ?
      `);
      const qRow = qStmt.get(questionId) as { id: string; organization_id: string; status: string } | undefined;
      if (!qRow || qRow.organization_id !== organizationId) {
        throw new QuizValidationError(`Question ${questionId} not found or belongs to a different organization.`);
      }
      if (qRow.status !== QuestionStatus.APPROVED) {
        throw new QuizValidationError(
          `Question ${questionId} has status '${qRow.status}'. Only APPROVED questions can be added to a quiz.`
        );
      }

      // Check if already in quiz
      const exists = this.db.prepare(`
        SELECT 1 FROM quiz_questions WHERE quiz_id = ? AND question_id = ?
      `).get(quizId, questionId);
      if (exists) {
        throw new QuizValidationError(`Question ${questionId} is already in quiz ${quizId}.`);
      }

      let position = sortOrder;
      if (position === undefined || position < 1) {
        const maxRow = this.db.prepare(`
          SELECT max(sort_order) as max_order FROM quiz_questions WHERE quiz_id = ?
        `).get(quizId) as { max_order: number | null };
        position = (maxRow.max_order || 0) + 1;
      }

      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO quiz_questions (quiz_id, question_id, sort_order, added_at)
        VALUES (?, ?, ?, ?)
      `).run(quizId, questionId, position, now);

      this.db.prepare(`UPDATE quizzes SET updated_at = ? WHERE id = ?`).run(now, quizId);

      return {
        quizId,
        questionId,
        sortOrder: position,
        addedAt: now
      };
    });
  }

  removeQuestion(organizationId: string, quizId: string, questionId: string): boolean {
    return this.transaction(() => {
      const quiz = this.findById(organizationId, quizId);
      if (!quiz) {
        throw new QuizValidationError(`Quiz ${quizId} not found.`);
      }
      if (quiz.status !== QuizStatus.DRAFT) {
        throw new QuizValidationError(`Cannot remove questions from quiz in ${quiz.status} status.`);
      }

      const result = this.db.prepare(`
        DELETE FROM quiz_questions WHERE quiz_id = ? AND question_id = ?
      `).run(quizId, questionId);

      if (result.changes === 0) {
        return false;
      }

      // Re-normalize positions [1..N]
      const rows = this.db.prepare(`
        SELECT question_id FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC
      `).all(quizId) as unknown as { question_id: string }[];

      for (let i = 0; i < rows.length; i++) {
        this.db.prepare(`
          UPDATE quiz_questions SET sort_order = ? WHERE quiz_id = ? AND question_id = ?
        `).run(i + 1, quizId, rows[i].question_id);
      }

      const now = new Date().toISOString();
      this.db.prepare(`UPDATE quizzes SET updated_at = ? WHERE id = ?`).run(now, quizId);

      return true;
    });
  }

  reorderQuestions(
    organizationId: string,
    quizId: string,
    questionIdsInOrder: readonly string[]
  ): readonly QuizQuestionItem[] {
    return this.transaction(() => {
      const quiz = this.findById(organizationId, quizId);
      if (!quiz) {
        throw new QuizValidationError(`Quiz ${quizId} not found.`);
      }
      if (quiz.status !== QuizStatus.DRAFT) {
        throw new QuizValidationError(`Cannot reorder questions for quiz in ${quiz.status} status.`);
      }

      const currentRows = this.db.prepare(`
        SELECT question_id FROM quiz_questions WHERE quiz_id = ?
      `).all(quizId) as unknown as { question_id: string }[];

      if (currentRows.length !== questionIdsInOrder.length) {
        throw new QuizValidationError(
          `Reorder payload count (${questionIdsInOrder.length}) does not match existing question count (${currentRows.length}).`
        );
      }

      const currentIds = new Set(currentRows.map((r) => r.question_id));
      for (const qid of questionIdsInOrder) {
        if (!currentIds.has(qid)) {
          throw new QuizValidationError(
            `Question ${qid} in reorder payload does not belong to quiz ${quizId}.`
          );
        }
      }

      const uniqueSet = new Set(questionIdsInOrder);
      if (uniqueSet.size !== questionIdsInOrder.length) {
        throw new QuizValidationError('Duplicate question IDs found in reorder payload.');
      }

      // Shift existing positions to temporary high positive offsets to avoid UNIQUE constraint conflicts
      // while satisfying CHECK(sort_order >= 1)
      for (let i = 0; i < questionIdsInOrder.length; i++) {
        this.db.prepare(`
          UPDATE quiz_questions SET sort_order = ? WHERE quiz_id = ? AND question_id = ?
        `).run(1000000 + i + 1, quizId, questionIdsInOrder[i]);
      }

      // Set final [1..N] positive positions
      for (let i = 0; i < questionIdsInOrder.length; i++) {
        this.db.prepare(`
          UPDATE quiz_questions SET sort_order = ? WHERE quiz_id = ? AND question_id = ?
        `).run(i + 1, quizId, questionIdsInOrder[i]);
      }

      const now = new Date().toISOString();
      this.db.prepare(`UPDATE quizzes SET updated_at = ? WHERE id = ?`).run(now, quizId);

      return this.getQuizQuestions(organizationId, quizId);
    });
  }

  getQuizQuestions(organizationId: string, quizId: string): readonly QuizQuestionItem[] {
    // Verified join asserting organization ownership
    const stmt = this.db.prepare(`
      SELECT
        qq.quiz_id,
        qq.question_id,
        qq.sort_order,
        qq.added_at,
        q.stem,
        q.type,
        q.options_json,
        q.correct_option_indices_json,
        q.explanation,
        q.scripture_reference,
        q.topic,
        q.difficulty,
        q.language,
        q.status,
        q.created_at,
        q.updated_at
      FROM quiz_questions qq
      JOIN quizzes qz ON qz.id = qq.quiz_id
      JOIN questions q ON q.id = qq.question_id
      WHERE qq.quiz_id = ? AND qz.organization_id = ?
      ORDER BY qq.sort_order ASC
    `);

    const rows = stmt.all(quizId, organizationId) as unknown as QuizQuestionRow[];
    return rows.map((r) => ({
      quizId: r.quiz_id,
      questionId: r.question_id,
      sortOrder: r.sort_order,
      addedAt: r.added_at,
      question: r.stem
        ? {
            id: r.question_id,
            organizationId,
            stem: r.stem,
            type: r.type as QuestionType,
            options: JSON.parse(r.options_json || '[]') as string[],
            correctOptionIndices: JSON.parse(r.correct_option_indices_json || '[]') as number[],
            explanation: r.explanation || '',
            scriptureReference: r.scripture_reference || '',
            topic: r.topic || '',
            difficulty: r.difficulty as QuestionDifficulty,
            language: r.language || 'en',
            status: r.status as QuestionStatus,
            createdAt: r.created_at || '',
            updatedAt: r.updated_at || ''
          }
        : undefined
    }));
  }

  publishQuiz(organizationId: string, quizId: string, publishedByUserId: string): PublishedQuizSnapshot {
    return this.transaction(() => {
      // 1. Fetch quiz
      const quizRow = this.db.prepare(`
        SELECT * FROM quizzes WHERE id = ? AND organization_id = ?
      `).get(quizId, organizationId) as QuizRow | undefined;

      if (!quizRow) {
        throw new QuizValidationError(`Quiz ${quizId} not found.`);
      }
      if (quizRow.status !== QuizStatus.DRAFT) {
        throw new QuizValidationError(
          `Cannot publish quiz in '${quizRow.status}' status. Only DRAFT quizzes can be published.`
        );
      }

      // 2. Fetch questions in sort order
      const qqRows = this.db.prepare(`
        SELECT qq.question_id, qq.sort_order
        FROM quiz_questions qq
        WHERE qq.quiz_id = ?
        ORDER BY qq.sort_order ASC
      `).all(quizId) as unknown as { question_id: string; sort_order: number }[];

      if (qqRows.length === 0) {
        throw new QuizValidationError('Cannot publish quiz: quiz must contain at least 1 approved question.');
      }

      // 3. TOCTOU Re-Validation: re-fetch each question and verify organization & APPROVED status
      const snapshotQuestions: SnapshotQuestion[] = [];

      for (let i = 0; i < qqRows.length; i++) {
        const item = qqRows[i];
        const qRow = this.db.prepare(`
          SELECT * FROM questions WHERE id = ?
        `).get(item.question_id) as any;

        if (!qRow || qRow.organization_id !== organizationId) {
          throw new QuizValidationError(
            `Question ${item.question_id} not found or belongs to another organization.`
          );
        }
        if (qRow.status !== QuestionStatus.APPROVED) {
          throw new QuizValidationError(
            `TOCTOU Precondition Failed: Question ${item.question_id} has status '${qRow.status}'. Only APPROVED questions can be published.`
          );
        }

        const options = JSON.parse(qRow.options_json) as string[];
        const correctIndices = JSON.parse(qRow.correct_option_indices_json) as number[];

        if (!Array.isArray(options) || options.length < 2) {
          throw new QuizValidationError(
            `Question ${item.question_id} has invalid options (minimum 2 required).`
          );
        }

        const choices: SnapshotChoice[] = options.map((text, idx) => ({
          choiceIndex: idx,
          text
        }));

        snapshotQuestions.push({
          id: qRow.id,
          position: i + 1,
          stem: qRow.stem,
          type: qRow.type as QuestionType,
          choices,
          correctOptionIndices: correctIndices,
          explanation: qRow.explanation || '',
          scriptureReference: qRow.scripture_reference,
          topic: qRow.topic,
          difficulty: qRow.difficulty as QuestionDifficulty,
          timeLimitSeconds: quizRow.default_time_limit_seconds
        });
      }

      // 4. Construct complete self-contained snapshot payload
      const snapshotId = crypto.randomUUID();
      const now = new Date().toISOString();

      const snapshot: PublishedQuizSnapshot = {
        id: snapshotId,
        quizId,
        organizationId,
        title: quizRow.title,
        description: quizRow.description,
        defaultTimeLimitSeconds: quizRow.default_time_limit_seconds,
        scoringStyle: quizRow.scoring_style as ScoringStyle,
        optionShuffle: quizRow.option_shuffle === 1,
        versionNumber: 1,
        publishedAt: now,
        publishedByUserId,
        questions: snapshotQuestions
      };

      // 5. Insert into published_quiz_snapshots
      this.db.prepare(`
        INSERT INTO published_quiz_snapshots (
          id, quiz_id, organization_id, title, description,
          default_time_limit_seconds, scoring_style, option_shuffle,
          version_number, snapshot_json, published_at, published_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        snapshotId,
        quizId,
        organizationId,
        snapshot.title,
        snapshot.description,
        snapshot.defaultTimeLimitSeconds,
        snapshot.scoringStyle,
        snapshot.optionShuffle ? 1 : 0,
        snapshot.versionNumber,
        JSON.stringify(snapshot),
        snapshot.publishedAt,
        snapshot.publishedByUserId
      );

      // 6. Test Seam for Deterministic Rollback Failure Injection
      if (process.env.NODE_ENV === 'test' && this.simulateSnapshotFailure) {
        throw new Error('TEST_SIMULATED_SNAPSHOT_PERSISTENCE_FAILURE');
      }

      // 7. Update quiz status to PUBLISHED
      this.db.prepare(`
        UPDATE quizzes
        SET status = 'PUBLISHED', updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(now, quizId, organizationId);

      return snapshot;
    });
  }

  getPublishedSnapshot(organizationId: string, quizId: string): PublishedQuizSnapshot | null {
    const row = this.db.prepare(`
      SELECT * FROM published_quiz_snapshots
      WHERE quiz_id = ? AND organization_id = ?
      ORDER BY version_number DESC
      LIMIT 1
    `).get(quizId, organizationId) as PublishedSnapshotRow | undefined;

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as PublishedQuizSnapshot;
  }

  close(): void {
    this.db.close();
  }
}
