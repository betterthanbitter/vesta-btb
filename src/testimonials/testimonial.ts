/**
 * Client testimonials.
 *
 * Only someone a professional marked as "hired" is ever asked, and only through
 * a link made for that one hire. That is what makes a testimonial here worth
 * reading: every one comes from a real client, and nobody can post one by
 * finding the page.
 *
 * Nothing is public until Vesta approves it, and nothing is public at all
 * unless the client said it may be.
 */

import { randomBytes } from 'node:crypto';
import type { OutboxEntry } from '../referral/outbox.ts';

export type TestimonialStatus =
  /** Waiting for Vesta to approve it. */
  | 'pending'
  | 'published'
  | 'declined'
  /** The client did not agree to publication. Vesta sees it; nobody else does. */
  | 'private';

/** How the client's name appears under what they wrote. */
export type DisplayAs = 'initial' | 'first' | 'anonymous';

export interface TestimonialInput {
  rating: number;
  liked: string;
  displayAs: DisplayAs;
  publish: boolean;
}

export type TestimonialErrors = Partial<Record<'rating' | 'liked' | 'displayAs', string>>;

const LIKED = { min: 20, max: 1500 };

/**
 * How long after the hire the first email goes. Set here, carried to the
 * delivery engine, and adjustable there. Too soon and the client has barely
 * started; too late and the goodwill of the first weeks has faded.
 */
export const REVIEW_ASK_AFTER_DAYS = 14;

/** Validated on the server, always — anyone can post to the endpoint directly. */
export function validateTestimonial(raw: {
  rating?: unknown; liked?: unknown; displayAs?: unknown; publish?: unknown;
}): { ok: true; value: TestimonialInput } | { ok: false; errors: TestimonialErrors } {
  const errors: TestimonialErrors = {};

  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Please choose a rating from one to five stars.';
  }

  const liked = String(raw.liked ?? '').trim();
  if (liked.length < LIKED.min) {
    errors.liked = 'Please tell us a little more — a sentence or two helps others most.';
  } else if (liked.length > LIKED.max) {
    errors.liked = 'Please keep this under 1,500 characters.';
  }

  const displayAs = String(raw.displayAs ?? 'initial');
  if (!['initial', 'first', 'anonymous'].includes(displayAs)) {
    errors.displayAs = 'Please choose how your name should appear.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const publish = raw.publish === true || raw.publish === 'yes' || raw.publish === 'on';
  return { ok: true, value: { rating, liked, displayAs: displayAs as DisplayAs, publish } };
}

/** "Sarah M.", "Sarah" or "A Vesta client" — the client's choice. */
export function displayName(firstName: string, lastName: string, as: DisplayAs): string {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0).toUpperCase();
  if (as === 'anonymous' || !first) return 'A Vesta client';
  if (as === 'first' || !initial) return first;
  return `${first} ${initial}.`;
}

/** Unguessable, URL-safe, and the only key to one client's review form. */
export function newReviewToken(): string {
  return randomBytes(24).toString('base64url');
}

export function isReviewToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);
}

/**
 * Where review links point. Netlify sets URL to the site's main address on
 * every build; PUBLIC_SITE_URL overrides it once there is a real domain.
 */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw = env.PUBLIC_SITE_URL || env.URL || 'http://localhost:3100';
  return raw.replace(/\/+$/, '');
}

export function reviewUrl(origin: string, token: string): string {
  return `${origin}/review/${token}`;
}

/**
 * An average of one or two ratings says nothing, and a lone "5.0" looks like
 * a claim. Show the average once there are enough to mean something.
 */
export const AVERAGE_SHOWN_FROM = 3;

export function summarize(ratings: number[]): { count: number; average: number | null } {
  if (!ratings.length) return { count: 0, average: null };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { count: ratings.length, average: Math.round(avg * 10) / 10 };
}

/** The hire happened: ask the client, through the delivery engine. */
export function testimonialRequestedEntry(p: {
  referralId: string;
  professionalId: string;
  professionalName: string;
  token: string;
  consumerEmail: string;
  consumerFirstName: string;
  origin: string;
  at: string;
}): OutboxEntry {
  return {
    kind: 'testimonial.requested',
    // One ask per hire, however many times the button is pressed.
    dedupKey: `referral:${p.referralId}:pro:${p.professionalId}:testimonial`,
    payload: {
      referralId: p.referralId,
      professionalId: p.professionalId,
      professionalName: p.professionalName,
      consumerEmail: p.consumerEmail,
      consumerFirstName: p.consumerFirstName,
      reviewUrl: reviewUrl(p.origin, p.token),
      askAfterDays: REVIEW_ASK_AFTER_DAYS,
    },
    createdAt: p.at,
  };
}

/** They answered: stop asking. */
export function testimonialReceivedEntry(p: {
  referralId: string; professionalId: string; consumerEmail: string; at: string;
}): OutboxEntry {
  return {
    kind: 'testimonial.received',
    dedupKey: `referral:${p.referralId}:pro:${p.professionalId}:testimonial:received`,
    payload: { ...p },
    createdAt: p.at,
  };
}
