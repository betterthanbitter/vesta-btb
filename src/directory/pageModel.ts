/**
 * Which directory pages should exist.
 *
 * The audit found that publishing a fixed hub x category grid would put 70
 * near-empty pages live at once. That is the pattern search engines demote,
 * and — per the strategy document's citation argument — it dilutes exactly the
 * subject depth that makes a corpus worth citing.
 *
 * So pages are derived from what is actually there, and they appear as
 * coverage grows rather than being published up front.
 */

import type { PracticeCategory } from '../pricing/catalog.ts';
import type { Tier } from './tiers.ts';

export interface DirectoryProfessional {
  id: string;
  hub: string;
  category: PracticeCategory;
  tier: Tier;
  /** Count of published content items — webinars, podcasts, articles. */
  contentCount: number;
}

export interface PageThresholds {
  /** A page needs at least this many professionals... */
  minProfessionals: number;
  /** ...or this much content between them, which also makes it worth reading. */
  minContentItems: number;
}

export const DEFAULT_THRESHOLDS: PageThresholds = {
  minProfessionals: 2,
  minContentItems: 3,
};

export type PageState =
  /** Publish it and let it be indexed. */
  | 'publish'
  /** Real but too thin to index — reachable, marked noindex. */
  | 'thin'
  /** Nothing there. Should not exist as a URL at all. */
  | 'omit';

export interface DirectoryPage {
  hub: string;
  category: PracticeCategory;
  url: string;
  state: PageState;
  professionals: number;
  contentItems: number;
  /** Whether the Platinum seat for this cell is unsold. */
  seatOpen: boolean;
  reason: string;
}

export function pageUrl(hub: string, category: PracticeCategory): string {
  return `/${hub}/${category}/`;
}

/**
 * Decide the state of one cell.
 *
 * A single professional with a real content library is a legitimate page —
 * there is something to read. A single professional with nothing is not.
 */
export function classify(
  professionals: number,
  contentItems: number,
  t: PageThresholds = DEFAULT_THRESHOLDS,
): { state: PageState; reason: string } {
  if (professionals === 0) {
    return { state: 'omit', reason: 'nobody in this category here' };
  }
  if (professionals >= t.minProfessionals) {
    return { state: 'publish', reason: `${professionals} professionals` };
  }
  if (contentItems >= t.minContentItems) {
    return {
      state: 'publish',
      reason: `one professional, but ${contentItems} pieces of content to read`,
    };
  }
  return {
    state: 'thin',
    reason: `one professional with ${contentItems} content item(s) — reachable, not indexed`,
  };
}

export function buildPages(
  professionals: DirectoryProfessional[],
  seatHeld: (hub: string, category: PracticeCategory) => boolean,
  thresholds: PageThresholds = DEFAULT_THRESHOLDS,
): DirectoryPage[] {
  const cells = new Map<string, DirectoryProfessional[]>();
  for (const p of professionals) {
    const key = `${p.hub}:${p.category}`;
    const list = cells.get(key) ?? [];
    list.push(p);
    cells.set(key, list);
  }

  const pages: DirectoryPage[] = [];
  for (const list of cells.values()) {
    const { hub, category } = list[0];
    const contentItems = list.reduce((n, p) => n + p.contentCount, 0);
    const { state, reason } = classify(list.length, contentItems, thresholds);
    if (state === 'omit') continue;
    pages.push({
      hub,
      category,
      url: pageUrl(hub, category),
      state,
      professionals: list.length,
      contentItems,
      seatOpen: !seatHeld(hub, category),
      reason,
    });
  }
  return pages.sort((a, b) => b.professionals - a.professionals || a.url.localeCompare(b.url));
}

/** Order professionals within a page: Platinum first, then Premium, then the rest. */
export function orderForPage(
  list: DirectoryProfessional[],
  weight: (t: Tier) => number,
): DirectoryProfessional[] {
  return [...list].sort(
    (a, b) => weight(b.tier) - weight(a.tier) || b.contentCount - a.contentCount,
  );
}
