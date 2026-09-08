/**
 * Platinum seat inventory.
 *
 * One Platinum seat exists per (hub, category). Selling the same seat twice
 * means two professionals have each paid for being the only one — which is a
 * refund, an apology, and the end of the claim that the tier means anything.
 * So the seat is modelled as inventory that is claimed, not as a flag on a
 * professional record.
 */

import type { PracticeCategory } from '../pricing/catalog.ts';

export type HubSlug = string;

export interface Seat {
  hub: HubSlug;
  category: PracticeCategory;
  /** Professional currently holding it, if any. */
  heldBy?: string;
  /** When it was claimed. */
  since?: string;
}

export function seatKey(hub: HubSlug, category: PracticeCategory): string {
  return `${hub}:${category}`;
}

export class SeatTakenError extends Error {
  constructor(hub: string, category: string, heldBy: string) {
    super(`The Platinum seat for ${category} in ${hub} is already held by ${heldBy}.`);
    this.name = 'SeatTakenError';
  }
}

export class SeatRegister {
  private seats = new Map<string, Seat>();

  get(hub: HubSlug, category: PracticeCategory): Seat | undefined {
    return this.seats.get(seatKey(hub, category));
  }

  isAvailable(hub: HubSlug, category: PracticeCategory): boolean {
    return !this.get(hub, category)?.heldBy;
  }

  /**
   * Claim the seat. Throws if someone else holds it.
   *
   * Re-claiming your own seat succeeds and changes nothing, so a retried
   * checkout does not fail after the money has already been taken.
   */
  claim(
    hub: HubSlug,
    category: PracticeCategory,
    professionalId: string,
    at: string,
  ): Seat {
    const key = seatKey(hub, category);
    const existing = this.seats.get(key);
    if (existing?.heldBy && existing.heldBy !== professionalId) {
      throw new SeatTakenError(hub, category, existing.heldBy);
    }
    if (existing?.heldBy === professionalId) return existing;

    const seat: Seat = { hub, category, heldBy: professionalId, since: at };
    this.seats.set(key, seat);
    return seat;
  }

  /** Give the seat up — a downgrade, a cancellation, or a failed payment. */
  release(hub: HubSlug, category: PracticeCategory): void {
    this.seats.delete(seatKey(hub, category));
  }

  held(): Seat[] {
    return [...this.seats.values()].filter((s) => s.heldBy);
  }

  /**
   * Seats that exist, are unsold, and have somebody in the cell who could buy
   * one. This is the sales team's target list, and it is deliberately not
   * "every empty cell" — an empty seat in a city with no professionals is not
   * a prospect, it is a recruiting job.
   */
  sellable(
    occupancy: Map<string, { hub: HubSlug; category: PracticeCategory; professionals: number }>,
  ): { hub: HubSlug; category: PracticeCategory; candidates: number }[] {
    const out = [];
    for (const cell of occupancy.values()) {
      if (cell.professionals > 0 && this.isAvailable(cell.hub, cell.category)) {
        out.push({ hub: cell.hub, category: cell.category, candidates: cell.professionals });
      }
    }
    // Densest cells first — exclusivity is worth most where there is most to
    // be exclusive against.
    return out.sort((a, b) => b.candidates - a.candidates);
  }
}
