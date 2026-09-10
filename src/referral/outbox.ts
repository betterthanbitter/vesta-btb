/**
 * The outbox.
 *
 * The hub never calls Ontraport inline while handling a click. It writes an
 * intent to this outbox in the same transaction as the state change, and a
 * dispatcher drains it afterwards. That means a slow or down Ontraport can
 * never lose a referral or leave the hub's own records half-written.
 */

export type OutboxKind =
  | 'consumer.routed'
  | 'professional.assigned'
  | 'assignment.stage_changed'
  | 'referral.closed'
  /** Nothing has happened for a week. Ontraport starts the nurture. */
  | 'referral.went_cold'
  /** A professional marked the lead hired. Ask the client how it went. */
  | 'testimonial.requested'
  /** The client answered. Stop asking. */
  | 'testimonial.received';

export interface OutboxEntry {
  /**
   * Stable identity of this intent. Derived from the facts, never from a
   * clock or a random value, so that replaying the same real-world event
   * produces the same key and is recognized as a duplicate.
   */
  dedupKey: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type DeliveryState =
  /** We are about to attempt a non-idempotent call. */
  | 'claimed'
  /** The call completed and we recorded it. */
  | 'confirmed'
  /**
   * We claimed it, the call threw, and we cannot tell whether Ontraport
   * acted on it. Never retried automatically — a human decides.
   */
  | 'needs_review';

/**
 * Durable record of what has already been sent.
 *
 * Async because the real implementation is a database table — and it has to
 * be. A ledger held in memory forgets on every restart, and on a serverless
 * host that is every few minutes; worse, two instances running at once do not
 * share one, so neither can see what the other already sent. The guarantee is
 * only as durable as this.
 */
export interface LedgerStore {
  state(key: string): Promise<DeliveryState | undefined>;
  /**
   * Atomically claim a key for a non-idempotent operation. Exactly one caller
   * gets true, however many race for it. False means do not proceed.
   */
  claim(key: string): Promise<boolean>;
  confirm(key: string): Promise<void>;
  flagForReview(key: string): Promise<void>;
  /** Keys a human needs to look at. Surfaced in the back office. */
  needingReview(): Promise<string[]>;
}

/** In-memory ledger, for tests. SqlLedger is the real one. */
export class SentLedger implements LedgerStore {
  private entries = new Map<string, DeliveryState>();

  async state(key: string): Promise<DeliveryState | undefined> {
    return this.entries.get(key);
  }

  async claim(key: string): Promise<boolean> {
    if (this.entries.has(key)) return false;
    this.entries.set(key, 'claimed');
    return true;
  }

  async confirm(key: string): Promise<void> {
    this.entries.set(key, 'confirmed');
  }

  async flagForReview(key: string): Promise<void> {
    this.entries.set(key, 'needs_review');
  }

  async needingReview(): Promise<string[]> {
    return [...this.entries.entries()]
      .filter(([, v]) => v === 'needs_review')
      .map(([k]) => k);
  }
}

/** The durable outbox. SqlOutbox is the implementation. */
export interface OutboxStore {
  add(entry: OutboxEntry): Promise<void>;
  pending(limit?: number): Promise<OutboxEntry[]>;
  markDispatched(dedupKey: string): Promise<void>;
}

/**
 * An in-process buffer the domain writes to during a single operation.
 *
 * Kept synchronous on purpose: ReferralService should not be async merely
 * because a database exists. The caller collects what the operation produced
 * and flushes it into the durable OutboxStore inside the same transaction as
 * the state change, so a crash can never leave one written without the other.
 */
export class Outbox {
  private queue: OutboxEntry[] = [];

  add(entry: OutboxEntry): void {
    this.queue.push(entry);
  }

  drain(): OutboxEntry[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  get pending(): number {
    return this.queue.length;
  }
}


/**
 * Move everything the domain buffered into the durable store.
 *
 * Call inside the same transaction as the state change it accompanies. If the
 * referral is written and this is not, the professional is never told; if this
 * is written and the referral is not, we email about a referral that does not
 * exist. Both are avoided by one transaction, not by careful ordering.
 */
export async function flushOutbox(buffer: Outbox, store: OutboxStore): Promise<number> {
  const entries = buffer.drain();
  for (const entry of entries) await store.add(entry);
  return entries.length;
}
