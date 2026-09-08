import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { BreakpeekContentItem, BreakpeekContentSourceDefinition } from '../content-types.ts'

export interface CachedContentSnapshot {
  revision: string
  generatedAt: string
  checkedAt: string
  etag: string | null
  sources: BreakpeekContentSourceDefinition[]
  items: BreakpeekContentItem[]
}

interface StateRow {
  revision: string
  generated_at: string
  checked_at: string
  etag: string | null
}

interface JsonRow { json: string }

/** Small last-known-good SQLite cache owned by the Host plugin. */
export class ContentCache {
  private constructor(private readonly db: DatabaseSync) {}

  static async open(path: string): Promise<ContentCache> {
    if (path !== ':memory:') await mkdir(dirname(path), { recursive: true })
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(path)
    try {
      db.exec('PRAGMA trusted_schema = OFF; PRAGMA foreign_keys = ON;')
      db.exec(`
        CREATE TABLE IF NOT EXISTS breakpeek_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          revision TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          checked_at TEXT NOT NULL,
          etag TEXT
        ) STRICT;
        CREATE TABLE IF NOT EXISTS breakpeek_sources (
          position INTEGER PRIMARY KEY,
          json TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS breakpeek_items (
          position INTEGER PRIMARY KEY,
          source_id TEXT NOT NULL,
          json TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS breakpeek_items_source ON breakpeek_items(source_id, position);
      `)
      return new ContentCache(db)
    } catch (error) {
      db.close()
      throw error
    }
  }

  load(): CachedContentSnapshot | null {
    const state = this.db.prepare('SELECT revision, generated_at, checked_at, etag FROM breakpeek_state WHERE singleton = 1').get() as StateRow | undefined
    if (state === undefined) return null
    const sources = (this.db.prepare('SELECT json FROM breakpeek_sources ORDER BY position').all() as unknown as JsonRow[])
      .map(row => JSON.parse(row.json) as BreakpeekContentSourceDefinition)
    const items = (this.db.prepare('SELECT json FROM breakpeek_items ORDER BY position').all() as unknown as JsonRow[])
      .map(row => JSON.parse(row.json) as BreakpeekContentItem)
    return {
      revision: state.revision,
      generatedAt: state.generated_at,
      checkedAt: state.checked_at,
      etag: state.etag,
      sources,
      items,
    }
  }

  replace(snapshot: CachedContentSnapshot): void {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.exec('DELETE FROM breakpeek_items; DELETE FROM breakpeek_sources; DELETE FROM breakpeek_state;')
      const insertSource = this.db.prepare('INSERT INTO breakpeek_sources(position, json) VALUES (?, ?)')
      snapshot.sources.forEach((source, index) => { insertSource.run(index, JSON.stringify(source)) })
      const insertItem = this.db.prepare('INSERT INTO breakpeek_items(position, source_id, json) VALUES (?, ?, ?)')
      snapshot.items.forEach((item, index) => { insertItem.run(index, item.sourceId, JSON.stringify(item)) })
      this.db.prepare('INSERT INTO breakpeek_state(singleton, revision, generated_at, checked_at, etag) VALUES (1, ?, ?, ?, ?)')
        .run(snapshot.revision, snapshot.generatedAt, snapshot.checkedAt, snapshot.etag)
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.db.close()
  }
}
