/**
 * Domain types for the referral system.
 *
 * The hub is the system of record for referrals. Ontraport is the delivery
 * engine. Nothing in this file knows how to send an email, and that is
 * deliberate — see docs/architecture.md.
 */

/** A city hub, e.g. "boston". Slugs are the SEO URL segment. */
export type HubSlug = string;

/** A professional category, e.g. "family-law-mediation". */
export type CategorySlug = string;

export type Tier = 'platinum' | 'premium' | 'standard';

/** How the concierge routed this referral. */
export type RoutingMode =
  /** Consumer was shown a shortlist and picks who to talk to. */
  | 'consumer-choice'
  /** Concierge sent it to exactly one professional. */
  | 'direct';

/**
 * Stage of one professional's work on one referral.
 *
 * This is what the professional clicks in their dashboard. It is owned by the
 * hub and pushed to Ontraport as a single field — never as a pile of tags.
 */
export type Stage =
  | 'routed'
  | 'viewed'
  | 'contacted'
  | 'consulted'
  | 'retained'
  | 'declined'
  | 'no_response'
  | 'withdrawn';

/** Stages after which nothing more happens for this professional. */
export const TERMINAL_STAGES: readonly Stage[] = [
  'retained',
  'declined',
  'no_response',
  'withdrawn',
] as const;

export function isTerminal(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export interface Consumer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hub: HubSlug;
  categoryNeeded: CategorySlug;
  /** Free text from the concierge questionnaire, e.g. "considering", "filed". */
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

/** One professional's assignment on a referral. */
export interface Assignment {
  professionalId: string;
  stage: Stage;
  /** ISO timestamp of the most recent stage change. */
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
  /** Set when a professional reaches `retained`. */
  closedAt?: string;
}
