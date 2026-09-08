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
  | 'referral.went_cold';

export interface OutboxEntry {
  /**
   * Stable identity of this intent. Derived from the facts, never from a
   * clock or a random value, so that replaying the same real-world event
   * produces the same key and is recognised as a duplicate.
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
 * In production this is a Postgres table with a unique index on `key`. The
 * in-memory version here is what the tests run against; behaviour is identical.
 */
export class SentLedger {
  private entries = new Map<string, DeliveryState>();

  state(key: string): DeliveryState | undefined {
    return this.entries.get(key);
  }

  /**
   * Attempt to claim a key for a non-idempotent operation.
   * Returns false if it was already claimed or confirmed, i.e. do not proceed.
   */
  claim(key: string): boolean {
    if (this.entries.has(key)) return false;
    this.entries.set(key, 'claimed');
    return true;
  }

  confirm(key: string): void {
    this.entries.set(key, 'confirmed');
  }

  flagForReview(key: string): void {
    this.entries.set(key, 'needs_review');
  }

  /** Keys a human needs to look at. Surfaced in the back office. */
  needingReview(): string[] {
    return [...this.entries.entries()]
      .filter(([, v]) => v === 'needs_review')
      .map(([k]) => k);
  }
}

/** A simple FIFO outbox. Postgres-backed in production. */
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
