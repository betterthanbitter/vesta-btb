import pg from 'pg';
import { type Db, toPostgresPlaceholders } from './client.ts';

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
      // Neon, Supabase and most hosted Postgres require TLS.
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: true },
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
