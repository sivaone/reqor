import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { HISTORY_MAX_ENTRIES } from './constants.js'

type SqliteDatabase = InstanceType<typeof Database>

export interface HistoryInsertInput {
  sentAt: string
  environmentName: string | null
  collectionId: string
  fingerprint: string
  method: string
  url: string
  statusCode: number
  statusText: string
  durationMs: number
  sizeBytes: number
  responseHeaders: Array<{ name: string; value: string }>
  responseBody: string
}

export interface HistoryRow {
  id: number
  sentAt: string
  environmentName: string | null
  collectionId: string
  fingerprint: string
  method: string
  url: string
  statusCode: number
  statusText: string
  durationMs: number
  sizeBytes: number
  responseHeaders: Array<{ name: string; value: string }>
  responseBody: string
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS history_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at TEXT NOT NULL,
  environment_name TEXT,
  collection_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  status_text TEXT NOT NULL,
  duration_ms REAL NOT NULL,
  size_bytes INTEGER NOT NULL,
  response_headers_json TEXT NOT NULL,
  response_body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_sent_at ON history_entries (sent_at DESC, id DESC);
`

function parseResponseHeaders(raw: string): Array<{ name: string; value: string }> {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed as Array<{ name: string; value: string }>
  } catch {
    return []
  }
}

function rowFromDb(row: Record<string, unknown>): HistoryRow {
  return {
    id: row.id as number,
    sentAt: row.sent_at as string,
    environmentName: (row.environment_name as string | null) ?? null,
    collectionId: row.collection_id as string,
    fingerprint: row.fingerprint as string,
    method: row.method as string,
    url: row.url as string,
    statusCode: row.status_code as number,
    statusText: row.status_text as string,
    durationMs: row.duration_ms as number,
    sizeBytes: row.size_bytes as number,
    responseHeaders: parseResponseHeaders(row.response_headers_json as string),
    responseBody: row.response_body as string,
  }
}

export class HistoryStore {
  private db: SqliteDatabase | null = null

  constructor(private readonly dbPath: string) {}

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private ensureOpen(): SqliteDatabase {
    if (this.db) {
      return this.db
    }

    try {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.ensureSchema()
      return this.db
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to open history database')
    }
  }

  ensureSchema(): void {
    const db = this.db ?? this.ensureOpen()
    db.exec(SCHEMA_SQL)
  }

  insert(entry: HistoryInsertInput): number {
    const db = this.ensureOpen()

    const insertRow = db.prepare(`
      INSERT INTO history_entries (
        sent_at, environment_name, collection_id, fingerprint, method, url,
        status_code, status_text, duration_ms, size_bytes,
        response_headers_json, response_body
      ) VALUES (
        @sentAt, @environmentName, @collectionId, @fingerprint, @method, @url,
        @statusCode, @statusText, @durationMs, @sizeBytes,
        @responseHeadersJson, @responseBody
      )
    `)

    const deleteOldest = db.prepare(`
      DELETE FROM history_entries WHERE id IN (
        SELECT id FROM history_entries ORDER BY sent_at ASC, id ASC LIMIT ?
      )
    `)

    const countRows = db.prepare('SELECT COUNT(*) AS count FROM history_entries')

    const run = db.transaction(() => {
      const result = insertRow.run({
        sentAt: entry.sentAt,
        environmentName: entry.environmentName,
        collectionId: entry.collectionId,
        fingerprint: entry.fingerprint,
        method: entry.method,
        url: entry.url,
        statusCode: entry.statusCode,
        statusText: entry.statusText,
        durationMs: entry.durationMs,
        sizeBytes: entry.sizeBytes,
        responseHeadersJson: JSON.stringify(entry.responseHeaders),
        responseBody: entry.responseBody,
      })

      const count = (countRows.get() as { count: number }).count
      if (count > HISTORY_MAX_ENTRIES) {
        deleteOldest.run(count - HISTORY_MAX_ENTRIES)
      }

      return Number(result.lastInsertRowid)
    })

    return run()
  }

  list(): HistoryRow[] {
    if (!this.db && !fs.existsSync(this.dbPath)) {
      return []
    }

    const db = this.ensureOpen()
    const rows = db
      .prepare(
        'SELECT * FROM history_entries ORDER BY sent_at DESC, id DESC',
      )
      .all() as Record<string, unknown>[]

    return rows.map(rowFromDb)
  }

  getById(id: number): HistoryRow | null {
    if (!this.db && !fs.existsSync(this.dbPath)) {
      return null
    }

    const db = this.ensureOpen()
    const row = db
      .prepare('SELECT * FROM history_entries WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined

    return row ? rowFromDb(row) : null
  }
}
