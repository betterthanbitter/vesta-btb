/**
 * What a professional actually does, as they would describe it.
 *
 * Distinct from both `profession` (which sets their price band) and `category`
 * (which decides the directory page they appear on). A specialty is finer than
 * either: "QDRO Preparation" and "Business Valuation" are both a CDFA on the
 * Financial & CDFA page at the same price, and a consumer looking for one does
 * not want the other.
 *
 * Kept as one flat list under group headings, deliberately. A professional
 * ticks across groups — an attorney who also mediates, a CDFA who does
 * forensic accounting — so the groups are for finding things on a long form,
 * not a constraint on what may be chosen.
 */

export interface SpecialtyGroup {
  name: string;
  /** Rough hint for which professions this group is most relevant to. */
  professions: string[];
  items: string[];
}

export const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  {
    name: 'Legal',
    professions: ['Attorney'],
    items: [
      'Divorce & Family Law Attorney',
      'Collaborative Divorce Attorney',
      'Litigation / Contested Divorce',
      'Uncontested Divorce',
      'High-Net-Worth / Complex Asset Divorce',
      'Prenuptial & Postnuptial Agreements',
      'Child Custody & Parenting Plans',
      'Child Support & Alimony / Spousal Support',
      'Post-Divorce Modifications & Enforcement',
      'Domestic Violence / Protective Orders',
      'Military Divorce',
      'International / Interstate Divorce',
      'LGBTQ+ Family Law',
      'Estate Planning (Divorce-Related)',
      'Limited Scope / Consulting Attorney',
      'Document Preparation / Pro Se Support',
    ],
  },
  {
    name: 'Mediation & Dispute Resolution',
    professions: ['Mediator', 'Attorney'],
    items: [
      'Divorce Mediation',
      'Custody / Parenting Plan Mediation',
      'Financial Mediation',
      'Collaborative Divorce Professional',
      'Arbitration',
      'Parenting Coordinator',
      'Guardian ad Litem',
    ],
  },
  {
    name: 'Financial',
    professions: ['CDFA', 'Accountant'],
    items: [
      'Certified Divorce Financial Analyst (CDFA)',
      'Financial Planning — Pre-Divorce',
      'Financial Planning — Post-Divorce',
      'Asset & Debt Division Analysis',
      'Alimony / Child Support Financial Modeling',
      'Budgeting & Cash Flow Planning',
      'Retirement Planning',
      'Investment Management',
      'Tax Planning & Preparation',
      'Forensic Accounting',
      'Business Valuation',
      'Pension Valuation',
      'QDRO Preparation',
      'Executive Compensation / Stock Options',
      'Insurance Planning (Life, Health, Disability)',
      'Credit Repair & Rebuilding',
    ],
  },
  {
    name: 'Real Estate & Housing',
    professions: ['Realtor', 'Lending Professional'],
    items: [
      'Divorce Real Estate Specialist (Listing / Selling the Marital Home)',
      "Buyer's Agent — Post-Divorce Purchase",
      'Mortgage Broker / Lender',
      'Divorce Mortgage Planning (Refinance / Buyout)',
      'Home Appraisal',
      'Relocation Services',
    ],
  },
  {
    name: 'Coaching',
    professions: ['Divorce Coach', 'Career Coach'],
    items: [
      'Divorce Coach',
      'Pre-Divorce / Decision Coaching',
      'Legal Preparation Coaching',
      'Co-Parenting Coach',
      'High-Conflict Divorce Coaching',
      'Post-Divorce Transition / Rebuilding Coach',
      'Dating & Relationship Coach',
      'Career / Return-to-Work Coach',
      'Financial Coach',
    ],
  },
  {
    name: 'Mental Health & Wellness',
    professions: ['Therapist'],
    items: [
      'Individual Therapy — Adults',
      'Child & Adolescent Therapy',
      'Family Therapy',
      'Discernment Counseling',
      'Trauma / Abuse Recovery',
      'Narcissistic Abuse Recovery',
      'Addiction & Recovery',
      'Custody Evaluation / Forensic Psychology',
      'Reunification Therapy',
      'Support Group Facilitator',
    ],
  },
  {
    name: 'Co-Parenting & Children',
    professions: ['Divorce Coach', 'Therapist'],
    items: [
      'Co-Parenting Coordinator',
      'Parenting Plan Development',
      'Child Specialist (Collaborative Divorce)',
      'Supervised Visitation Provider',
      'Special Needs Parenting Support',
    ],
  },
  {
    name: 'Other Support',
    professions: ['Other professional service'],
    items: [
      'Divorce Concierge / Project Management',
      'Private Investigator',
      'Organizer / Move Management',
      'Legal Document Retrieval / Paralegal Services',
      'Notary',
      'Other (please specify)',
    ],
  },
];

export const ALL_SPECIALTIES: string[] = SPECIALTY_GROUPS.flatMap((g) => g.items);

/** The free-text one, which needs a box next to it rather than a tick alone. */
export const SPECIALTY_NEEDING_DETAIL = 'Other (please specify)';

/** Which group to open first, based on the profession they chose. */
export function groupsForProfession(profession: string): string[] {
  const matches = SPECIALTY_GROUPS.filter((g) => g.professions.includes(profession));
  return (matches.length ? matches : SPECIALTY_GROUPS).map((g) => g.name);
}

/** Keep only specialties that are really on the list. */
export function sanitizeSpecialties(input: string[] | string | undefined): string[] {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '').split(',').map((s) => s.trim());
  const allowed = new Set(ALL_SPECIALTIES);
  return [...new Set(raw.filter((s) => allowed.has(s)))];
}
