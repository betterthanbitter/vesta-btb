import type { Db } from './client.ts';
import type { ConsultIntent, ConsultIntentStore } from '../leads/consultIntent.ts';
import type { ConsultRequest } from '../leads/consultRequest.ts';
import type { ConsultRequestStore } from '../leads/store.ts';
import type { DeliveryState, LedgerStore, OutboxEntry, OutboxStore } from '../referral/outbox.ts';

export class SqlConsultIntentStore implements ConsultIntentStore {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async record(i: ConsultIntent): Promise<void> {
    await this.db.run(
      'INSERT INTO consult_intents' +
      ' (id, professional_id, source_path, destination_host, visitor_key, at)' +
      ' VALUES (?, ?, ?, ?, ?, ?)',
      [i.id, i.professionalId, i.sourcePath, i.destinationHost, i.visitorKey, i.at],
    );
  }

  async forProfessional(professionalId: string): Promise<ConsultIntent[]> {
    const rows = await this.db.query<any>(
      'SELECT * FROM consult_intents WHERE professional_id = ? ORDER BY at DESC',
      [professionalId],
    );
    return rows.map(toIntent);
  }

  async recentlySeen(professionalId: string, visitorKey: string, withinMs: number): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinMs).toISOString();
    const rows = await this.db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM consult_intents' +
      ' WHERE professional_id = ? AND visitor_key = ? AND at >= ?',
      [professionalId, visitorKey, cutoff],
    );
    return Number(rows[0]?.n ?? 0) > 0;
  }
}

export class SqlConsultRequestStore implements ConsultRequestStore {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async record(r: ConsultRequest): Promise<void> {
    await this.db.run(
      'INSERT INTO consult_requests' +
      ' (id, professional_id, name, email, phone, message, source_path, at)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.professionalId, r.name, r.email, r.phone ?? null, r.message ?? null, r.sourcePath, r.at],
    );
  }

  async forProfessional(professionalId: string): Promise<ConsultRequest[]> {
    const rows = await this.db.query<any>(
      'SELECT * FROM consult_requests WHERE professional_id = ? ORDER BY at DESC',
      [professionalId],
    );
    return rows.map(toRequest);
  }

  async all(): Promise<ConsultRequest[]> {
    return (await this.db.query<any>('SELECT * FROM consult_requests ORDER BY at DESC')).map(toRequest);
  }
}

/**
 * The durable ledger.
 *
 * `claim` is one atomic INSERT ... ON CONFLICT DO NOTHING. Whether two workers
 * race on the same key, or the same key arrives twice a second apart, exactly
 * one INSERT reports a row and every other caller sees zero. That single
 * property is the whole no-double-send guarantee — and it is why this belongs
 * in the database and not in a Map, which forgets on every restart and is not
 * shared between instances at all.
 */
export class SqlLedger implements LedgerStore {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async claim(key: string): Promise<boolean> {
    const r = await this.db.run(
      'INSERT INTO sent_ledger (key, state, updated_at) VALUES (?, ?, ?)' +
      ' ON CONFLICT (key) DO NOTHING',
      [key, 'claimed', new Date().toISOString()],
    );
    return r.changes === 1;
  }

  async confirm(key: string): Promise<void> {
    await this.setState(key, 'confirmed');
  }

  async flagForReview(key: string): Promise<void> {
    await this.setState(key, 'needs_review');
  }

  async state(key: string): Promise<DeliveryState | undefined> {
    const rows = await this.db.query<{ state: DeliveryState }>(
      'SELECT state FROM sent_ledger WHERE key = ?', [key],
    );
    return rows[0]?.state;
  }

  async needingReview(): Promise<string[]> {
    const rows = await this.db.query<{ key: string }>(
      "SELECT key FROM sent_ledger WHERE state = 'needs_review' ORDER BY updated_at DESC",
    );
    return rows.map((r) => r.key);
  }

  private async setState(key: string, state: DeliveryState): Promise<void> {
    await this.db.run(
      'INSERT INTO sent_ledger (key, state, updated_at) VALUES (?, ?, ?)' +
      ' ON CONFLICT (key) DO UPDATE SET state = ?, updated_at = ?',
      [key, state, new Date().toISOString(), state, new Date().toISOString()],
    );
  }
}

/** Durable outbox. An intent survives a crash between writing and dispatching. */
export class SqlOutbox implements OutboxStore {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async add(entry: OutboxEntry): Promise<void> {
    // The same real-world event produces the same dedup key, so a repeat is a
    // duplicate and is dropped here rather than queued twice.
    await this.db.run(
      'INSERT INTO outbox (dedup_key, kind, payload, created_at) VALUES (?, ?, ?, ?)' +
      ' ON CONFLICT (dedup_key) DO NOTHING',
      [entry.dedupKey, entry.kind, JSON.stringify(entry.payload), entry.createdAt],
    );
  }

  async pending(limit = 200): Promise<OutboxEntry[]> {
    const rows = await this.db.query<any>(
      'SELECT * FROM outbox WHERE dispatched_at IS NULL ORDER BY created_at LIMIT ?', [limit],
    );
    return rows.map((r) => ({
      dedupKey: r.dedup_key,
      kind: r.kind,
      payload: JSON.parse(r.payload),
      createdAt: r.created_at,
    }));
  }

  async markDispatched(dedupKey: string): Promise<void> {
    await this.db.run('UPDATE outbox SET dispatched_at = ? WHERE dedup_key = ?',
      [new Date().toISOString(), dedupKey]);
  }
}

function toIntent(r: any): ConsultIntent {
  return {
    id: r.id, professionalId: r.professional_id, sourcePath: r.source_path,
    destinationHost: r.destination_host, visitorKey: r.visitor_key, at: r.at,
  };
}

function toRequest(r: any): ConsultRequest {
  return {
    id: r.id, professionalId: r.professional_id, name: r.name, email: r.email,
    phone: r.phone ?? undefined, message: r.message ?? undefined,
    sourcePath: r.source_path, at: r.at,
  };
}
