import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  url        TEXT NOT NULL UNIQUE,
  clicks     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

/**
 * Open a SQLite database and make sure the schema exists.
 *
 * @param {string} filename Path to the database file, or ":memory:".
 * @returns {DatabaseSync}
 */
export function openDb(filename) {
  const db = new DatabaseSync(filename);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);

  return db;
}
