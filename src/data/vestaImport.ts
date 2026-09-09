/**
 * Reads the real Vesta directory export into domain objects.
 *
 * This is a migration shim, not the eventual data layer. It exists so every
 * screen can be built and judged against real professionals with real messy
 * names rather than tidy invented ones — the cleaning problems show up in the
 * UI where they can be seen, instead of on go-live day.
 *
 * Replaced by the database once the import has been run for real.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PracticeCategory } from '../pricing/catalog.ts';
import type { Tier } from '../directory/tiers.ts';

export interface DirectoryRecord {
  id: string;
  /** Cleaned display name, e.g. "Janet Carson". */
  name: string;
  /** The role that was jammed into the title field, e.g. "Family Law Attorney". */
  roleLabel: string;
  /** Always empty from the live import — the source data has no firm field. */
  firm: string;
  bio: string;
  city: string;
  state: string;
  hub: string;
  category: PracticeCategory;
  /** Every category they hold, not just the primary one. */
  allCategories: PracticeCategory[];
  email?: string;
  website?: string;
  phone?: string;
  photo?: string;
  tier: Tier;
  /** Total content items. Zero for everyone until PAC.MP produces anything. */
  contentCount: number;
  webinars: number;
  podcasts: number;
  articles: number;
  /** Duration string once an introduction video exists, e.g. "1:48". */
  introVideo?: string;
  /** The professional's own booking page. Validated before it reaches an href. */
  schedulerUrl?: string;
  /** How they describe themselves — "Attorney", "Mediator". Shown in the directory. */
  profession?: string;
  /** What they actually handle. Shown on the profile, not the directory card. */
  specialties: string[];
  specialtyOther?: string;
  statesLicensed?: string;
  linkedin?: string;
  headline?: string;
  profileContent?: string;
  socialLinks?: string;
  /** The old vestadivorce.com post this copy came from — for the redirect map. */
  legacyUrl?: string;
  /** True when the live site has no coordinates — invisible on the map today. */
  invisibleOnMap: boolean;
}

const ROLLUP: Record<string, PracticeCategory> = {
  Legal: 'family-law', Mediation: 'family-law', 'Elder Law Attorney': 'family-law',
  Financial: 'financial-cdfa', 'Business Valuation': 'financial-cdfa',
  'College Planning': 'financial-cdfa', 'Forensic CPA': 'accounting-tax',
  'Estate Planning': 'accounting-tax', Realtor: 'real-estate',
  'Home Organization': 'real-estate', Mortgage: 'mortgage',
  'Divorce Coach': 'coaching-therapy', 'Life Coach': 'coaching-therapy',
  Therapist: 'coaching-therapy', 'Health & Wellness': 'coaching-therapy',
  'Parenting Coach': 'coaching-therapy', 'Parent Coordinator': 'coaching-therapy',
  'Career Coach': 'coaching-therapy', 'Business Coach': 'coaching-therapy',
};

const STATES: Record<string, string> = {
  massachusetts: 'MA', california: 'CA', califronia: 'CA', 'new york': 'NY',
  oklahoma: 'OK', maryland: 'MD', connecticut: 'CT', 'rhode island': 'RI',
};

export const CATEGORY_LABELS: Record<PracticeCategory, string> = {
  'family-law': 'Family Law & Mediation',
  'financial-cdfa': 'Financial & CDFA',
  'accounting-tax': 'Accounting & Tax',
  'real-estate': 'Real Estate',
  mortgage: 'Mortgage',
  'coaching-therapy': 'Divorce Coaching & Therapy',
};

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    ndash: '–', mdash: '—', reg: '®', trade: '™',
  };
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

/**
 * Split "Janet Carson<br><span>Family Law Attorney and Mediator</span>" into
 * its two halves. Both are needed: the name for the heading, the role for the
 * credential line. Today they are one string, which is why the live site shows
 * markup in its own page titles.
 */
export function splitTitle(rendered: string): { name: string; roleLabel: string } {
  const html = decodeEntities(rendered);
  const parts = html.split(/<br\s*\/?>/i);
  const name = stripTags(parts[0] ?? '');
  const roleLabel = stripTags(parts.slice(1).join(' '));
  return { name, roleLabel };
}

let cache: DirectoryRecord[] | null = null;

export function loadDirectory(dataDir = join(process.cwd(), 'data')): DirectoryRecord[] {
  if (cache) return cache;
  const read = (f: string) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

  /**
   * Provisional tier assignment. Replaced by the back office; until then it
   * lets the real tier rendering be reviewed against real professionals.
   */
  /**
   * Profile copy lifted off the old WordPress posts.
   *
   * The store-locator export holds a one-line excerpt and, in its "url" field,
   * a link back to a vestadivorce.com post — so the directory was sending every
   * professional's traffic to the old site instead of carrying their words
   * across. This is those words, and their real website.
   */
  let legacy: Record<string, any> = {};
  try {
    legacy = read('legacy-profiles.json');
  } catch {
    // Not imported yet; the excerpt is all we have.
  }

  let overrides: Record<string, any> = {};
  try {
    overrides = read('tiers.json');
  } catch {
    // No overrides file — everyone is Standard, which is the truth today.
  }

  const terms: Record<string, string> = read('wpsl_terms.json');
  const withCats: any[] = read('wpsl_cats.json');
  const raw: any[] = read('wpsl_raw.json');
  const geo = new Map<number, any>(read('wpsl_all.json').map((s: any) => [Number(s.id), s]));
  const bios = new Map<number, string>(raw.map((r: any) => [r.id, stripTags(r.content?.rendered ?? '')]));
  const titles = new Map<number, string>(raw.map((r: any) => [r.id, r.title?.rendered ?? '']));

  const out: DirectoryRecord[] = [];
  for (const p of withCats) {
    const cats = (p.wpsl_store_category ?? [])
      .map((t: number) => ROLLUP[terms[String(t)]])
      .filter(Boolean) as PracticeCategory[];
    if (!cats.length) continue;

    const g = geo.get(p.id);
    const { name, roleLabel } = splitTitle(titles.get(p.id) ?? p.title?.rendered ?? '');
    const rawState = (g?.state ?? '').trim();
    const state = STATES[rawState.toLowerCase()] ?? rawState.toUpperCase();
    const city = (g?.city ?? '').trim().replace(/\s+/g, ' ');

    out.push({
      id: String(p.id),
      name: name || 'Unnamed listing',
      roleLabel,
      // The live data has no firm field at all — name, role and street
      // address are all it holds. Firms must be collected during migration.
      firm: '',
      // The full biography where we have it, the one-line excerpt otherwise.
      bio: legacy[String(p.id)]?.bio || bios.get(p.id) || '',
      city,
      state,
      hub: city ? `${slugify(city)}-${state.toLowerCase()}` : 'unplaced',
      category: cats[0],
      allCategories: [...new Set(cats)],
      email: g?.email || undefined,
      // Their own site — never the old Vesta post the export pointed at.
      website: legacy[String(p.id)]?.website || undefined,
      legacyUrl: legacy[String(p.id)]?.legacyUrl
        || (g?.url && String(g.url).includes('vestadivorce.com') ? g.url : undefined),
      phone: g?.phone || undefined,
      photo: extractSrc(g?.thumb),
      tier: overrides[String(p.id)]?.tier ?? 'standard',
      contentCount:
        (overrides[String(p.id)]?.webinars ?? 0) +
        (overrides[String(p.id)]?.podcasts ?? 0) +
        (overrides[String(p.id)]?.articles ?? 0),
      webinars: overrides[String(p.id)]?.webinars ?? 0,
      podcasts: overrides[String(p.id)]?.podcasts ?? 0,
      articles: overrides[String(p.id)]?.articles ?? 0,
      // The legacy export has no specialties; they arrive with applications.
      specialties: [],
      profession: roleLabel || undefined,
      introVideo: overrides[String(p.id)]?.introVideo,
      schedulerUrl: overrides[String(p.id)]?.schedulerUrl,
      invisibleOnMap: !g,
    });
  }
  cache = out;
  return out;
}

function extractSrc(thumb?: string): string | undefined {
  if (!thumb) return undefined;
  const m = /src="([^"]+)"/.exec(decodeEntities(thumb));
  return m?.[1];
}

/** Hubs that have at least one professional, with counts. */
export function hubsWithCounts(records: DirectoryRecord[]) {
  const map = new Map<string, { hub: string; label: string; count: number }>();
  for (const r of records) {
    if (r.hub === 'unplaced') continue;
    const entry = map.get(r.hub) ?? { hub: r.hub, label: `${r.city}, ${r.state}`, count: 0 };
    entry.count++;
    map.set(r.hub, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
