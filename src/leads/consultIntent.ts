/**
 * "Schedule free consult" was clicked.
 *
 * An important distinction the dashboard must preserve: this records that a
 * consumer *asked* to book, not that a meeting exists. The booking itself
 * happens on the professional's own scheduler, which we cannot see. Telling a
 * professional "you have a meeting" when someone merely clicked would be worse
 * than telling them nothing — they would stop trusting the dashboard the first
 * time nobody turned up.
 *
 * Confirming an actual booking needs a webhook from the scheduling product.
 * Calendly and Acuity both offer one; until that is wired, intent is all we
 * honestly have.
 */

export interface ConsultIntent {
  id: string;
  professionalId: string;
  /** Where on the site the click happened, e.g. /boston-ma/family-law. */
  sourcePath: string;
  /** Scheduler host the consumer was sent to, for the professional's context. */
  destinationHost: string;
  at: string;
  /** Opaque per-browser id. Never an IP, never anything identifying. */
  visitorKey: string;
}

export interface ConsultIntentStore {
  record(intent: ConsultIntent): Promise<void>;
  /** Intents for one professional, newest first. */
  forProfessional(professionalId: string): Promise<ConsultIntent[]>;
  /** Has this visitor already been counted for this professional recently? */
  recentlySeen(professionalId: string, visitorKey: string, withinMs: number): Promise<boolean>;
}

/** How long before the same visitor clicking again counts as a new intent. */
export const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000; // six hours

/**
 * Decide whether a click becomes a new lead notification.
 *
 * Someone opening the scheduler, closing it, and trying again ten minutes
 * later is one interested person, not two leads. A professional whose
 * dashboard cries wolf stops reading it.
 */
export async function recordConsultIntent(
  store: ConsultIntentStore,
  intent: ConsultIntent,
): Promise<{ recorded: boolean; reason?: string }> {
  const seen = await store.recentlySeen(intent.professionalId, intent.visitorKey, DEDUP_WINDOW_MS);
  if (seen) {
    return { recorded: false, reason: 'same visitor within the dedup window' };
  }
  await store.record(intent);
  return { recorded: true };
}

/** In-memory store — used by the tests and as the shape the database follows. */
export class MemoryConsultIntentStore implements ConsultIntentStore {
  private rows: ConsultIntent[] = [];

  async record(intent: ConsultIntent): Promise<void> {
    this.rows.push(intent);
  }

  async forProfessional(professionalId: string): Promise<ConsultIntent[]> {
    return this.rows
      .filter((r) => r.professionalId === professionalId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async recentlySeen(professionalId: string, visitorKey: string, withinMs: number): Promise<boolean> {
    const cutoff = Date.now() - withinMs;
    return this.rows.some(
      (r) => r.professionalId === professionalId
        && r.visitorKey === visitorKey
        && Date.parse(r.at) >= cutoff,
    );
  }

  get all(): ConsultIntent[] { return [...this.rows]; }
}
