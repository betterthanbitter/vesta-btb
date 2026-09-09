import { randomUUID } from 'node:crypto';
import type { Db } from './client.ts';
import { SqlLedger, SqlOutbox } from './repositories.ts';
import { Outbox, flushOutbox } from '../referral/outbox.ts';
import { ReferralService } from '../referral/referralService.ts';
import type { Consumer, Professional, Referral, RoutingMode, Stage } from '../referral/types.ts';
import { type ConsumerProfile, PROFILE_COLUMNS } from '../leads/consumerProfile.ts';

/**
 * One lead, as both dashboards need to see it.
 *
 * A form submission and a concierge referral used to be different shapes. They
 * are the same thing — a person who wants to talk to a professional — so they
 * are stored the same way and this is what comes back. Where it came from is a
 * field, not a different table.
 */
export interface LeadView {
  referralId: string;
  professionalId: string;
  stage: Stage;
  stageChangedAt: string;
  routedAt: string;
  mode: RoutingMode;
  hub: string;
  category: string;
  consumer: {
    name: string;
    email: string;
    phone?: string;
    city?: string;
    state?: string;
    stageOfDivorce?: string;
    lengthOfMarriage?: string;
    hasChildren?: string;
    childrenAges?: string;
    homeStatus?: string;
    ownsBusiness?: string;
    assetRange?: string;
    professionalsWanted?: string;
    leadSource?: string;
    questions?: string;
  };
  message?: string;
  /** How many professionals this consumer was shown. 1 means it is only yours. */
  shortlistSize: number;
  /** Whole days since anything last happened on it. */
  daysSinceActivity: number;
}

export class LeadRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  /**
   * Create or update the consumer, matched on email.
   *
   * One person, one row. Two rows for the same email means two contacts in the
   * CRM and two sequences chasing the same person.
   */
  async upsertConsumer(input: {
    email: string; firstName: string; lastName?: string;
    hub: string; categoryNeeded: string;
  } & ConsumerProfile): Promise<Consumer> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.query<{ id: string }>(
      'SELECT id FROM consumers WHERE email = ?', [email],
    );

    // Only overwrite a questionnaire answer when a new one was given. A second
    // call that skipped a question must not wipe what the first one learned.
    const supplied = PROFILE_COLUMNS.filter(([key]) => {
      const v = input[key];
      return v !== undefined && String(v).trim() !== '';
    });

    if (existing.length) {
      const sets = ['first_name = ?', 'last_name = ?', 'hub = ?', 'category_needed = ?',
        ...supplied.map(([, col]) => `${col} = ?`)];
      await this.db.run(
        `UPDATE consumers SET ${sets.join(', ')} WHERE id = ?`,
        [input.firstName, input.lastName ?? '', input.hub, input.categoryNeeded,
         ...supplied.map(([key]) => input[key] as string), existing[0].id],
      );
      return { ...input, email, id: existing[0].id, lastName: input.lastName ?? '' };
    }

    const id = randomUUID();
    const cols = ['id', 'email', 'first_name', 'last_name', 'hub', 'category_needed',
      ...supplied.map(([, col]) => col), 'created_at'];
    await this.db.run(
      `INSERT INTO consumers (${cols.join(', ')})` +
      ` VALUES (${cols.map(() => '?').join(', ')})`,
      [id, email, input.firstName, input.lastName ?? '', input.hub, input.categoryNeeded,
       ...supplied.map(([key]) => input[key] as string), new Date().toISOString()],
    );
    return { ...input, email, id, lastName: input.lastName ?? '' };
  }

  /**
   * Route a referral to one or more professionals.
   *
   * The referral, its assignments and the outbox intents are written in one
   * transaction. Half of this is worse than none: a referral with no intents
   * means nobody is told, and intents with no referral means we email about
   * something that does not exist.
   */
  async route(params: {
    consumer: Consumer;
    professionals: Professional[];
    mode: RoutingMode;
    message?: string;
  }): Promise<Referral> {
    const buffer = new Outbox();
    const service = new ReferralService(buffer);
    const referralId = randomUUID();

    const referral = service.route({
      referralId, consumer: params.consumer,
      professionals: params.professionals, mode: params.mode,
    });

    await this.db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO referrals (id, consumer_id, hub, category, mode, routed_at, message)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
        [referral.id, referral.consumerId, referral.hub, referral.category,
         referral.mode, referral.routedAt, params.message ?? null],
      );
      for (const a of referral.assignments) {
        await tx.run(
          'INSERT INTO referral_assignments (referral_id, professional_id, stage,' +
          ' stage_changed_at) VALUES (?, ?, ?, ?)',
          [referral.id, a.professionalId, a.stage, a.stageChangedAt],
        );
      }
      await flushOutbox(buffer, new SqlOutbox(tx));
    });

    return referral;
  }

  /**
   * An open referral from this consumer to this professional, if one exists.
   *
   * Someone filling the form in twice — because they were unsure it sent, or
   * came back the next day — is one interested person, not two leads. A
   * professional whose dashboard shows the same name three times stops
   * trusting the count.
   *
   * Only open referrals count. Coming back months after a matter closed is a
   * genuinely new enquiry and should appear as one.
   */
  async findOpenReferral(consumerId: string, professionalId: string): Promise<string | null> {
    const rows = await this.db.query<{ referral_id: string }>(
      `SELECT a.referral_id FROM referral_assignments a
         JOIN referrals r ON r.id = a.referral_id
        WHERE r.consumer_id = ? AND a.professional_id = ?
          AND r.closed_at IS NULL
          AND a.stage NOT IN ('hired','dead_lead')
        LIMIT 1`,
      [consumerId, professionalId],
    );
    return rows[0]?.referral_id ?? null;
  }

  /** Attach a later message to an existing open referral rather than duplicating it. */
  async appendMessage(referralId: string, message: string): Promise<void> {
    const rows = await this.db.query<{ message: string | null }>(
      'SELECT message FROM referrals WHERE id = ?', [referralId],
    );
    const existing = rows[0]?.message;
    const combined = existing && existing !== message
      ? `${existing}\n\n— followed up —\n${message}`
      : message;
    await this.db.run('UPDATE referrals SET message = ? WHERE id = ?', [combined, referralId]);
  }

  /** Move a lead along. Rejects illegal moves via the same state machine. */
  async advance(referralId: string, professionalId: string, to: Stage): Promise<void> {
    const rows = await this.db.query<any>(
      'SELECT * FROM referral_assignments WHERE referral_id = ? AND professional_id = ?',
      [referralId, professionalId],
    );
    if (!rows.length) throw new Error('That lead is not assigned to you.');

    const { assertTransition } = await import('../referral/stageGuard.ts');
    assertTransition(rows[0].stage as Stage, to);

    const at = new Date().toISOString();
    await this.db.transaction(async (tx) => {
      await tx.run(
        'UPDATE referral_assignments SET stage = ?, stage_changed_at = ?' +
        ' WHERE referral_id = ? AND professional_id = ?',
        [to, at, referralId, professionalId],
      );
      await new SqlOutbox(tx).add({
        kind: 'assignment.stage_changed',
        dedupKey: `referral:${referralId}:pro:${professionalId}:stage:${to}`,
        payload: { referralId, professionalId, stage: to, at },
        createdAt: at,
      });
      if (to === 'hired') {
        await tx.run('UPDATE referrals SET closed_at = ? WHERE id = ?', [at, referralId]);
        await new SqlOutbox(tx).add({
          kind: 'referral.closed',
          dedupKey: `referral:${referralId}:closed`,
          payload: { referralId, retainedBy: professionalId, at },
          createdAt: at,
        });
      }
    });
  }

  async forProfessional(professionalId: string): Promise<LeadView[]> {
    return this.read('WHERE a.professional_id = ?', [professionalId]);
  }

  async all(): Promise<LeadView[]> {
    return this.read('', []);
  }

  private async read(where: string, params: unknown[]): Promise<LeadView[]> {
    const rows = await this.db.query<any>(
      `SELECT a.referral_id, a.professional_id, a.stage, a.stage_changed_at,
              r.routed_at, r.mode, r.hub, r.category, r.message,
              c.first_name, c.last_name, c.email, c.phone, c.city, c.state,
              c.stage_of_divorce, c.length_of_marriage, c.has_children, c.children_ages,
              c.home_status, c.owns_business, c.asset_range, c.professionals_wanted,
              c.lead_source, c.questions,
              (SELECT COUNT(*) FROM referral_assignments x WHERE x.referral_id = r.id) AS shortlist
       FROM referral_assignments a
       JOIN referrals r ON r.id = a.referral_id
       JOIN consumers c ON c.id = r.consumer_id
       ${where}
       ORDER BY r.routed_at DESC`,
      params,
    );

    const now = Date.now();
    return rows.map((r) => ({
      referralId: r.referral_id,
      professionalId: r.professional_id,
      stage: r.stage,
      stageChangedAt: r.stage_changed_at,
      routedAt: r.routed_at,
      mode: r.mode,
      hub: r.hub,
      category: r.category,
      message: r.message ?? undefined,
      consumer: {
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
        email: r.email,
        phone: r.phone ?? undefined,
        city: r.city ?? undefined,
        state: r.state ?? undefined,
        stageOfDivorce: r.stage_of_divorce ?? undefined,
        lengthOfMarriage: r.length_of_marriage ?? undefined,
        hasChildren: r.has_children ?? undefined,
        childrenAges: r.children_ages ?? undefined,
        homeStatus: r.home_status ?? undefined,
        ownsBusiness: r.owns_business ?? undefined,
        assetRange: r.asset_range ?? undefined,
        professionalsWanted: r.professionals_wanted ?? undefined,
        leadSource: r.lead_source ?? undefined,
        questions: r.questions ?? undefined,
      },
      shortlistSize: Number(r.shortlist),
      daysSinceActivity: Math.floor((now - Date.parse(r.stage_changed_at)) / 86_400_000),
    }));
  }

  ledger(): SqlLedger { return new SqlLedger(this.db); }
}
