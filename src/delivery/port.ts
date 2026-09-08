/**
 * The only surface through which anything reaches the delivery engine.
 * Ontraport today; any other engine tomorrow, by writing one adapter.
 *
 * Two kinds of operation live here, and the difference is the whole safety
 * story of this integration:
 *
 *   - `upsertContact` and `setFields` are NATURALLY IDEMPOTENT. Running them
 *     twice writes the same values twice and the contact ends up identical.
 *     A retry is harmless.
 *
 *   - `startSequence` is NOT. Running it twice can enrol a contact in the same
 *     sequence twice, and the consumer gets every email in it twice. This is
 *     the failure everyone has in mind when they say "make sure we don't spam
 *     people", and it is the only operation that genuinely needs guarding.
 *
 * Because of that split, the dispatcher records a durable "already did this"
 * ledger entry BEFORE calling a non-idempotent operation, and only the
 * non-idempotent operations are gated on it.
 */

export interface ContactUpsert {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface DeliveryEngine {
  /** Create or update a contact, matched on email. Idempotent. */
  upsertContact(contact: ContactUpsert): Promise<{ contactId: string }>;

  /** Write custom fields on a contact. Idempotent. */
  setFields(contactId: string, fields: Record<string, string | number>): Promise<void>;

  /** Enrol a contact in a sequence. NOT idempotent — must be guarded. */
  startSequence(contactId: string, sequenceId: string): Promise<void>;

  /** Remove a contact from a sequence. Idempotent in effect. */
  stopSequence(contactId: string, sequenceId: string): Promise<void>;
}

/** Thrown for transport failures that are worth retrying. */
export class DeliveryTransientError extends Error {
  readonly retryable = true;
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryTransientError';
  }
}
