/**
 * A very small database interface.
 *
 * Two engines sit behind it: node:sqlite for local development and the test
 * suite, Postgres in production. That is a deliberate trade — the alternative
 * was leaving the production SQL untested until a connection string existed.
 *
 * The schema is written in the intersection of both dialects, so the only
 * difference this layer has to absorb is parameter syntax: SQLite writes `?`,
 * Postgres writes `$1`. All SQL in this codebase uses `?` and the Postgres
 * driver rewrites it.
 */

export interface Db {
  /** Rows from a SELECT. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** An INSERT/UPDATE/DELETE. Returns rows affected where the engine reports it. */
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** Run several statements atomically. Rolls back if the callback throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Execute raw SQL — used only by the migration runner. */
  exec(sql: string): Promise<void>;
  /** Column names on a table, or an empty list if the table does not exist. */
  tableColumns(table: string): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Rewrite `?` placeholders as `$1, $2, …` for Postgres.
 *
 * Question marks inside string literals must be left alone, or a message
 * containing "?" would shift every following parameter by one — the kind of
 * bug that only appears when a consumer writes a question in the form.
 */
export function toPostgresPlaceholders(sql: string): string {
  let out = '';
  let n = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !inDouble) {
      // '' inside a string is an escaped quote, not the end of it.
      if (inSingle && sql[i + 1] === "'") { out += "''"; i++; continue; }
      inSingle = !inSingle;
      out += c;
      continue;
    }
    if (c === '"' && !inSingle) { inDouble = !inDouble; out += c; continue; }
    if (c === '?' && !inSingle && !inDouble) { out += `$${++n}`; continue; }
    out += c;
  }
  return out;
}
