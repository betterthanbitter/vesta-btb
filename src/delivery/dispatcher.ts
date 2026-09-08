import { type OutboxEntry, type SentLedger } from '../referral/outbox.ts';
import { type DeliveryEngine } from './port.ts';

/** Sequence ids configured in the delivery engine. */
export interface SequenceMap {
  consumerAfterRouting: string;
  professionalNewLead: string;
}

export interface DispatchReport {
  delivered: number;
  skippedAsDuplicate: number;
  /** Non-idempotent calls whose outcome is unknown. A human decides. */
  flaggedForReview: string[];
  /** Entries that failed on a safe, repeatable call. Retry these as-is. */
  retryable: string[];
}

/**
 * Drains the outbox into the delivery engine.
 *
 * Retry policy, stated plainly because it is a business decision, not a
 * technical one:
 *
 *   - Idempotent writes (contact upserts, field writes) are retried freely.
 *   - A sequence start is claimed in the ledger BEFORE the call. If the call
 *     then fails, we cannot know whether the engine enrolled the contact, so
 *     we do NOT retry it. It is flagged for a human in the back office.
 *
 * That trades a rare missed email for never double-emailing someone in the
 * middle of a divorce. If you would rather have the opposite trade, this is
 * the one place to change it.
 */
export class Dispatcher {
  private readonly engine: DeliveryEngine;
  private readonly ledger: SentLedger;
  private readonly sequences: SequenceMap;

  constructor(engine: DeliveryEngine, ledger: SentLedger, sequences: SequenceMap) {
    this.engine = engine;
    this.ledger = ledger;
    this.sequences = sequences;
  }

  async dispatch(entries: OutboxEntry[]): Promise<DispatchReport> {
    const report: DispatchReport = {
      delivered: 0, skippedAsDuplicate: 0, flaggedForReview: [], retryable: [],
    };

    // One bad entry must never abandon the rest of the batch. If professional
    // three is unreachable, professionals one and two still get their lead.
    for (const entry of entries) {
      try {
        switch (entry.kind) {
          case 'consumer.routed':
            await this.handleRouted(entry, report, 'consumer');
            break;
          case 'professional.assigned':
            await this.handleRouted(entry, report, 'professional');
            break;
          case 'assignment.stage_changed':
            await this.handleStageChange(entry, report);
            break;
          case 'referral.closed':
            await this.handleClosed(entry, report);
            break;
        }
      } catch {
        // Reached only from the idempotent phase, which is safe to repeat.
        // The guarded sequence start handles its own failures and never
        // throws, so nothing here can cause a double-send.
        report.retryable.push(entry.dedupKey);
      }
    }
    return report;
  }

  /**
   * Retry wrapper for calls that are safe to repeat. Used only for contact
   * upserts and field writes — never for a sequence start.
   */
  private async idempotent<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        last = err;
      }
    }
    throw last;
  }

  private async handleRouted(
    entry: OutboxEntry,
    report: DispatchReport,
    side: 'consumer' | 'professional',
  ): Promise<void> {
    const p = entry.payload as any;
    const person = side === 'consumer' ? p.consumer : p.professional;

    // Idempotent half — always safe to repeat.
    const { contactId } = await this.idempotent(() =>
      this.engine.upsertContact({
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
      }),
    );

    await this.idempotent(() => this.engine.setFields(
      contactId,
      side === 'consumer'
        ? {
            city_hub: p.consumer.hub,
            category_needed: p.consumer.categoryNeeded,
            stage_of_divorce: p.consumer.stageOfDivorce ?? '',
            referral_id: p.referralId,
            professionals_shortlisted: (p.shortlist as string[]).join(', '),
            routing_mode: p.mode,
            referral_status: 'routed',
          }
        : {
            city_hub: p.professional.hub,
            category: p.professional.category,
            tier: p.professional.tier,
            referral_id: p.referralId,
            referral_status: 'routed',
            lead_first_name: p.consumer.firstName,
          },
    ));

    // Non-idempotent half — guarded.
    const seq =
      side === 'consumer' ? this.sequences.consumerAfterRouting : this.sequences.professionalNewLead;
    await this.guardedSequenceStart(`${entry.dedupKey}:seq:${seq}`, contactId, seq, report);
  }

  private async handleStageChange(entry: OutboxEntry, report: DispatchReport): Promise<void> {
    const p = entry.payload as any;
    // A stage change is one field write. Idempotent, so no ledger needed.
    const { contactId } = await this.engine.upsertContact({ email: p.professionalEmail ?? '' });
    await this.engine.setFields(contactId, { referral_status: p.stage });
    report.delivered++;
  }

  private async handleClosed(entry: OutboxEntry, report: DispatchReport): Promise<void> {
    const p = entry.payload as any;
    const { contactId } = await this.engine.upsertContact({ email: p.consumerEmail ?? '' });
    await this.engine.stopSequence(contactId, this.sequences.consumerAfterRouting);
    await this.engine.setFields(contactId, { referral_status: 'closed' });
    report.delivered++;
  }

  private async guardedSequenceStart(
    key: string,
    contactId: string,
    sequenceId: string,
    report: DispatchReport,
  ): Promise<void> {
    if (!this.ledger.claim(key)) {
      report.skippedAsDuplicate++;
      return;
    }
    try {
      await this.engine.startSequence(contactId, sequenceId);
      this.ledger.confirm(key);
      report.delivered++;
    } catch {
      // We do not know whether the engine acted. Never guess in this
      // direction — hand it to a person.
      this.ledger.flagForReview(key);
      report.flaggedForReview.push(key);
    }
  }
}
