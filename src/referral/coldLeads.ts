/**
 * Leads that have gone cold, and the nurture they trigger.
 *
 * The division of labour is the same one the whole integration rests on: the
 * hub decides a lead is cold, because the hub owns the stage. Ontraport runs
 * the nurture, because Ontraport sends. The hub writes one intent to the
 * outbox and stops caring what the sequence contains.
 *
 * "Cold" is measured from the last stage change, not from when the referral
 * was created. A professional who contacted someone on day six has not gone
 * cold on day seven.
 */

import type { Outbox, OutboxEntry } from './outbox.ts';
import { type Referral, type Stage, isTerminal } from './types.ts';

export interface ColdLeadPolicy {
  /** Nothing has happened for this long — nudge. */
  staleAfterMs: number;
  /** Stages that can go cold. A lead already declined cannot. */
  watchedStages: readonly Stage[];
}

export const DEFAULT_COLD_POLICY: ColdLeadPolicy = {
  staleAfterMs: 7 * 24 * 60 * 60 * 1000, // one week
  watchedStages: ['routed', 'viewed', 'contacted'],
};

export interface ColdLead {
  referralId: string;
  professionalId: string;
  stage: Stage;
  /** Whole days since anything last happened. */
  daysStale: number;
}

export function findColdLeads(
  referrals: Referral[],
  now: Date = new Date(),
  policy: ColdLeadPolicy = DEFAULT_COLD_POLICY,
): ColdLead[] {
  const out: ColdLead[] = [];
  for (const referral of referrals) {
    // A referral someone has already won is not cold, whatever the others say.
    if (referral.closedAt) continue;

    for (const a of referral.assignments) {
      if (isTerminal(a.stage)) continue;
      if (!policy.watchedStages.includes(a.stage)) continue;

      const elapsed = now.getTime() - Date.parse(a.stageChangedAt);
      if (elapsed < policy.staleAfterMs) continue;

      out.push({
        referralId: referral.id,
        professionalId: a.professionalId,
        stage: a.stage,
        daysStale: Math.floor(elapsed / (24 * 60 * 60 * 1000)),
      });
    }
  }
  return out.sort((a, b) => b.daysStale - a.daysStale);
}

/**
 * Write the nurture triggers.
 *
 * The dedup key includes the stage, so a lead that has sat at "routed" for
 * three weeks triggers nurture once rather than every time this runs. Moving
 * to "contacted" and going cold again is a different key, and triggers again —
 * which is correct, because it is a different situation.
 */
export function emitNurtureTriggers(
  outbox: Outbox,
  cold: ColdLead[],
  now: Date = new Date(),
): OutboxEntry[] {
  const entries = cold.map((c) => ({
    kind: 'referral.went_cold' as const,
    dedupKey: `referral:${c.referralId}:pro:${c.professionalId}:cold:${c.stage}`,
    payload: {
      referralId: c.referralId,
      professionalId: c.professionalId,
      stage: c.stage,
      daysStale: c.daysStale,
    },
    createdAt: now.toISOString(),
  }));
  for (const e of entries) outbox.add(e);
  return entries;
}
