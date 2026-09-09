/**
 * Domain types for the referral system.
 *
 * The hub is the system of record for referrals. Ontraport is the delivery
 * engine. Nothing in this file knows how to send an email.
 */

export type HubSlug = string;
export type CategorySlug = string;
export type Tier = 'platinum' | 'premium' | 'standard';

export type RoutingMode =
  /** Consumer was shown a shortlist and picks who to talk to. */
  | 'consumer-choice'
  /** Concierge sent it to exactly one professional. */
  | 'direct';

/**
 * Where a professional has got to with one lead.
 *
 * These are the words the concierge desk already uses, not invented ones. Two
 * distinctions matter and are easy to lose:
 *
 *   - "did not respond" is NOT the end. It is the state that prompts a follow
 *     up, and a lead can go round that loop more than once.
 *   - "responded" and "interested" are different. Someone can reply promptly
 *     and still not want to hire you, and a professional who is asked to
 *     conflate the two will stop recording either accurately.
 */
export type Stage =
  /** Sent to the professional; nothing has happened yet. */
  | 'new'
  | 'contacted'
  | 'responded'
  | 'did_not_respond'
  | 'followed_up'
  | 'interested'
  | 'hired'
  | 'dead_lead';

export const STAGE_LABELS: Record<Stage, string> = {
  new: 'New',
  contacted: 'Contacted',
  responded: 'Responded',
  did_not_respond: 'Did not respond',
  followed_up: 'Followed up',
  interested: 'Interested',
  hired: 'Hired',
  dead_lead: 'Dead lead',
};

/** Stages after which nothing more happens for this professional. */
export const TERMINAL_STAGES: readonly Stage[] = ['hired', 'dead_lead'] as const;

export function isTerminal(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** Stages where the ball is in the professional's court. */
export const AWAITING_PROFESSIONAL: readonly Stage[] = [
  'new', 'did_not_respond', 'responded',
] as const;

export interface Consumer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hub: HubSlug;
  categoryNeeded: CategorySlug;
  stageOfDivorce?: string;
}

export interface Professional {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  firm: string;
  hub: HubSlug;
  category: CategorySlug;
  tier: Tier;
}

export interface Assignment {
  professionalId: string;
  stage: Stage;
  stageChangedAt: string;
}

export interface Referral {
  id: string;
  consumerId: string;
  hub: HubSlug;
  category: CategorySlug;
  mode: RoutingMode;
  /** When the concierge clicked Route. Every response-time metric starts here. */
  routedAt: string;
  assignments: Assignment[];
  /** Set when a professional reaches `hired`. */
  closedAt?: string;
}
