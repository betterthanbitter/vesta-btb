import { type Outbox, type OutboxEntry } from './outbox.ts';
import { assertTransition } from './stateMachine.ts';
import {
  type Consumer,
  type Professional,
  type Referral,
  type RoutingMode,
  type Stage,
  isTerminal,
} from './types.ts';

export interface Clock {
  now(): string;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };

/**
 * The hub's referral logic.
 *
 * Every method here does two things and only two things: change the hub's own
 * records, and append intents to the outbox. It never talks to the delivery
 * engine directly and it never sends an email. That separation is what stops
 * two systems from both emailing the same person.
 */
export class ReferralService {
  private referrals = new Map<string, Referral>();

  private readonly outbox: Outbox;
  private readonly clock: Clock;

  constructor(outbox: Outbox, clock: Clock = systemClock) {
    this.outbox = outbox;
    this.clock = clock;
  }

  get(referralId: string): Referral | undefined {
    return this.referrals.get(referralId);
  }

  /**
   * The concierge clicks "Route to professionals".
   *
   * Safe to call twice with the same referralId — the second call is a no-op
   * and adds nothing to the outbox. That covers the double-click, the browser
   * retry and the impatient refresh.
   */
  route(params: {
    referralId: string;
    consumer: Consumer;
    professionals: Professional[];
    mode: RoutingMode;
  }): Referral {
    const existing = this.referrals.get(params.referralId);
    if (existing) return existing;

    if (params.professionals.length === 0) {
      throw new Error('Cannot route a referral to nobody.');
    }
    if (params.mode === 'direct' && params.professionals.length > 1) {
      throw new Error('A direct referral goes to exactly one professional.');
    }

    const routedAt = this.clock.now();
    const referral: Referral = {
      id: params.referralId,
      consumerId: params.consumer.id,
      hub: params.consumer.hub,
      category: params.consumer.categoryNeeded,
      mode: params.mode,
      routedAt,
      assignments: params.professionals.map((p) => ({
        professionalId: p.id,
        stage: 'routed' as Stage,
        stageChangedAt: routedAt,
      })),
    };
    this.referrals.set(referral.id, referral);

    this.outbox.add(
      this.entry('consumer.routed', `referral:${referral.id}:consumer`, {
        consumer: params.consumer,
        referralId: referral.id,
        mode: params.mode,
        shortlist: params.professionals.map((p) => `${p.firstName} ${p.lastName}`),
        routedAt,
      }),
    );

    for (const pro of params.professionals) {
      this.outbox.add(
        this.entry(
          'professional.assigned',
          `referral:${referral.id}:pro:${pro.id}`,
          { professional: pro, consumer: params.consumer, referralId: referral.id, routedAt },
        ),
      );
    }

    return referral;
  }

  /**
   * A professional moves a lead along in their dashboard.
   *
   * Pushes ONE field to the delivery engine, not a tag. Tags accumulate and
   * within a year nobody can tell which are live; a single field always has
   * exactly one current value.
   */
  advance(referralId: string, professionalId: string, to: Stage): Referral {
    const referral = this.referrals.get(referralId);
    if (!referral) throw new Error(`Unknown referral ${referralId}`);

    const assignment = referral.assignments.find((a) => a.professionalId === professionalId);
    if (!assignment) {
      throw new Error(`${professionalId} is not assigned to referral ${referralId}`);
    }

    // Re-clicking the stage you are already on is a no-op, not an error.
    if (assignment.stage === to) return referral;

    assertTransition(assignment.stage, to);

    const at = this.clock.now();
    assignment.stage = to;
    assignment.stageChangedAt = at;

    this.outbox.add(
      this.entry(
        'assignment.stage_changed',
        `referral:${referralId}:pro:${professionalId}:stage:${to}`,
        { referralId, professionalId, stage: to, at },
      ),
    );

    if (to === 'retained') {
      referral.closedAt = at;
      // The reason for every outstanding sequence is now gone. Tell the
      // delivery engine to stop chasing everyone, including the consumer.
      this.outbox.add(
        this.entry('referral.closed', `referral:${referralId}:closed`, {
          referralId,
          retainedBy: professionalId,
          at,
          alsoStopFor: referral.assignments
            .filter((a) => a.professionalId !== professionalId && !isTerminal(a.stage))
            .map((a) => a.professionalId),
        }),
      );
    }

    return referral;
  }

  private entry(
    kind: OutboxEntry['kind'],
    dedupKey: string,
    payload: Record<string, unknown>,
  ): OutboxEntry {
    return { kind, dedupKey, payload, createdAt: this.clock.now() };
  }
}
