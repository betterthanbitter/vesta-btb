import pg from 'pg';
import { type Db, toPostgresPlaceholders } from './client.ts';
import { SUPABASE_ROOT_CA } from './supabaseCa.ts';

/**
 * Postgres for production. Pooled, because a serverless host opens and closes
 * connections constantly and an unpooled client exhausts the server's limit
 * within a few minutes of real traffic.
 */
export class PostgresDb implements Db {
  private readonly pool: pg.Pool;
  private readonly client?: pg.PoolClient;

  constructor(connectionString: string, pool?: pg.Pool, client?: pg.PoolClient) {
    this.pool = pool ?? new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslOptions(connectionString),
    });
    this.client = client;
  }

  private get executor(): pg.Pool | pg.PoolClient {
    return this.client ?? this.pool;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const r = await this.executor.query(toPostgresPlaceholders(sql), params);
    return r.rows as T[];
  }

  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const r = await this.executor.query(toPostgresPlaceholders(sql), params);
    return { changes: r.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.executor.query(sql);
  }

  async tableColumns(table: string): Promise<string[]> {
    const rows = await this.query<{ column_name: string }>(
      'SELECT column_name FROM information_schema.columns' +
      ' WHERE table_schema = current_schema() AND table_name = ?',
      [table],
    );
    return rows.map((r) => r.column_name);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.client) return fn(this);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(new PostgresDb('', this.pool, client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (!this.client) await this.pool.end();
  }
}


/**
 * TLS settings for the connection.
 *
 * Certificate verification stays on. Supabase hosts additionally trust
 * Supabase's own root CA, which is what its database certificates are signed
 * with; without it the connection fails with "self-signed certificate in
 * certificate chain".
 *
 * DATABASE_SSL_INSECURE=1 disables verification entirely. It exists so a
 * certificate problem can never be the thing that takes the site down at an
 * awkward moment — but it means nothing checks who is answering, so treat it
 * as a temporary measure and say so in the logs every time it is used.
 */
function sslOptions(connectionString: string): pg.PoolConfig['ssl'] {
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return undefined;
  }

  if (process.env.DATABASE_SSL_INSECURE === '1') {
    console.warn(
      '[db] DATABASE_SSL_INSECURE=1 — the database certificate is NOT being verified. ' +
      'Traffic is encrypted but its destination is unauthenticated. Remove this once fixed.',
    );
    return { rejectUnauthorized: false };
  }

  const isSupabase = connectionString.includes('supabase.co')
    || connectionString.includes('supabase.com');

  return isSupabase
    ? { rejectUnauthorized: true, ca: SUPABASE_ROOT_CA }
    : { rejectUnauthorized: true };
}
