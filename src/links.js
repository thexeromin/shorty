import { generateCode, isReserved } from "./shortcode.js";

const MAX_CODE_ATTEMPTS = 5;

/**
 * Create the data-access layer for links.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 */
export function createLinksRepo(db) {
  const listStmt = db.prepare(`
    SELECT id, code, url, clicks, created_at
    FROM links
    ORDER BY id DESC
  `);
  const findByCodeStmt = db.prepare(
    "SELECT id, code, url, clicks, created_at FROM links WHERE code = ?",
  );
  const findByUrlStmt = db.prepare(
    "SELECT id, code, url, clicks, created_at FROM links WHERE url = ?",
  );
  const insertStmt = db.prepare("INSERT INTO links (code, url) VALUES (?, ?)");
  const getUrlStmt = db.prepare("SELECT url FROM links WHERE code = ?");
  const incrementStmt = db.prepare(
    "UPDATE links SET clicks = clicks + 1 WHERE code = ?",
  );
  const deleteStmt = db.prepare("DELETE FROM links WHERE code = ?");

  return {
    /** @returns {Array<object>} */
    list() {
      return listStmt.all();
    },

    /**
     * @param {string} code
     * @returns {object | undefined}
     */
    get(code) {
      return findByCodeStmt.get(code);
    },

    /**
     * Return the existing link for a URL, or create a new one.
     *
     * @param {string} url Already validated and normalized URL.
     * @returns {object}
     */
    getOrCreate(url) {
      const existing = findByUrlStmt.get(url);
      if (existing) return existing;

      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        const code = generateCode();
        if (isReserved(code)) continue;

        try {
          insertStmt.run(code, url);
          return findByCodeStmt.get(code);
        } catch (error) {
          // Collision with another code: try again.
          if (isUniqueViolation(error, "links.code")) continue;

          // Another process inserted the same URL first: return that row.
          if (isUniqueViolation(error, "links.url")) {
            const raced = findByUrlStmt.get(url);
            if (raced) return raced;
          }

          throw error;
        }
      }

      throw new Error("Could not generate a unique short code");
    },

    /**
     * Increment the click counter and return the link.
     *
     * @param {string} code
     * @returns {object | undefined}
     */
    registerClick(code) {
      const row = getUrlStmt.get(code);
      if (!row) return undefined;

      incrementStmt.run(code);
      return row;
    },

    /**
     * @param {string} code
     * @returns {boolean} Whether a row was deleted.
     */
    remove(code) {
      return deleteStmt.run(code).changes > 0;
    },
  };
}

/**
 * @param {unknown} error
 * @param {string} target
 * @returns {boolean}
 */
function isUniqueViolation(error, target) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes(target)
  );
}
