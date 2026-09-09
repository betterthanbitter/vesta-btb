import { type Stage, isTerminal } from './types.ts';

/**
 * Legal stage transitions.
 *
 * Forwards and sideways are allowed; backwards is not, and a terminal stage is
 * final. The one loop that matters is
 *
 *   contacted → did_not_respond → followed_up → did_not_respond → …
 *
 * because chasing someone twice is normal and the dashboard has to be able to
 * record it. Every stage can reach dead_lead: a professional must always be
 * able to close a lead without inventing an outcome that did not happen.
 */
const ALLOWED: Record<Stage, readonly Stage[]> = {
  new: ['contacted', 'dead_lead'],
  contacted: ['responded', 'did_not_respond', 'interested', 'hired', 'dead_lead'],
  did_not_respond: ['followed_up', 'responded', 'dead_lead'],
  followed_up: ['responded', 'did_not_respond', 'interested', 'hired', 'dead_lead'],
  responded: ['interested', 'hired', 'did_not_respond', 'dead_lead'],
  interested: ['hired', 'did_not_respond', 'dead_lead'],
  hired: [],
  dead_lead: [],
};

export class IllegalTransitionError extends Error {
  readonly from: Stage;
  readonly to: Stage;

  constructor(from: Stage, to: Stage) {
    super(
      isTerminal(from)
        ? `This lead is already closed as "${from}" and cannot be moved to "${to}".`
        : `A lead cannot go from "${from}" back to "${to}".`,
    );
    this.from = from;
    this.to = to;
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: Stage, to: Stage): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: Stage, to: Stage): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

/** What the professional is offered next, in the order they should appear. */
export function nextStages(from: Stage): Stage[] {
  return [...ALLOWED[from]];
}
