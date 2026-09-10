import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client.ts';
import { SqlOutbox } from '../db/repositories.ts';
import {
  type TestimonialInput,
  type TestimonialStatus,
  displayName,
  isReviewToken,
  newReviewToken,
  testimonialReceivedEntry,
  testimonialRequestedEntry,
} from './testimonial.ts';

export interface ReviewRequestView {
  token: string;
  referralId: string;
  professionalId: string;
  consumerFirstName: string;
  consumerLastName: string;
  consumerEmail: string;
  /** A testimonial has already been sent with this link. */
  submitted: boolean;
}

export interface TestimonialView {
  id: string;
  professionalId: string;
  rating: number;
  liked: string;
  displayName: string;
  status: TestimonialStatus;
  publishConsent: boolean;
  submittedAt: string;
}

export type SubmitResult =
  | { ok: true; professionalId: string; status: TestimonialStatus }
  | { ok: false; reason: 'unknown' | 'already' };

/**
 * Make the review link for one hire, and queue the ask.
 *
 * Takes a Db so it runs inside the caller's transaction: marking a lead hired
 * and creating its review link happen together or not at all. Safe to call
 * twice — the second call finds the first link and the outbox drops the
 * repeated intent, so the client is asked once.
 */
export async function requestTestimonial(
  tx: Db,
  p: { referralId: string; professionalId: string; at: string; origin: string },
): Promise<{ token: string }> {
  let token = (await tx.query<{ token: string }>(
    'SELECT token FROM review_requests WHERE referral_id = ? AND professional_id = ?',
    [p.referralId, p.professionalId],
  ))[0]?.token;

  if (!token) {
    const fresh = newReviewToken();
    const r = await tx.run(
      'INSERT INTO review_requests (token, referral_id, professional_id, created_at)' +
      ' VALUES (?, ?, ?, ?) ON CONFLICT (referral_id, professional_id) DO NOTHING',
      [fresh, p.referralId, p.professionalId, p.at],
    );
    token = r.changes === 1 ? fresh : (await tx.query<{ token: string }>(
      'SELECT token FROM review_requests WHERE referral_id = ? AND professional_id = ?',
      [p.referralId, p.professionalId],
    ))[0].token;
  }

  const who = (await tx.query<any>(
    `SELECT c.email, c.first_name FROM referrals r JOIN consumers c ON c.id = r.consumer_id
      WHERE r.id = ?`,
    [p.referralId],
  ))[0];
  const pro = (await tx.query<any>(
    'SELECT first_name, last_name FROM professionals WHERE id = ?', [p.professionalId],
  ))[0];

  if (who) {
    await new SqlOutbox(tx).add(testimonialRequestedEntry({
      referralId: p.referralId,
      professionalId: p.professionalId,
      professionalName: pro ? [pro.first_name, pro.last_name].filter(Boolean).join(' ') : '',
      token,
      consumerEmail: who.email,
      consumerFirstName: who.first_name,
      origin: p.origin,
      at: p.at,
    }));
  }
  return { token };
}

export class TestimonialRepository {
  private readonly db: Db;
  constructor(db: Db) { this.db = db; }

  async request(referralId: string, professionalId: string, origin: string): Promise<{ token: string }> {
    const hired = await this.db.query(
      "SELECT 1 FROM referral_assignments WHERE referral_id = ? AND professional_id = ? AND stage = 'hired'",
      [referralId, professionalId],
    );
    if (!hired.length) throw new Error('Only a client who hired this professional can be asked.');
    const at = new Date().toISOString();
    return this.db.transaction((tx) => requestTestimonial(tx, { referralId, professionalId, at, origin }));
  }

  /** The review link's owner, or null for anything that is not a real link. */
  async findRequest(token: string): Promise<ReviewRequestView | null> {
    if (!isReviewToken(token)) return null;
    const row = (await this.db.query<any>(
      `SELECT rr.token, rr.referral_id, rr.professional_id,
              c.first_name, c.last_name, c.email,
              (SELECT COUNT(*) FROM testimonials t WHERE t.token = rr.token) AS n
         FROM review_requests rr
         JOIN referrals r ON r.id = rr.referral_id
         JOIN consumers c ON c.id = r.consumer_id
        WHERE rr.token = ?`,
      [token],
    ))[0];
    if (!row) return null;
    return {
      token: row.token,
      referralId: row.referral_id,
      professionalId: row.professional_id,
      consumerFirstName: row.first_name,
      consumerLastName: row.last_name ?? '',
      consumerEmail: row.email,
      submitted: Number(row.n) > 0,
    };
  }

  /**
   * Record what the client wrote. One testimonial per link: the unique index
   * on the token decides, so a double-click or a second tab cannot make two.
   */
  async submit(token: string, input: TestimonialInput): Promise<SubmitResult> {
    const req = await this.findRequest(token);
    if (!req) return { ok: false, reason: 'unknown' };
    if (req.submitted) return { ok: false, reason: 'already' };

    const status: TestimonialStatus = input.publish ? 'pending' : 'private';
    const at = new Date().toISOString();

    return this.db.transaction(async (tx) => {
      const r = await tx.run(
        `INSERT INTO testimonials (id, token, referral_id, professional_id, rating, liked,
           display_name, publish_consent, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (token) DO NOTHING`,
        [randomUUID(), token, req.referralId, req.professionalId, input.rating, input.liked,
         displayName(req.consumerFirstName, req.consumerLastName, input.displayAs),
         input.publish ? 1 : 0, status, at],
      );
      if (r.changes !== 1) return { ok: false as const, reason: 'already' as const };

      await new SqlOutbox(tx).add(testimonialReceivedEntry({
        referralId: req.referralId, professionalId: req.professionalId,
        consumerEmail: req.consumerEmail, at,
      }));
      return { ok: true as const, professionalId: req.professionalId, status };
    });
  }

  /** Waiting for Vesta, oldest first. */
  async pending(): Promise<TestimonialView[]> {
    return this.read("WHERE status = 'pending' ORDER BY submitted_at", []);
  }

  /** What the public profile shows, newest first. */
  async published(professionalId: string): Promise<TestimonialView[]> {
    return this.read(
      "WHERE professional_id = ? AND status = 'published' ORDER BY submitted_at DESC",
      [professionalId],
    );
  }

  /**
   * Publish or decline. Only a pending testimonial can be decided: a private
   * one was never agreed for publication, and nothing here can change that.
   */
  async decide(id: string, decision: 'published' | 'declined'): Promise<string | null> {
    const row = (await this.db.query<{ professional_id: string }>(
      "SELECT professional_id FROM testimonials WHERE id = ? AND status = 'pending'", [id],
    ))[0];
    if (!row) return null;
    await this.db.run(
      "UPDATE testimonials SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
      [decision, new Date().toISOString(), id],
    );
    return row.professional_id;
  }

  private async read(where: string, params: unknown[]): Promise<TestimonialView[]> {
    const rows = await this.db.query<any>(`SELECT * FROM testimonials ${where}`, params);
    return rows.map((r) => ({
      id: r.id,
      professionalId: r.professional_id,
      rating: Number(r.rating),
      liked: r.liked,
      displayName: r.display_name,
      status: r.status,
      publishConsent: Number(r.publish_consent) === 1,
      submittedAt: r.submitted_at,
    }));
  }
}
