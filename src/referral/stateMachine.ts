import { type Stage, isTerminal } from './types.ts';

/**
 * Legal stage transitions.
 *
 * A professional can skip forward (routed -> contacted, if they phoned before
 * opening the dashboard) but never backwards, and never out of a terminal
 * stage. Terminal stages are final because leaving one would mean restarting
 * an Ontraport sequence we have already told Ontraport to stop.
 */
const ALLOWED: Record<Stage, readonly Stage[]> = {
  routed: ['viewed', 'contacted', 'consulted', 'declined', 'no_response', 'withdrawn'],
  viewed: ['contacted', 'consulted', 'declined', 'no_response', 'withdrawn'],
  contacted: ['consulted', 'retained', 'declined', 'no_response', 'withdrawn'],
  consulted: ['retained', 'declined', 'no_response', 'withdrawn'],
  retained: [],
  declined: [],
  no_response: [],
  withdrawn: [],
};

export class IllegalTransitionError extends Error {
  readonly from: Stage;
  readonly to: Stage;

  constructor(from: Stage, to: Stage) {
    super(
      isTerminal(from)
        ? `Referral is already closed as "${from}" and cannot move to "${to}".`
        : `A referral cannot move from "${from}" back to "${to}".`,
    );
    this.from = from;
    this.to = to;
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: Stage, to: Stage): boolean {
  return ALLOWED[from].includes(to);
}

/** Throws IllegalTransitionError unless the move is legal. */
export function assertTransition(from: Stage, to: Stage): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}
