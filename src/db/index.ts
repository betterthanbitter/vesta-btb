import { join } from 'node:path';
import type { Db } from './client.ts';
import { SqliteDb } from './sqlite.ts';
import { PostgresDb } from './postgres.ts';
import { SCHEMA_SQL } from './schema.ts';

/**
 * Pick a database and make sure the schema is present.
 *
 * DATABASE_URL set  → Postgres (production, and any developer who wants it).
 * Otherwise         → SQLite in data/vesta.db, or in memory for tests.
 */
export async function openDb(url = process.env.DATABASE_URL): Promise<Db> {
  if (url) {
    const db = new PostgresDb(url);
    await migrate(db);
    return db;
  }

  // No DATABASE_URL. On a serverless host the filesystem is read-only and
  // wiped between invocations, so a file would either fail to open or silently
  // lose every lead. In memory it at least works — but the data is gone the
  // moment the instance recycles, so say so loudly rather than let someone
  // believe leads are being kept.
  const serverless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (serverless) {
    console.warn(
      '[db] DATABASE_URL is not set. Running on in-memory SQLite: the site works, ' +
      'but every lead is lost when this instance recycles. Set DATABASE_URL.',
    );
  }

  const db = new SqliteDb(
    serverless || process.env.NODE_ENV === 'test'
      ? ':memory:'
      : join(process.cwd(), 'data', 'vesta.db'),
  );
  await migrate(db);
  return db;
}

/** For tests: a fresh, empty, migrated database with no files touched. */
export async function openTestDb(): Promise<Db> {
  const db = new SqliteDb(':memory:');
  await migrate(db);
  return db;
}

/**
 * Apply the schema. Every statement is CREATE ... IF NOT EXISTS, so running
 * this on every boot is safe and idempotent — which is what we want on a
 * serverless host where there is no deploy step to hang a migration off.
 */
export async function migrate(db: Db): Promise<void> {
  // Statement at a time rather than one big exec. Supabase's transaction
  // pooler and some other proxies reject multi-statement queries, and the
  // resulting error is impenetrable if you are not a database person.
  for (const statement of splitStatements(SCHEMA_SQL)) {
    await db.exec(statement);
  }
}

/** Split on semicolons that end a statement, ignoring those inside comments. */
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export type { Db } from './client.ts';
