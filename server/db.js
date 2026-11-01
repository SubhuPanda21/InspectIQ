import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'images'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'inspectiq.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      asset TEXT NOT NULL DEFAULT '',
      inspector TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'upload',
      sensitivity REAL NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      defects TEXT NOT NULL,
      truth TEXT
    );
    CREATE INDEX IF NOT EXISTS insp_client ON inspections (client_id, created_at DESC);
  `);
  return db;
}

/** Deletes expired rows and their image files. */
export function purgeOld(db, dataDir, days) {
  const rows = db.prepare('SELECT id FROM inspections WHERE created_at < ?').all(Date.now() - days * 86400000);
  rows.forEach((r) => { try { fs.unlinkSync(path.join(dataDir, 'images', r.id + '.png')); } catch { /* already gone */ } });
  db.prepare('DELETE FROM inspections WHERE created_at < ?').run(Date.now() - days * 86400000);
  return rows.length;
}
