import { DatabaseSync } from 'node:sqlite';
import type { Db } from './client.ts';

/**
 * SQLite via Node's built-in driver — no dependency to install, no service to
 * run. Used for local development and by the whole test suite.
 */
export class SqliteDb implements Db {
  private readonly db: DatabaseSync;
  private readonly inTransaction: boolean;

  constructor(path = ':memory:', db?: DatabaseSync, inTransaction = false) {
    this.db = db ?? new DatabaseSync(path);
    this.inTransaction = inTransaction;
    if (!db) {
      // Referential integrity is off by default in SQLite, which quietly
      // permits assignments pointing at referrals that do not exist.
      this.db.exec('PRAGMA foreign_keys = ON');

      // Next builds pages in parallel worker processes, all of which open this
      // same file. The default journal gives one writer and an instant
      // "database is locked" for everyone else.
      //
      // busy_timeout goes FIRST. Switching to WAL itself needs a brief
      // exclusive lock, so without a timeout already in force the second
      // worker to reach this line fails on the switch rather than waiting for
      // it. Neither pragma matters in production, which is Postgres.
      this.db.exec('PRAGMA busy_timeout = 10000');
      if (path !== ':memory:') {
        try {
          this.db.exec('PRAGMA journal_mode = WAL');
        } catch {
          // Another process is mid-switch. WAL is a property of the file, so
          // whoever wins sets it for everyone and this one can carry on.
        }
      }
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const r = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(r.changes) };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    // Nested calls join the outer transaction rather than starting a second
    // one, which SQLite does not support.
    if (this.inTransaction) return fn(this);

    this.db.exec('BEGIN');
    try {
      const result = await fn(new SqliteDb(':memory:', this.db, true));
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    if (!this.inTransaction) this.db.close();
  }
}
