/**
 * The editorial content on a professional's public profile.
 *
 * This is what the PAC.MP program produces, and it is the difference between
 * a listing and a page worth reading. Every block is optional: a Standard
 * member has none of it, and the page has to look deliberate rather than
 * broken when that is the case.
 *
 * Stored as JSON on the professional. Nothing queries inside it, so a column
 * per field would be churn with no benefit.
 */

export interface AnsweredQuestion {
  question: string;
  answer: string;
  /** Where the answer came from — a webinar, an episode, a book. */
  source?: string;
}

export interface LibraryItem {
  title: string;
  /** "52 min · recorded June 2026", "PDF · 4 pages" */
  meta?: string;
  summary?: string;
  /** Labels for the actions offered, e.g. Play, Download, Transcript. */
  actions?: string[];
}

export interface Shelf {
  name: string;
  items: LibraryItem[];
}

export interface ProfileContent {
  /** A short positioning line under the name. */
  lede?: string;
  questions?: AnsweredQuestion[];
  quote?: { text: string; attribution?: string };
  shelves?: Shelf[];
  /** A single number worth stopping on, with where it came from. */
  stat?: { claim: string; source?: string };
  /** Their own account of why they do this. Paragraphs. */
  about?: string[];
  books?: string[];
}

export function parseProfileContent(raw: string | null | undefined): ProfileContent {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as ProfileContent : {};
  } catch {
    // Malformed content must never take a professional's page down.
    console.warn('[profile] could not parse profile_content');
    return {};
  }
}

/** How many pieces are in the library, for the counts on the listing. */
export function countLibrary(content: ProfileContent): number {
  return (content.shelves ?? []).reduce((n, s) => n + s.items.length, 0);
}
