import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client.ts';
import type { ApplicationStatus, MappedProfessional } from './application.ts';

export interface ProfessionalRow extends MappedProfessional {
  id: string;
  publishedAt?: string;
  schedulerUrl?: string;
}

const COLUMNS: Array<[keyof MappedProfessional | 'schedulerUrl', string]> = [
  ['status', 'status'], ['tier', 'tier'],
  ['firstName', 'first_name'], ['lastName', 'last_name'], ['email', 'email'],
  ['phone', 'phone'], ['credentials', 'credentials'], ['company', 'company'],
  ['bio', 'bio'], ['photoUrl', 'photo_url'], ['website', 'website'],
  ['linkedin', 'linkedin'], ['social', 'social'], ['socialChannel', 'social_channel'],
  ['street', 'street'], ['city', 'city'], ['state', 'state'], ['zip', 'zip'],
  ['hub', 'hub'], ['statesLicensed', 'states_licensed'],
  ['occupation', 'occupation'], ['category', 'category'],
  ['signupPath', 'signup_path'], ['partnerName', 'partner_name'], ['program', 'program'],
  ['groupSlots', 'group_slots'], ['groupTimezone', 'group_timezone'],
  ['affiliateOptin', 'affiliate_optin'], ['schedulerUrl', 'scheduler_url'],
  ['appliedAt', 'applied_at'],
];

export class ProfessionalRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  /**
   * Record an application.
   *
   * Matched on email, because a professional who applies twice — for a second
   * programme, or because they were unsure the first went through — is one
   * person. Re-applying never demotes someone already published: an existing
   * status and tier are left alone and only the details are refreshed.
   */
  async receiveApplication(p: MappedProfessional): Promise<{ id: string; isNew: boolean }> {
    const existing = await this.db.query<{ id: string; status: string }>(
      'SELECT id, status FROM professionals WHERE email = ?', [p.email],
    );

    if (existing.length) {
      const keepStatus = existing[0].status !== 'applied';
      const cols = COLUMNS.filter(([key]) => {
        if (key === 'status' || key === 'tier') return !keepStatus;
        const v = (p as any)[key];
        return v !== undefined && String(v).trim() !== '';
      });
      await this.db.run(
        `UPDATE professionals SET ${cols.map(([, c]) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...cols.map(([k]) => (p as any)[k] ?? null), existing[0].id],
      );
      return { id: existing[0].id, isNew: false };
    }

    const id = randomUUID();
    const cols = COLUMNS.filter(([key]) => (p as any)[key] !== undefined);
    await this.db.run(
      `INSERT INTO professionals (id, ${cols.map(([, c]) => c).join(', ')}, created_at)` +
      ` VALUES (${['?', ...cols.map(() => '?'), '?'].join(', ')})`,
      [id, ...cols.map(([k]) => (p as any)[k]), new Date().toISOString()],
    );
    return { id, isNew: true };
  }

  async setStatus(id: string, status: ApplicationStatus, tier?: string): Promise<void> {
    const sets = ['status = ?'];
    const params: unknown[] = [status];
    if (tier) { sets.push('tier = ?'); params.push(tier); }
    if (status === 'published') { sets.push('published_at = ?'); params.push(new Date().toISOString()); }
    params.push(id);
    await this.db.run(`UPDATE professionals SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async byStatus(status: ApplicationStatus): Promise<ProfessionalRow[]> {
    const rows = await this.db.query<any>(
      'SELECT * FROM professionals WHERE status = ? ORDER BY applied_at DESC', [status],
    );
    return rows.map(toRow);
  }

  async published(): Promise<ProfessionalRow[]> {
    const rows = await this.db.query<any>(
      "SELECT * FROM professionals WHERE status = 'published' ORDER BY last_name, first_name",
    );
    return rows.map(toRow);
  }

  async counts(): Promise<Record<string, number>> {
    const rows = await this.db.query<{ status: string; n: number }>(
      'SELECT status, COUNT(*) AS n FROM professionals GROUP BY status',
    );
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }
}

function toRow(r: any): ProfessionalRow {
  return {
    id: r.id, status: r.status, tier: r.tier,
    firstName: r.first_name, lastName: r.last_name ?? '', email: r.email,
    phone: r.phone ?? undefined, credentials: r.credentials ?? undefined,
    company: r.company ?? undefined, bio: r.bio ?? undefined,
    photoUrl: r.photo_url ?? undefined, website: r.website ?? undefined,
    linkedin: r.linkedin ?? undefined, social: r.social ?? undefined,
    socialChannel: r.social_channel ?? undefined,
    street: r.street ?? undefined, city: r.city ?? undefined,
    state: r.state ?? undefined, zip: r.zip ?? undefined,
    hub: r.hub ?? undefined, statesLicensed: r.states_licensed ?? undefined,
    occupation: r.occupation ?? undefined, category: r.category,
    signupPath: r.signup_path ?? undefined, partnerName: r.partner_name ?? undefined,
    program: r.program ?? undefined, groupSlots: r.group_slots ?? undefined,
    groupTimezone: r.group_timezone ?? undefined, affiliateOptin: r.affiliate_optin ?? undefined,
    schedulerUrl: r.scheduler_url ?? undefined,
    appliedAt: r.applied_at ?? r.created_at, publishedAt: r.published_at ?? undefined,
  };
}
